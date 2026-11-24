<script lang="ts">
  import Aviso from "$lib/Aviso.svelte";
  import Barra from "$lib/Barra.svelte";
  import { i18n } from "$lib/i18n/index.svelte";
  import { usarVoltar } from "$lib/navegacao";
  import SpikeAmbiente from "./SpikeAmbiente.svelte";
  import SpikeArmazenamento from "./SpikeArmazenamento.svelte";
  import SpikeCamera from "./SpikeCamera.svelte";
  import SpikeCicloDeVida from "./SpikeCicloDeVida.svelte";
  import SpikeCompartilhar from "./SpikeCompartilhar.svelte";
  import SpikeGravacao from "./SpikeGravacao.svelte";
  import SpikeRelatorio from "./SpikeRelatorio.svelte";

  // SPIKE S1 (EXPERIMENTAL, descartável): a tela escondida de medição de câmera e vídeo. Fora da navegação principal; só um link discreto em Ajustes. Veja docs/spike-video.md.
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const voltar = usarVoltar();
</script>

<svelte:head><title>{t("spike.titulo")} · Nicska</title></svelte:head>

<Barra titulo={t("spike.titulo")} {voltar} rotuloVoltar={t("nav.voltar")} />

<main class="coluna conteudo">
  <Aviso tipo="erro"><strong>{t("spike.aviso_titulo")}</strong><br />{t("spike.aviso")}</Aviso>
  <SpikeAmbiente />
  <SpikeCamera />
  <SpikeGravacao />
  <SpikeArmazenamento />
  <SpikeCompartilhar />
  <SpikeCicloDeVida />
  <SpikeRelatorio />
</main>
