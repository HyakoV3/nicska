<script lang="ts">
  import { onDestroy, onMount, untrack, type Snippet } from "svelte";
  import Aviso from "./Aviso.svelte";
  import Cartao from "./Cartao.svelte";
  import ControleNumerico from "./ControleNumerico.svelte";
  import Pontuacao from "./Pontuacao.svelte";
  import { i18n } from "./i18n/index.svelte";
  import { LIMITES_TIMER } from "./preferencias";
  import { edicaoDe, envelopeParaTela, foiEditada, reprocessar, type Edicao } from "./revisao";
  import RevisaoAcoes from "./RevisaoAcoes.svelte";
  import RevisaoLinha from "./RevisaoLinha.svelte";
  import RevisaoTabela from "./RevisaoTabela.svelte";
  import VideoDaTentativa from "./VideoDaTentativa.svelte";
  import { novoId } from "./registro";
  import { decodificar, tocarTrecho } from "./revisaoAudio";
  import { formatarSegundos, hitFactor, pontuar, resumir, type Pontos } from "./tentativa";
  import type { Resultado } from "./timer";

  // O resultado de uma tentativa e a revisão dela: a linha do tempo com o envelope e as marcas, apagar ou inserir disparos (e ouvir o trecho),
  // reprocessar o áudio guardado com outra sensibilidade ou tempo morto. Tudo recalcula na hora; a tentativa fica marcada como editada.
  let { resultado, aoDescartar, aoSalvar, aoPendente, aoNaoSalva, temPercurso = false, percursoId = null, pontosMaximos, seletor }: {
    resultado: Resultado;
    /** Avisa quem desenha a barra fixa se ainda há o que salvar (a Nova tentativa, lá, passa a principal depois de salvar). */
    aoPendente?: (pendente: boolean) => void;
    /** Avisa se há uma tentativa NÃO salva (a Nova tentativa, na barra fixa, pede confirmação enquanto houver). */
    aoNaoSalva?: (naoSalva: boolean) => void;
    aoDescartar: () => void;
    /** `id` é estável para este resultado: salvar de novo (ou editar e salvar depois) atualiza o MESMO registro. */
    aoSalvar?: (rev: { disparosMs: number[]; apagados: number; inseridos: number; inicio: "detectado" | "estimado"; sensibilidade: number; tempoMortoMs: number; pontos?: Pontos; zeroNoAudioS?: number | null }, id: string) => Promise<void>;
    temPercurso?: boolean;
    /** O percurso escolhido agora (o cabeçalho do overlay do vídeo mostra o nome e a divisão dele). */
    percursoId?: string | null;
    pontosMaximos?: number;
    /** O seletor de percurso (de Timer.svelte), mostrado logo acima do Salvar: no primeiro uso é por onde se cria o percurso. */
    seletor?: Snippet;
  } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const seg = (ms: number) => formatarSegundos(ms, i18n.idioma);

  // O componente é recriado a cada tentativa (`{#key}` em Timer.svelte): o resultado inicial é o que vale aqui.
  const r0 = untrack(() => resultado);
  /** Um id por resultado (a Revisao é recriada a cada tentativa): todo Salvar grava neste mesmo registro. Vem do Timer (nasce no Standby, o vídeo já foi guardado com ele). */
  const idTentativa = r0.id ?? novoId();
  let edicao = $state<Edicao>(edicaoDe(r0.disparosMs));
  let inicio = $state(r0.inicio);
  let ajustes = $state({ sensibilidade: r0.detector.sensibilidade, tempoMortoMs: r0.detector.tempoMortoMs });
  let ajustesUsados = $state({ ...ajustes });

  let audio = $state<{ amostras: Float32Array; taxa: number; envelope: Float32Array; zeroS: number } | null>(null);
  let carregando = $state(true);
  let falhou = $state(false);
  let selecionado = $state<number | null>(null);
  let confirmando = $state<number | null>(null);
  let parar: (() => void) | null = null;

  /** O vídeo da tentativa (se houve): ouvir um trecho ou escolher um disparo leva o vídeo àquele instante. */
  let player = $state<VideoDaTentativa | null>(null);
  /** O zero no áudio como está agora (o reprocesso pode mudá-lo); sem áudio decodificado, o da escuta ao vivo. */
  const zeroAtualS = $derived(audio?.zeroS ?? resultado.zeroNoAudioS);
  const resumo = $derived(resumir(edicao.disparosMs));
  const editada = $derived(foiEditada(edicao));

  onMount(async () => {
    if (!resultado.audio) {
      carregando = false;
      return;
    }
    try {
      const { amostras, taxa } = await decodificar(resultado.audio.blob);
      const r = reprocessar({ amostras, taxa }, { opcoes: ajustes, zeroEstimadoS: resultado.zeroNoAudioS, inicioOriginal: r0.inicio });
      if (r) audio = { amostras, taxa, envelope: envelopeParaTela({ amostras, taxa }), zeroS: r.zeroS };
      else falhou = true;
    } catch (e) {
      console.warn("revisao: não deu para decodificar o áudio", e);
      falhou = true;
    }
    carregando = false;
  });
  onDestroy(() => parar?.());

  function ouvir(ms: number) {
    player?.irPara(ms);
    parar?.();
    if (!audio) return;
    const c = audio.zeroS + ms / 1000;
    parar = tocarTrecho(audio, { iniS: c - 0.3, fimS: c + 0.7 });
  }

  function reprocessarAgora() {
    if (!audio) return;
    const r = reprocessar(audio, { opcoes: ajustes, zeroEstimadoS: resultado.zeroNoAudioS, inicioOriginal: r0.inicio });
    if (!r) return;
    audio = { ...audio, zeroS: r.zeroS };
    edicao = edicaoDe(r.disparosMs);
    inicio = r.inicio;
    ajustesUsados = { ...ajustes };
    selecionado = null;
    confirmando = null;
  }
  // Escolher um disparo (na linha ou na tabela) leva o vídeo até ele.
  $effect(() => {
    if (selecionado !== null && edicao.disparosMs[selecionado] !== undefined) untrack(() => player?.irPara(edicao.disparosMs[selecionado!]));
  });
  const mudouAjuste = $derived(ajustes.sensibilidade !== ajustesUsados.sensibilidade || ajustes.tempoMortoMs !== ajustesUsados.tempoMortoMs);
  const L = LIMITES_TIMER;

  let pontos = $state<Pontos | null>(null);
  // Pontuação e Reprocessar ficam recolhidos (docs/archive/roadmap-ux-ui.md, 3.2): o comum é ver, salvar e seguir. A pontuação abre sozinha quando passa a existir.
  let pontuacaoAberta = $state(false);
  let reprocessarAberto = $state(false);
  let disparosAberto = $state(true);
  $effect(() => {
    if (pontos) untrack(() => (pontuacaoAberta = true));
  });
  const resumoPontos = $derived.by(() => {
    if (!pontos) return undefined;
    const total = pontuar(pontos);
    const hf = hitFactor(total, resumo.total);
    const f = new Intl.NumberFormat(i18n.idioma, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    return hf === null ? t("pontos.total", { n: total }) : `${t("pontos.total", { n: total })} · ${t("pontos.hf", { hf: f.format(hf) })}`;
  });
  /** A revisão como está agora, para o Salvar: os disparos editados, o início, os ajustes usados no reprocesso e os pontos. */
  const montar = () => ({
    disparosMs: [...edicao.disparosMs],
    apagados: edicao.apagados,
    inseridos: edicao.inseridos,
    inicio,
    sensibilidade: ajustesUsados.sensibilidade,
    tempoMortoMs: ajustesUsados.tempoMortoMs,
    ...(pontos ? { pontos: { ...pontos } } : {}),
    // O zero como está agora (o reprocesso pode tê-lo mudado): vai só para a meta do vídeo, que leva cada disparo da tentativa salva ao instante no vídeo.
    zeroNoAudioS: zeroAtualS,
  });
</script>

<section class="resultado" aria-labelledby="titulo-resultado">
  <h2 id="titulo-resultado">{t("timer.resultado_titulo")}</h2>
  {#if resultado.incompleta}<Aviso tipo="erro">{t("revisao.incompleta")}</Aviso>{/if}
  {#if inicio === "estimado"}<Aviso tipo="info">{t("timer.inicio_estimado")}</Aviso>{/if}
  {#if editada}<Aviso tipo="info">{t("revisao.editada", { apagados: edicao.apagados, inseridos: edicao.inseridos })}</Aviso>{/if}

  {#if resumo.n === 0}
    <p class="meta">{t("timer.sem_disparos")}</p>
  {:else}
    <p class="digitos grande">{seg(resumo.total!)}<span class="unidade"> s</span></p>
    <dl class="numeros">
      <div><dt>{t("timer.total")}</dt><dd>{seg(resumo.total!)} s</dd></div>
      <div><dt>{t("timer.primeiro")}</dt><dd>{seg(resumo.primeiro!)} s</dd></div>
      <div><dt>{t("timer.n_disparos")}</dt><dd>{resumo.n}</dd></div>
      {#if resumo.menorSplit !== null}<div><dt>{t("timer.menor_split")}</dt><dd>{seg(resumo.menorSplit)} s</dd></div>{/if}
      {#if resumo.maiorSplit !== null}<div><dt>{t("timer.maior_split")}</dt><dd>{seg(resumo.maiorSplit)} s</dd></div>{/if}
    </dl>
  {/if}

  <!-- A tela é dividida em cartões que abrem e fecham: Disparos (a linha do tempo e a tabela, onde se edita), Vídeo, Pontuação e Reprocessar. -->
  <Cartao titulo={t("revisao.secao_disparos")} resumo={resumo.n > 0 ? i18n.tn("plural.disparos", resumo.n) : undefined} name="resultado" bind:aberto={disparosAberto}>
  {#if carregando}
    <p class="meta">{t("revisao.carregando")}</p>
  {:else if audio}
    <RevisaoLinha {audio} bind:edicao bind:selecionado bind:confirmando {ouvir} />
  {:else if falhou}
    <Aviso tipo="info">{t("revisao.sem_linha")}</Aviso>
  {/if}

  {#if resumo.n > 0}
    <RevisaoTabela bind:edicao {resumo} bind:selecionado bind:confirmando comAudio={!!audio} {ouvir} />
  {/if}
  </Cartao>

  <VideoDaTentativa bind:this={player} grupo="resultado" id={idTentativa} disparosMs={edicao.disparosMs} zeroNoAudioS={zeroAtualS} {pontos} incompleta={resultado.incompleta} {percursoId} data={resultado.data} />

  {#if audio}
    <Cartao titulo={t("revisao.reprocessar")} resumo={t("revisao.avancado")} name="resultado" bind:aberto={reprocessarAberto}>
    <p class="meta">{t("revisao.reprocessar_ajuda")}</p>
    <ControleNumerico rotulo={t("timer.sensibilidade")} ajuda={t("timer.ajuda_sensibilidade")} valor={ajustes.sensibilidade} min={L.sensibilidade.min} max={L.sensibilidade.max} passo={L.sensibilidade.passo} mostrar={(v) => t("timer.unid_pct", { n: Math.round(v * 100) })} aoMudar={(v) => (ajustes.sensibilidade = v)} />
    <ControleNumerico rotulo={t("timer.tempo_morto")} ajuda={t("timer.ajuda_tempo_morto")} valor={ajustes.tempoMortoMs} min={L.tempoMortoMs.min} max={L.tempoMortoMs.max} passo={L.tempoMortoMs.passo} mostrar={(v) => t("timer.unid_ms", { n: v })} aoMudar={(v) => (ajustes.tempoMortoMs = v)} />
    <button class="botao" onclick={reprocessarAgora} disabled={!mudouAjuste && !editada}>{t(editada ? "revisao.reprocessar_descarta" : "revisao.reprocessar_botao")}</button>
    </Cartao>
  {/if}

  {#if aoSalvar}
    <Cartao titulo={t("pontos.titulo")} resumo={resumoPontos} name="resultado" bind:aberto={pontuacaoAberta}>
      <Pontuacao bind:pontos totalMs={resumo.total} {pontosMaximos} semTitulo />
    </Cartao>
  {/if}

  <RevisaoAcoes {resultado} idTentativa={idTentativa} {percursoId} {aoSalvar} {aoDescartar} {aoPendente} {aoNaoSalva} {temPercurso} {seletor} {montar} versao={{ edicao, inicio, pontos }} />
</section>

<style>
  .resultado h2 { margin: 0.2rem 0; font-size: 1.1rem; text-align: center; }
  .digitos { margin: 0; text-align: center; font-variant-numeric: tabular-nums; font-weight: 700; line-height: 1.1; }
  .digitos.grande { font-size: clamp(3rem, 18vw, 5.5rem); }
  .unidade { font-size: 0.3em; font-weight: 400; color: var(--suave); }
  .numeros { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: 0.5rem; margin: 0.6rem 0; }
  .numeros div { padding: 0.5rem 0.7rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); }
  .numeros dt { font-size: 0.85rem; color: var(--suave); }
  .numeros dd { margin: 0; font-size: 1.3rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .resultado :global(.cartao) { margin-top: 0.5rem; }
</style>
