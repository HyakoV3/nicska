<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { i18n } from "./i18n/index.svelte";
  import { lerQualidade } from "./preferencias";
  import { chaveDaPrevia } from "./video/avisos";
  import type { MotivoSemVideo } from "./video/fabricasDeVideo";
  import type { Camera } from "./video/formato";
  import { PREVIA_OCIOSA_MS, PreviaDaCamera, previaPodeFicar } from "./video/previa";

  // A câmera da tela cheia do modo vídeo (V2b): o <video> mudo com a imagem ao vivo ocupando o espaço todo (para enquadrar e, depois, por baixo do overlay
  // ao vivo), o "Ligar a câmera" quando ela está desligada e o motivo quando não abriu. Liga sozinha ao aparecer: é aqui (no enquadrar, antes do Standby)
  // que o Android pede a permissão da câmera. A regra de quando desligar é pura (`previaPodeFicar`): app oculto e 60 s parada no enquadrar. O fluxo sai por
  // `fluxo` (bindable) para o Standby emprestar ao gravador: o Android não abre a mesma câmera duas vezes.
  let { camera, ocupado, fluxo = $bindable(null) }: {
    camera: Camera;
    /** Começou (Standby ou gravação): a câmera fica, porque é a imagem que está sendo gravada. */
    ocupado: boolean;
    fluxo?: MediaStream | null;
  } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  const previa = new PreviaDaCamera();
  previa.aoMudar = () => (fluxo = previa.fluxo);
  let ligando = $state(false);
  let motivo = $state<MotivoSemVideo | null>(null);
  let recuouPara = $state<number | null>(null);
  let visivel = $state(!document.hidden);
  let tela = $state<HTMLVideoElement | null>(null);

  /** Abre a câmera. Chamado ao aparecer e pelo botão (depois de 60 s parada, ou de voltar do app oculto). */
  async function ligar() {
    ligando = true;
    motivo = null;
    motivo = await previa.ligar(camera, lerQualidade());
    recuouPara = previa.recuouPara;
    ligando = false;
    fluxo = previa.fluxo;
  }
  function desligar() {
    previa.desligar();
    ligando = false;
    fluxo = null;
    recuouPara = null;
  }
  onMount(() => void ligar());
  onDestroy(desligar);

  const situacao = (paradaHaMs: number) => ({ modoVideo: true, abaAtiva: true, visivel, ocupado, paradaHaMs });
  $effect(() => {
    const aoMudar = () => (visivel = !document.hidden);
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
  });
  // Escondeu o app: desliga já (também cancela uma câmera que ainda abria).
  $effect(() => {
    if ((fluxo || ligando) && !previaPodeFicar(situacao(0))) desligar();
  });
  // Parada no enquadrar: o relógio de 60 s recomeça a cada vez que ela liga (C14: calor e bateria).
  $effect(() => {
    if (!fluxo || ocupado) return;
    const desde = performance.now();
    const id = setTimeout(() => !previaPodeFicar(situacao(performance.now() - desde)) && desligar(), PREVIA_OCIOSA_MS);
    return () => clearTimeout(id);
  });
  $effect(() => {
    if (tela) tela.srcObject = fluxo;
  });
</script>

<div class="previa">
  {#if fluxo}
    {#if recuouPara}<p class="aviso-recuo" role="status">{t("registro.previa_recuou", { altura: recuouPara })}</p>{/if}
    <!-- Sem som (a imagem basta para enquadrar e o som do microfone não volta pelo alto-falante). -->
    <video bind:this={tela} autoplay muted playsinline aria-label={t("registro.previa_aria")}></video>
  {:else}
    <div class="sem-imagem">
      <p>{ligando ? t("registro.previa_ligando") : t("registro.previa_desligada")}</p>
      {#if !ocupado}<button class="botao" onclick={ligar} disabled={ligando}>{t("registro.previa_ligar")}</button>{/if}
      {#if motivo}<p role="status">{t(chaveDaPrevia(motivo))}</p>{/if}
    </div>
  {/if}
</div>

<style>
  /* Ocupa o contêiner inteiro (a camada da tela cheia). `contain`: a pessoa vê o quadro inteiro que será gravado, sem corte; sobra fundo preto. */
  .previa { position: absolute; inset: 0; display: grid; place-items: center; }
  video { width: 100%; height: 100%; object-fit: contain; }
  .aviso-recuo { position: absolute; top: 0.5rem; left: 0.5rem; right: 0.5rem; z-index: 1; margin: 0; padding: 0.4rem 0.6rem; border-radius: 0.5rem; background: var(--superficie); color: var(--texto); font-size: 0.85rem; text-align: center; }
  .sem-imagem { display: grid; gap: 0.8rem; justify-items: center; max-width: 30rem; padding: 6rem 1rem; text-align: center; }
  .sem-imagem p { margin: 0; }
</style>
