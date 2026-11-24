<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Aviso from "./Aviso.svelte";
  import Cartao from "./Cartao.svelte";
  import OverlayDoVideo from "./OverlayDoVideo.svelte";
  import { armazenamento } from "./armazenamento";
  import type { Percurso } from "./documento";
  import { i18n } from "./i18n/index.svelte";
  import { lerOverlay, salvarOverlay } from "./preferencias";
  import { registrarNivel } from "./navegacao";
  import { lerAtirador } from "./registro";
  import { manterImersivo } from "./telaImersiva";
  import type { Pontos } from "./tentativa";
  import { disparoNoVideoS } from "./video/alinhamento";
  import { dadosDoOverlay } from "./video/dadosDoOverlay";
  import type { AtiradorDoOverlay, DadosDoOverlay } from "./video/overlay";
  import { ReproducaoDoVideo, encaixeDoVideo, type VideoParaTocar } from "./video/reproducao";
  import { acompanharVideo } from "./video/sincronia";
  import { emTelaCheia, entrarTelaCheia, estaEmTelaCheia, rotuloDaTelaCheia, sairTelaCheiaDoVideo, telaCheiaDisponivel } from "./video/telaCheiaReproducao";

  // O vídeo de uma tentativa (Revisão e Histórico): o <video> com os controles do sistema e o som normal (nada toca sozinho), o aviso de vídeo incompleto e
  // os botões que levam o vídeo ao apito e a cada disparo (convertidos da linha do tempo do áudio pelo deslocamento guardado, video/alinhamento.ts). Sem
  // vídeo, não aparece nada: a tentativa só com áudio fica exatamente como era. A URL de objeto é revogada ao sair (`ReproducaoDoVideo`).
  // V2: por cima do vídeo, o overlay (OverlayDoVideo) com os disparos ATUAIS (os da Revisão, editados ou não), sincronizado quadro a quadro
  // (video/sincronia.ts). Só existe com o zero conhecido; o botão abaixo do vídeo liga e desliga e a escolha fica lembrada (a mesma de Ajustes).
  let { id, disparosMs, zeroNoAudioS = null, pontos = null, incompleta = false, percursoId = null, data, atirador, grupo }: {
    id: string;
    disparosMs: number[];
    /** O zero no áudio como está na Revisão agora (s); ausente no Histórico, que usa o guardado ao salvar. */
    zeroNoAudioS?: number | null;
    pontos?: Pontos | null;
    incompleta?: boolean;
    /** O percurso da tentativa, para o cabeçalho do overlay (nome e divisão). */
    percursoId?: string | null;
    /** ISO 8601 de quando a tentativa começou. */
    data?: string;
    /** De quem é (avatar e nome no overlay); ausente = o atirador deste aparelho. */
    atirador?: AtiradorDoOverlay;
    /** `name` do <details> do cartão: junta o vídeo num acordeão com os outros cartões da tela (abrir um fecha os outros). */
    grupo?: string;
  } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  /** O vídeo é um cartão que abre e fecha (aberto de saída): a tela do resultado tem muita coisa, e quem quer ver só os números fecha. */
  // Em acordeão (`grupo`) começa fechado: dois abertos com o mesmo `name` o navegador resolveria sozinho, e os Disparos é que abrem de saída.
  // svelte-ignore state_referenced_locally
  let aberto = $state(!grupo);
  const reproducao = new ReproducaoDoVideo(armazenamento);
  let video = $state<VideoParaTocar | null>(null);
  let tela = $state<HTMLVideoElement | null>(null);
  let palco = $state<HTMLDivElement | null>(null);
  const encaixe = $derived(video ? encaixeDoVideo(video.meta, zeroNoAudioS) : null);

  // ---- Overlay (V2) ----
  let prefs = $state(lerOverlay());
  let tempoS = $state(0);
  /** Largura ÷ altura do vídeo (lida do arquivo ao carregar): o palco tem a forma da imagem, então o overlay cai sobre ela e não sobre as faixas. */
  let proporcao = $state(16 / 9);
  let percurso = $state<Percurso | null>(null);
  const quem = $derived(atirador ?? lerAtirador(i18n.t("atirador.padrao")));
  // A mesma montagem do vídeo exportado com os tempos (video/dadosDoOverlay.ts): o player e o arquivo nunca discordam.
  const dados = $derived<DadosDoOverlay | null>(dadosDoOverlay(encaixe, { disparosMs, pontos, incompleta, atirador: quem, percurso: percurso?.nome, divisao: percurso?.divisao, data }));
  const sincronizar = $derived(prefs.ligado && encaixe !== null);
  // Só acompanha o vídeo com o overlay à mostra; desligar, trocar de vídeo ou sair cancela o laço e solta os eventos.
  $effect(() => {
    if (tela && sincronizar) return acompanharVideo(tela, (s) => (tempoS = s));
  });
  // O nome e a divisão do percurso, para o cabeçalho; só com vídeo (sem vídeo nada aparece).
  $effect(() => {
    const pid = percursoId;
    if (!video || !pid) return void (percurso = null);
    let vivo = true;
    armazenamento.percursos().then((ps) => vivo && (percurso = ps.find((p) => p.id === pid) ?? null), () => {});
    return () => void (vivo = false);
  });
  function alternarOverlay() {
    prefs.ligado = !prefs.ligado;
    salvarOverlay($state.snapshot(prefs));
  }
  // ---- Tela cheia ----
  // O botão nativo do <video> levaria só o vídeo (o overlay é DOM por cima e sumiria): ele fica escondido (controlsList) e o botão próprio põe o PALCO inteiro
  // (vídeo + overlay) em tela cheia. Os controles nativos do vídeo continuam dentro dele. O Voltar do Android e o Esc saem dela sem sair da tela.
  const podeTelaCheia = telaCheiaDisponivel();
  let cheia = $state(false);
  function aoMudarTelaCheia() {
    cheia = estaEmTelaCheia(palco);
  }
  $effect(() => {
    document.addEventListener("fullscreenchange", aoMudarTelaCheia);
    document.addEventListener("webkitfullscreenchange", aoMudarTelaCheia);
    return () => {
      document.removeEventListener("fullscreenchange", aoMudarTelaCheia);
      document.removeEventListener("webkitfullscreenchange", aoMudarTelaCheia);
      if (palco && emTelaCheia() === palco) void sairTelaCheiaDoVideo();
    };
  });
  // Em tela cheia: um nível de Voltar (sai da tela cheia) e as barras do sistema escondidas.
  $effect(() => {
    if (!cheia) return;
    const nivel = registrarNivel(() => void sairTelaCheiaDoVideo());
    const barras = manterImersivo();
    return () => {
      nivel();
      barras.soltar();
    };
  });
  async function alternarTelaCheia() {
    if (cheia) await sairTelaCheiaDoVideo();
    else if (palco) await entrarTelaCheia(palco);
  }
  function medir(e: Event) {
    const v = e.currentTarget as HTMLVideoElement;
    if (v.videoWidth > 0 && v.videoHeight > 0) proporcao = v.videoWidth / v.videoHeight;
  }

  onMount(async () => {
    video = await reproducao.abrir(id);
  });
  onDestroy(() => reproducao.fechar());

  /** Leva o vídeo ao disparo `ms` (desde o apito; 0 = o apito) e para ali, para a pessoa ver o quadro. Sem vídeo ou sem zero conhecido, nada. */
  export function irPara(ms: number) {
    if (!tela || !encaixe) return;
    tela.pause();
    tela.currentTime = disparoNoVideoS(encaixe, ms);
  }
</script>

{#if video}
  <Cartao titulo={t("revisao_video.titulo")} name={grupo} bind:aberto={aberto}>
  <section class="video" aria-label={t("revisao_video.aria")}>
    {#if video.meta.parcial}<Aviso tipo="info">{t("revisao_video.parcial")}</Aviso>{/if}
    <!-- O vídeo e, logo abaixo, a chave dos tempos com a MESMA largura dele (a caixa `.bloco` tem a largura do vídeo e os dois a preenchem). -->
    <div class="bloco" style:--proporcao={proporcao}>
      <div class="palco" bind:this={palco}>
       <div class="imagem">
        <!-- svelte-ignore a11y_media_has_caption: vídeo do próprio treino, sem fala a legendar; os tempos estão em texto na tela -->
        <video bind:this={tela} src={video.url} controls controlsList="nofullscreen" disablePictureInPicture playsinline preload="metadata" aria-label={t("revisao_video.aria")} onloadedmetadata={medir}></video>
        {#if prefs.ligado && dados}<OverlayDoVideo {tempoS} {dados} opcoes={prefs} />{/if}
        {#if podeTelaCheia}
          <button class="botao tela-cheia" aria-label={t(rotuloDaTelaCheia(cheia))} title={t(rotuloDaTelaCheia(cheia))} onclick={alternarTelaCheia}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              {#if cheia}<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />{:else}<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />{/if}
            </svg>
          </button>
        {/if}
       </div>
      </div>
      {#if dados}<button class="botao chave-overlay" aria-pressed={prefs.ligado} onclick={alternarOverlay}><span class="marcador" aria-hidden="true">{prefs.ligado ? "✓" : ""}</span>{t("overlay.botao")}</button>{/if}
    </div>
    {#if encaixe}
      <p class="rotulo-grupo" id={`pulos-${id}`}>{t("revisao_video.pulos")}</p>
      <div class="pulos" role="group" aria-labelledby={`pulos-${id}`}>
        <button class="botao" aria-label={t("revisao_video.ir_apito")} onclick={() => irPara(0)}>{t("revisao_video.apito")}</button>
        {#each disparosMs as ms, i (ms)}
          <button class="botao" aria-label={t("revisao_video.ir_disparo", { n: i + 1 })} onclick={() => irPara(ms)}>{i + 1}</button>
        {/each}
      </div>
    {/if}
  </section>
  </Cartao>
{/if}

<style>
  .video { display: grid; gap: 0.4rem; }
  /* A chave dos tempos logo abaixo do vídeo, na largura dele. */
  /* O palco tem a proporção do vídeo e cabe na largura e em 60% da altura da tela: o vídeo o preenche e o overlay o cobre por inteiro. */
  .bloco { display: grid; gap: 0.5rem; width: min(100%, calc(60vh * var(--proporcao))); margin-inline: auto; }
  .palco { width: 100%; }
  .imagem { position: relative; width: 100%; aspect-ratio: var(--proporcao); overflow: hidden; border-radius: 0.75rem; background: var(--superficie); border: 0.0625rem solid var(--borda-controle); box-sizing: border-box; }
  /* Em tela cheia o palco é a tela preta e a imagem fica no tamanho do vídeo, centrada: o overlay (que mede a própria caixa, --u) cobre a imagem, em pé ou deitada. */
  .palco:fullscreen { display: grid; place-items: center; background: black; }
  .palco:fullscreen .imagem { width: min(100vw, calc(100vh * var(--proporcao))); border: 0; border-radius: 0; }
  .palco:-webkit-full-screen { display: grid; place-items: center; background: black; }
  .palco:-webkit-full-screen .imagem { width: min(100vw, calc(100vh * var(--proporcao))); border: 0; border-radius: 0; }
  /* No meio da borda direita: o alto tem o cabeçalho e a marca do overlay, e embaixo ficam os controles do vídeo. */
  .tela-cheia { position: absolute; top: calc(50% - 1.375rem); right: 0.5rem; z-index: 2; min-width: 2.75rem; min-height: 2.75rem; padding: 0.5rem; justify-content: center; opacity: 0.85; }
  video { display: block; width: 100%; height: 100%; object-fit: contain; }
  .chave-overlay { gap: 0.4rem; width: 100%; justify-content: center; }
  .chave-overlay[aria-pressed="true"] { border: 0.125rem solid var(--acento); font-weight: 700; }
  .marcador { display: inline-block; min-width: 1em; }
  .rotulo-grupo { margin: 0.3rem 0 0; font-size: 0.9rem; color: var(--suave); }
  .pulos { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .pulos .botao { min-width: 3rem; }
</style>
