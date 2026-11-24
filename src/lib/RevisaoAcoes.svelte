<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import Aviso from "./Aviso.svelte";
  import EnviarTentativa from "./EnviarTentativa.svelte";
  import Icone from "./Icone.svelte";
  import Janela from "./Janela.svelte";
  import { armazenamento } from "./armazenamento";
  import { i18n } from "./i18n/index.svelte";
  import { fonteDaRevisao, type PercursoDoOverlay } from "./video/dadosDoOverlay";
  import { podeSalvar, tocarDescartavel, type montarTentativa } from "./registro";
  import type { Resultado } from "./timer";

  // As ações da Revisão: Salvar (na largura toda), Descartar (a lixeira, só o ícone) e Enviar (o resto da linha: o ícone do áudio ou, com vídeo, a pílula vídeo + áudio, V2b), com a
  // confirmação do descarte e os avisos de salvo/erro.
  // A Nova tentativa fica na barra fixa, acima das abas (Timer.svelte); `aoPendente` e `aoNaoSalva` dizem a ela se ainda há o que salvar ou perder.
  type Revisado = Parameters<typeof montarTentativa>[2];
  let { resultado, idTentativa, percursoId = null, aoSalvar, aoDescartar, aoPendente, aoNaoSalva, temPercurso, seletor, montar, versao }: {
    resultado: Resultado;
    /** O percurso escolhido agora (o nome entra no nome do arquivo do vídeo enviado). */
    percursoId?: string | null;
    /** Um id por resultado (a Revisão é recriada a cada tentativa): todo Salvar grava neste mesmo registro. */
    idTentativa: string;
    /** Guarda a revisão (já montada por `montar`) no registro de id estável. Ausente: só se descarta. */
    aoSalvar?: (rev: Revisado, id: string) => Promise<void>;
    aoDescartar: () => void;
    aoPendente?: (pendente: boolean) => void;
    aoNaoSalva?: (naoSalva: boolean) => void;
    temPercurso: boolean;
    seletor?: Snippet;
    /** A revisão como está agora (disparos editados, início, ajustes, pontos). */
    montar: () => Revisado;
    /** Lê o que a revisão tem de editável; quando muda, a tentativa volta a "não salva". */
    versao: object;
  } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  // O envio: o áudio (se gravou) e o vídeo (se esta tentativa tem um guardado, mesmo ainda não salva: ele nasce com o id dela no Standby).
  let avisoDoEnvio = $state<{ tipo: "sucesso" | "erro" | "info"; texto: string } | null>(null);
  let temVideo = $state(false);
  /** O percurso escolhido (o nome vai no nome do arquivo e, com a divisão, no cabeçalho do vídeo com os tempos). */
  let percursoAtual = $state<PercursoDoOverlay>(null);
  const nomeDoPercurso = $derived(percursoAtual?.nome);
  /** A janela de escolher o percurso (só no primeiro uso, sem nenhum percurso); fecha sozinha quando há um escolhido. */
  let escolhendo = $state(false);
  $effect(() => {
    if (temPercurso) escolhendo = false;
  });
  $effect(() => {
    let vivo = true;
    armazenamento.metaDoVideo(idTentativa).then((m) => vivo && (temVideo = m !== null), () => {});
    return () => void (vivo = false);
  });
  $effect(() => {
    const pid = percursoId;
    let vivo = true;
    if (pid) armazenamento.percursos().then((ps) => vivo && (percursoAtual = ps.find((p) => p.id === pid) ?? null), () => {});
    return () => void (vivo = false);
  });
  /** O vídeo com os tempos (V3) desenha a revisão como está AGORA: os disparos editados, os pontos e o zero (o reprocesso pode tê-lo mudado). */
  const overlayDoEnvio = () => {
    const rev = montar();
    return { fonte: fonteDaRevisao(rev, resultado, percursoAtual), zeroNoAudioS: rev.zeroNoAudioS };
  };
  const audioDoEnvio = $derived(resultado.audio ? { tipo: resultado.audio.tipo, obter: async () => resultado.audio?.blob ?? null } : null);

  let salvando = $state(false);
  let salva = $state(false);
  let erroAoSalvar = $state("");
  /** Há o que salvar: dá para salvar (há percurso) e ainda não foi salva. */
  const salvarPendente = $derived(!!aoSalvar && temPercurso && !salva);
  /** Há o que perder: ainda não salva (com ou sem percurso). */
  const naoSalva = $derived(!!aoSalvar && !salva);
  $effect(() => aoPendente?.(salvarPendente));
  $effect(() => aoNaoSalva?.(naoSalva));

  let descartando = $state(false);
  function descartar() {
    const r = tocarDescartavel(naoSalva, descartando);
    descartando = r.armado;
    if (r.executa) aoDescartar();
  }
  $effect(() => {
    if (!naoSalva) descartando = false;
  });

  async function salvar() {
    if (!aoSalvar || salvando) return;
    salvando = true;
    erroAoSalvar = "";
    try {
      await aoSalvar(montar(), idTentativa);
      salva = true;
    } catch (e) {
      erroAoSalvar = e instanceof Error ? e.message : String(e);
    }
    salvando = false;
  }
  // Mexer na revisão depois de salva a deixa "não salva" de novo.
  $effect(() => {
    void versao;
    untrack(() => (salva = false));
  });
</script>

{#if avisoDoEnvio}<Aviso tipo={avisoDoEnvio.tipo}>{avisoDoEnvio.texto}</Aviso>{/if}
{#if salva}<Aviso tipo="sucesso">{t("revisao.salvo")}</Aviso>{/if}
{#if erroAoSalvar}<Aviso tipo="erro">{t("revisao.erro_salvar", { motivo: erroAoSalvar })}</Aviso>{/if}
<!-- O percurso se escolhe ANTES, na aba Cronômetro. Aqui só se diz onde a tentativa vai ser salva; sem percurso nenhum (primeiro uso), um botão abre a escolha numa janela. -->
{#if aoSalvar && temPercurso && nomeDoPercurso}<p class="meta salva-em">{t("revisao.salva_em", { nome: nomeDoPercurso })}</p>{/if}
{#if aoSalvar && !temPercurso}
  <p class="meta">{t("revisao.salvar_sem_percurso")}</p>
  <button class="botao escolher-percurso" onclick={() => (escolhendo = true)}>{t("revisao.escolher_percurso")}</button>
{/if}
{#if escolhendo && !temPercurso}
  <Janela titulo={t("percurso.rotulo")} onfechar={() => (escolhendo = false)}>{@render seletor?.()}</Janela>
{/if}

<div class="acoes">
  {#if aoSalvar}<button class="botao grande-acao" class:primario={salvarPendente} onclick={salvar} disabled={!podeSalvar({ temPercurso, salvando, salva })}>{t("revisao.salvar")}</button>{/if}
  <div class="linha-descartar">
    <EnviarTentativa id={idTentativa} quando={Date.parse(resultado.data) || Date.now()} percurso={nomeDoPercurso} audio={audioDoEnvio} {temVideo} overlay={overlayDoEnvio} onaviso={(m) => (avisoDoEnvio = m)}>
      {#snippet extra()}
        <!-- A lixeira é a última parte da pílula de enviar; ao pedir a confirmação ganha o "Mesmo?" e cresce. -->
        <button class="botao perigo extra" class:confirmar={descartando} aria-label={descartando ? t("timer.descartar_mesmo") : t("timer.descartar")} title={t("timer.descartar")} onclick={descartar}>
          <Icone nome="lixeira" tamanho={24} />{#if descartando}<span class="mesmo">{t("timer.descartar_curto")}</span>{/if}
        </button>
      {/snippet}
    </EnviarTentativa>
  </div>
</div>

<style>
  .acoes { display: grid; gap: 1rem; margin: 1rem 0 0.8rem; }
  .linha-descartar { display: flex; }
  .linha-descartar :global(.envio) { flex: 1 1 auto; }
  .linha-descartar :global(.envio.sozinha) { flex: none; min-width: 5rem; } /* sem como enviar, a pílula é só a lixeira */
  /* A lixeira, a última parte da pílula: só o ícone (largura fixa), sem a borda do botão. */
  .linha-descartar :global(.extra) { flex: 1 1 0; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; min-width: 3.5rem; min-height: 3.25rem; padding: 0 0.8rem; border: 0; border-left: 0.0625rem solid var(--borda-controle); border-radius: 0; background: transparent; }
  .linha-descartar :global(.extra.confirmar) { background: var(--perigo); color: white; }
  .mesmo { font-weight: 700; white-space: nowrap; }
  .grande-acao { min-height: 3.5rem; }
</style>
