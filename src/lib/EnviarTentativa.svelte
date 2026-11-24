<script lang="ts">
  import type { Snippet } from "svelte";
  import ExportarVideo from "./ExportarVideo.svelte";
  import Icone from "./Icone.svelte";
  import Janela from "./Janela.svelte";
  import { armazenamento } from "./armazenamento";
  import { compartilharArquivo, compartilharVideo, formaDoEnvio, nomeDoArquivo, nomeDoVideo, podeCompartilhar, videoParaEnviar, type Resultado } from "./compartilhar";
  import { i18n } from "./i18n/index.svelte";
  import type { FonteDoOverlay } from "./video/dadosDoOverlay";

  // Enviar a tentativa (V2b), na Revisão e no Histórico. Só áudio: um botão com o ícone de compartilhar. Com vídeo: uma pílula de duas partes, VÍDEO (~66%,
  // o envio principal) e ÁUDIO (~34%), cada uma com o ícone e um rótulo curto. O nome completo ("Enviar áudio" / "Enviar vídeo") vai no aria-label e no
  // title. V3: tocar em VÍDEO abre uma janela (ExportarVideo) com "Com os tempos" (gera um vídeo novo com o overlay, a partir de `overlay`) ou "Sem os
  // tempos" (o vídeo CRU, como antes; alguns apps tocam mal WebM e a nota diz isso, sem prometer nada). Sem `overlay`, o vídeo vai cru direto.
  // Os avisos (erro, áudio que foi como WebM) sobem por `onaviso`, para cada tela mostrar do seu jeito.
  type Mensagem = { tipo: "sucesso" | "erro" | "info"; texto: string } | null;
  /** O áudio da tentativa: o tipo (para o nome do arquivo) e como lê-lo (só ao enviar). */
  type AudioDoEnvio = { tipo: string; obter: () => Promise<Blob | null> };
  /** O que o vídeo com os tempos desenha: os disparos ATUAIS e o resto do overlay, e o zero da Revisão (o Histórico usa o guardado). Lido só ao enviar. */
  type OverlayDoEnvio = () => { fonte: FonteDoOverlay; zeroNoAudioS?: number | null };
  let { id, quando, percurso, audio, temVideo, overlay, onaviso, extra }: {
    id: string;
    /** Quando a tentativa começou (ms), para o nome do arquivo. */
    quando: number;
    /** O nome do percurso, para o nome do arquivo do vídeo. */
    percurso?: string;
    audio: AudioDoEnvio | null;
    temVideo: boolean;
    /** Ausente: sem a escolha dos tempos (o vídeo vai cru). */
    overlay?: OverlayDoEnvio;
    onaviso: (m: Mensagem) => void;
    /** Uma parte a mais, colada no fim da pílula (a lixeira da Revisão). */
    extra?: Snippet;
  } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const uid = $props.id();

  const forma = $derived(formaDoEnvio({ audio: !!audio, video: temVideo }, podeCompartilhar()));
  let enviando = $state<"audio" | "video" | null>(null);

  /** Um envio de cada vez; `entregar` devolve o resultado ou nulo (não havia o arquivo). */
  async function enviar(qual: "audio" | "video", entregar: () => Promise<Resultado | null>) {
    if (enviando) return;
    enviando = qual;
    onaviso(null);
    const r = await entregar().catch((e): Resultado => {
      console.warn("enviar: falhou", e);
      return "erro";
    });
    enviando = null;
    if (r === null) onaviso({ tipo: "erro", texto: t(qual === "audio" ? "audio.sem" : "compartilhar_video.sem") });
    else if (r === "erro") onaviso({ tipo: "erro", texto: t(qual === "audio" ? "audio.erro" : "compartilhar_video.erro") });
    else if (r === "original") onaviso({ tipo: "info", texto: t("audio.original") });
  }
  const enviarAudio = () =>
    enviar("audio", async () => {
      const blob = await audio!.obter();
      return blob && compartilharArquivo(blob, nomeDoArquivo(quando, audio!.tipo), t("audio.enviar"));
    });
  const enviarVideo = () =>
    enviar("video", async () => {
      const blob = await videoParaEnviar(armazenamento, id);
      return blob && compartilharVideo(blob, nomeDoVideo(quando, blob.type, percurso), t("compartilhar_video.enviar_video"));
    });
  const nota = $derived(t(overlay ? "exportar.nota" : "compartilhar_video.nota"));
  const tituloDoVideo = $derived(`${t("compartilhar_video.enviar_video")}. ${nota}`);

  // A janela da escolha (V3): o pedido é lido ao abrir (os disparos como estão agora) e fica parado enquanto ela está aberta.
  let pedido = $state<{ fonte: FonteDoOverlay; zeroNoAudioS?: number | null } | null>(null);
  const tocarVideo = () => (overlay ? (pedido = $state.snapshot(overlay()) as typeof pedido) : enviarVideo());
  const fecharJanela = () => (pedido = null);
  function semOsTempos() {
    pedido = null;
    enviarVideo();
  }
  function aoFimDaExportacao(m: Parameters<typeof onaviso>[0]) {
    pedido = null;
    onaviso(m);
  }
</script>

{#snippet botaoAudio(curto: boolean)}
  <button class="botao parte audio" onclick={enviarAudio} disabled={enviando !== null} aria-busy={enviando === "audio"} aria-label={t("audio.enviar")} title={t("audio.enviar")}>
    <Icone nome="compartilhar" tamanho={20} />
    {#if enviando === "audio"}<span>{t("audio.enviando")}</span>{:else if curto}<span>{t("compartilhar_video.audio")}</span>{/if}
  </button>
{/snippet}
{#snippet botaoVideo()}
  <button class="botao parte video" onclick={tocarVideo} disabled={enviando !== null} aria-busy={enviando === "video"} aria-haspopup={overlay ? "dialog" : undefined} aria-label={t("compartilhar_video.enviar_video")} aria-describedby={`${uid}-nota`} title={tituloDoVideo}>
    <Icone nome="compartilhar" tamanho={20} />
    <span>{enviando === "video" ? t("compartilhar_video.preparando") : t("compartilhar_video.video")}</span>
  </button>
{/snippet}

{#if forma === "audio"}
  <div class="envio pilula" role="group" aria-label={t("compartilhar_video.grupo")}>
    {@render botaoAudio(false)}
    {@render extra?.()}
  </div>
{:else if forma === "video" || forma === "pilula"}
  <div class="envio pilula" role="group" aria-label={t("compartilhar_video.grupo")}>
    {@render botaoVideo()}
    {#if forma === "pilula"}{@render botaoAudio(true)}{/if}
    {@render extra?.()}
    <span class="so-leitor" id={`${uid}-nota`}>{nota}</span>
  </div>
  {#if pedido}
    <Janela titulo={t("compartilhar_video.enviar_video")} onfechar={fecharJanela}>
      <ExportarVideo pedido={{ id, ...pedido }} nomeCru={nomeDoVideo(quando, "video/webm", percurso)} onsem={semOsTempos} onfim={aoFimDaExportacao} oncancelar={fecharJanela} />
    </Janela>
  {/if}
{:else if extra}
  <!-- Sem como enviar (aparelho sem compartilhar, ou tentativa sem áudio nem vídeo): a pílula fica só com a parte extra. -->
  <div class="envio pilula sozinha">{@render extra()}</div>
{/if}

<style>
  /* Uma pílula só, com o raio dos botões do app (não redonda): as partes coladas e separadas por uma linha, não só por cor. Vídeo 40%, áudio 40%, lixeira 20%. */
  .envio { display: flex; min-width: 0; }
  .pilula { overflow: hidden; border-radius: 0.75rem; border: 0.125rem solid var(--acento); background: var(--superficie); }
  .parte { flex: 2 1 0; gap: 0.4rem; min-width: 0; padding: 0 0.6rem; border: 0; border-radius: 0; background: transparent; }
  .pilula .video { font-weight: 600; }
  .pilula .parte + .parte, .pilula > :global(.extra) { border-left: 0.0625rem solid var(--borda-controle); }
  /* Enquanto a lixeira pede a confirmação ("Mesmo?"), as outras partes ficam só com o ícone, para o texto caber sem quebrar no meio da palavra. */
  .pilula:has(:global(.extra.confirmar)) .parte span { display: none; }
  .parte span { overflow-wrap: anywhere; } /* com a fonte em 200%, o texto quebra em vez de sumir */
</style>
