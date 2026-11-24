<script lang="ts">
  import { i18n } from "$lib/i18n/index.svelte";
  import { pararFluxo } from "$lib/spike/camera";
  import { medirCamera } from "$lib/spike/cameraMedicao";
  import { anexar, registrarErro, registrarLiberador } from "$lib/spike/estado.svelte";
  import type { Entrada } from "$lib/spike/relatorio";
  import { outroLado, type Lado } from "$lib/spike/restricoes";
  import SpikePasso from "./SpikePasso.svelte";

  // SPIKE passo 2 (EXPERIMENTAL, descartável): abrir a câmera, medir e mostrar a pré-visualização. Negar a permissão vira um erro legível, sem travar a tela.
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let previa = $state<HTMLVideoElement>();
  let fluxo: MediaStream | null = null;
  let lado = $state<Lado>("environment");
  let ultimoFps = 30;
  let ocupado = $state(false);
  let aberta = $state(false);
  let erro = $state<string | null>(null);
  let ultimo = $state<Entrada | null>(null);

  function fechar() {
    pararFluxo(fluxo);
    fluxo = null;
    aberta = false;
  }

  async function medir(fps: number) {
    if (!previa) return;
    fechar();
    ocupado = true;
    erro = null;
    ultimoFps = fps;
    try {
      const r = await medirCamera({ lado, fps }, previa);
      fluxo = r.fluxo;
      aberta = true;
      ultimo = r.entrada;
      anexar("camera", r.entrada);
    } catch (e) {
      const falha = registrarErro("camera", e);
      erro = t("spike.erro", { ...falha });
      anexar("camera", { passo: "camera", pedido: { lado, fps }, erro: falha });
    } finally {
      ocupado = false;
    }
  }

  const trocar = () => {
    lado = outroLado(lado);
    return medir(ultimoFps);
  };

  $effect(() => registrarLiberador(fechar));
  $effect(() => fechar);
</script>

<SpikePasso titulo={t("spike.p2.titulo")} texto={t("spike.p2.texto")} {ocupado} {erro} resultado={ultimo}>
  <button class="botao primario" onclick={() => medir(30)} disabled={ocupado}>{t("spike.p2.abrir30")}</button>
  <button class="botao" onclick={() => medir(60)} disabled={ocupado}>{t("spike.p2.abrir60")}</button>
  <button class="botao" onclick={trocar} disabled={ocupado}>{t("spike.p2.trocar")}</button>
  <button class="botao" onclick={fechar} disabled={!aberta}>{t("spike.p2.fechar")}</button>
</SpikePasso>
<!-- svelte-ignore a11y_media_has_caption -->
<video class="previa" class:oculta={!aberta} bind:this={previa} muted playsinline></video>

<style>
  .previa { display: block; width: 100%; max-height: 16rem; margin: -0.6rem 0 1.2rem; border-radius: 0.75rem; background: var(--superficie); object-fit: contain; }
  .oculta { display: none; }
</style>
