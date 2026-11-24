<script lang="ts">
  import { untrack } from "svelte";
  import EnviarTentativa from "./EnviarTentativa.svelte";
  import Janela from "./Janela.svelte";
  import Pontuacao from "./Pontuacao.svelte";
  import SeletorPercurso from "./SeletorPercurso.svelte";
  import VideoNaLista from "./VideoNaLista.svelte";
  import type { MetaDoVideo } from "./armazenamento/videos";
  import { fonteDaTentativaSalva } from "./video/dadosDoOverlay";
  import { metasDosVideos } from "./video/reproducao";
  import { armazenamento } from "./armazenamento";
  import { entregarArquivo } from "./dados";
  import { gerarSrt, nomeDaLegenda, TIPO_SRT } from "./legenda";
  import { criarConfirmacao } from "./confirmacao";
  import type { Atirador, Percurso, Sessao, TentativaGuardada } from "./documento";
  import { hora, motivo, num, seg } from "./formatosHistorico";
  import { i18n } from "./i18n/index.svelte";
  import { hitFactor, pontuar, resumir, type Pontos } from "./tentativa";

  // As sessões de um percurso (um dia cada) e as tentativas de cada uma: pontuar, ouvir, enviar (o ícone do áudio ou, com vídeo, a pílula vídeo + áudio) e
  // apagar (apagar pede um 2º toque que desarma sozinho).
  type Mensagem = { tipo: "sucesso" | "erro" | "info"; texto: string } | null;
  let { sessoes, percurso, atirador, temMais, onmais, onmudou, onerro, onaviso }: {
    sessoes: Sessao[];
    percurso: Percurso;
    /** De quem são as tentativas listadas (avatar e nome no overlay do vídeo). */
    atirador: Atirador;
    temMais: boolean;
    onmais: () => void;
    onmudou: () => void;
    onerro: (msg: string) => void;
    onaviso: (a: Mensagem) => void;
  } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  let confirmando = $state<string | null>(null);
  const confirmacao = criarConfirmacao((id) => (confirmando = id));
  let tocando: { parar: () => void } | null = null;
  // Ao sair (a aba Histórico some ou o percurso fecha), para o áudio e desarma a confirmação.
  $effect(() => () => {
    tocando?.parar();
    confirmacao.cancelar();
  });

  // Os vídeos das tentativas listadas (só as metas: "com vídeo", fixado, incompleto); relidos quando a lista muda ou um vídeo é fixado ou apagado.
  let videos = $state<Record<string, MetaDoVideo>>({});
  let pedidoDeVideos = 0;
  async function carregarVideos() {
    const meu = ++pedidoDeVideos;
    const ids = sessoes.flatMap((s) => s.tentativas.map((x) => x.id));
    const metas = await metasDosVideos(armazenamento, ids).catch(() => ({}));
    if (meu === pedidoDeVideos) videos = metas;
  }
  $effect(() => {
    void sessoes;
    untrack(() => void carregarVideos());
  });
  const marcasDoVideo = (m: MetaDoVideo) =>
    [t("revisao_video.tem_video"), m.fixado ? t("revisao_video.fixado_curto") : "", m.parcial ? t("revisao_video.incompleto") : ""].filter(Boolean).join(" · ");

  // Pontuar (ou corrigir a pontuação) de uma tentativa já salva.
  let pontuando = $state<string | null>(null);
  let pontosEmEdicao = $state<Pontos | null>(null);
  const hfDe = (x: TentativaGuardada) => (x.pontos ? hitFactor(pontuar(x.pontos), x.disparos_ms.at(-1) ?? null) : null);
  function comecarPontuar(x: TentativaGuardada) {
    pontuando = x.id;
    pontosEmEdicao = x.pontos ? { ...x.pontos } : null;
  }
  async function salvarPontos(x: TentativaGuardada) {
    await armazenamento
      .definirPontos(x.id, pontosEmEdicao ? { ...pontosEmEdicao } : null)
      .then(() => {
        pontuando = null;
        onmudou();
      })
      .catch((e) => onerro(motivo(e)));
  }

  // Trocar o percurso de uma tentativa já salva (o erro comum: salvar no percurso errado). A janela reusa o seletor do Cronômetro, sem mexer no percurso escolhido lá;
  // o botão de mover é a confirmação.
  let trocando = $state<TentativaGuardada | null>(null);
  let destino = $state<string | null>(null);
  function comecarTrocar(x: TentativaGuardada) {
    trocando = x;
    destino = x.percurso_id;
  }
  async function trocarPercurso() {
    const x = trocando;
    if (!x || !destino || destino === x.percurso_id) return;
    const alvo = destino;
    await armazenamento
      .trocarPercurso(x.id, alvo)
      .then(async (nova) => {
        trocando = null;
        if (!nova) return onerro(t("historico.trocar_percurso_falhou"));
        const nome = (await armazenamento.percursos()).find((p) => p.id === alvo)?.nome ?? "";
        onaviso({ tipo: "sucesso", texto: t("historico.trocar_percurso_feito", { nome }) });
        onmudou();
      })
      .catch((e) => onerro(motivo(e)));
  }

  /** A legenda .srt com os splits da tentativa, entregue como arquivo (application/x-subrip). */
  async function exportarLegenda(x: TentativaGuardada) {
    const texto = gerarSrt(x.disparos_ms, {
      apito: t("legenda.apito"),
      primeiro: (n, ms) => t("legenda.primeiro", { n, tempo: seg(ms) }),
      split: (n, ms) => t("legenda.split", { n, tempo: seg(ms) }),
      total: (ms) => t("legenda.total", { tempo: seg(ms) }),
    });
    await entregarArquivo(new Blob([texto], { type: TIPO_SRT }), nomeDaLegenda(x.quando, percurso.nome)).catch((e) => onerro(motivo(e)));
  }

  async function apagar(x: TentativaGuardada) {
    if (!confirmacao.pedir(x.id)) return;
    await armazenamento
      .apagarTentativa(x.id)
      .then(onmudou)
      .catch((e) => onerro(motivo(e)));
  }

  async function ouvir(x: TentativaGuardada) {
    tocando?.parar();
    const blob = await armazenamento.audio(x.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    const parar = () => {
      a.pause();
      URL.revokeObjectURL(url);
      if (tocando?.parar === parar) tocando = null;
    };
    a.onended = parar;
    tocando = { parar };
    void a.play().catch(parar);
  }

  /** O áudio guardado da tentativa, para o envio (lido do banco só ao tocar em enviar). */
  /** O vídeo com os tempos (V3) de uma tentativa salva: os disparos e os pontos guardados; o zero é o da meta do vídeo. */
  const overlayDoEnvio = (x: TentativaGuardada) => () => ({ fonte: fonteDaTentativaSalva(x, percurso, atirador) });
  const audioDoEnvio = (x: TentativaGuardada) => (x.audio ? { tipo: x.audio.tipo, obter: () => armazenamento.audio(x.id) } : null);
</script>

{#each sessoes as s (s.dia)}
  {@const totaisDaSessao = s.tentativas.filter((x) => x.disparos_ms.length > 0).map((x) => x.disparos_ms[x.disparos_ms.length - 1])}
  <details class="sessao" open={s === sessoes[0]}>
    <summary>
      <h3 id={`sessao-${s.dia}`}>{t("historico.sessao", { dia: s.dia.split("-").reverse().slice(0, 2).join("/") })} · {i18n.tn("plural.tentativas", s.tentativas.length)}</h3>
      {#if totaisDaSessao.length}<span class="meta">{t("historico.sessao_melhor", { tempo: seg(Math.min(...totaisDaSessao)) })}</span>{/if}
    </summary>
    <ul class="tentativas">
      {#each s.tentativas as x (x.id)}
        {@const r = resumir(x.disparos_ms)}
        <li>
         <details class="tentativa" open={pontuando === x.id}>
          <summary class="topo">
            <strong class="total">{r.total === null ? t("historico.sem_disparos") : `${seg(r.total)} s`}</strong>
            <span class="meta">{hora(x.quando)} · {i18n.tn("plural.disparos", r.n)}{#if r.primeiro !== null} · {seg(r.primeiro)} s{/if}{#if videos[x.id]} · {marcasDoVideo(videos[x.id])}{/if}</span>
          </summary>
          {#if x.editada.apagados || x.editada.inseridos || x.inicio === "estimado" || x.incompleta}
            <span class="meta">{[x.editada.apagados || x.editada.inseridos ? t("historico.editada") : "", x.inicio === "estimado" ? t("historico.estimado") : "", x.incompleta ? t("historico.incompleta") : ""].filter(Boolean).join(" · ")}</span>
          {/if}
          {#if x.pontos}
            {@const hf = hfDe(x)}
            <span class="meta">{t("pontos.total", { n: pontuar(x.pontos) })}{#if hf !== null} · {t("pontos.hf", { hf: num(hf, 4) })}{/if}{#if percurso.pontos_maximos} · {t("pontos.pct", { p: num((Math.max(0, pontuar(x.pontos)) / percurso.pontos_maximos) * 100, 1) })}{/if}</span>
          {/if}
          {#if pontuando === x.id}
            <Pontuacao bind:pontos={pontosEmEdicao} totalMs={x.disparos_ms.at(-1) ?? null} pontosMaximos={percurso.pontos_maximos} />
            <div class="acoes-linha">
              <button class="botao primario" onclick={() => salvarPontos(x)}>{t("pontos.salvar")}</button>
              <button class="botao" onclick={() => (pontuando = null)}>{t("timer.cancelar")}</button>
            </div>
          {/if}
          <div class="acoes-linha">
            <button class="botao" onclick={() => comecarPontuar(x)}>{t("pontos.editar")}</button>
            {#if x.audio}<button class="botao" onclick={() => ouvir(x)}>{t("historico.ouvir")}</button>{/if}
            <EnviarTentativa id={x.id} quando={x.quando} percurso={percurso.nome} audio={audioDoEnvio(x)} temVideo={!!videos[x.id]} overlay={overlayDoEnvio(x)} {onaviso} />
            <button class="botao perigo" class:confirmar={confirmando === x.id} onclick={() => apagar(x)}>{confirmando === x.id ? t("historico.apagar_mesmo") : t("historico.apagar")}</button>
          </div>
          <div class="acoes-linha">
            <button class="botao" onclick={() => comecarTrocar(x)}>{t("historico.trocar_percurso")}</button>
            {#if x.disparos_ms.length > 0}<button class="botao" onclick={() => exportarLegenda(x)}>{t("historico.legenda")}</button>{/if}
          </div>
          {#if videos[x.id]}<VideoNaLista id={x.id} meta={videos[x.id]} disparosMs={x.disparos_ms} tentativa={x} {atirador} onmudou={carregarVideos} {onaviso} />{/if}
         </details>
        </li>
      {/each}
    </ul>
  </details>
{/each}
{#if trocando}
  <Janela titulo={t("historico.trocar_percurso")} onfechar={() => (trocando = null)}>
    <div class="trocar">
      <SeletorPercurso bind:percursoId={destino} memorizar={false} />
      <p class="meta">{t("historico.trocar_percurso_aviso", { de: percurso.nome })}</p>
      <div class="acoes-linha">
        <button class="botao primario" disabled={!destino || destino === trocando.percurso_id} onclick={trocarPercurso}>{t("historico.trocar_percurso_ok")}</button>
        <button class="botao" onclick={() => (trocando = null)}>{t("timer.cancelar")}</button>
      </div>
    </div>
  </Janela>
{/if}
{#if temMais}<button class="botao" onclick={onmais}>{t("historico.mais")}</button>{/if}

<style>
  h3 { margin: 0.8rem 0 0.3rem; font-size: 1rem; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
  .sessao > summary { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.2rem 0.8rem; cursor: pointer; min-height: 3rem; align-content: center; }
  .sessao > summary h3 { margin: 0; font-size: 1rem; }
  .tentativa > summary { cursor: pointer; list-style: none; }
  .tentativa > summary::-webkit-details-marker { display: none; }
  .tentativa[open] > summary { margin-bottom: 0.4rem; }
  .tentativas li { display: grid; gap: 0.3rem; padding: 0.6rem 0.8rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); }
  .topo { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.2rem 0.8rem; }
  .total { font-size: 1.4rem; font-variant-numeric: tabular-nums; }
  .trocar { display: grid; gap: 0.75rem; }
  .acoes-linha { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .acoes-linha .botao, .acoes-linha :global(.envio) { flex: 1; }
  .acoes-linha :global(.envio.pilula) { flex: 2; }
</style>
