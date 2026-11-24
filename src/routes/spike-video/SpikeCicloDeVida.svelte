<script lang="ts">
  import { i18n } from "$lib/i18n/index.svelte";
  import { observarCicloDeVida } from "$lib/spike/cicloDeVida";
  import { estado } from "$lib/spike/estado.svelte";
  import SpikePasso from "./SpikePasso.svelte";

  // SPIKE passo 6 / S3 (EXPERIMENTAL, descartável): observa visibilidade, orientação e o estado das trilhas e do gravador; a linha do tempo vai para o relatório.
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  $effect(() => observarCicloDeVida());
  const eventos = $derived(estado.passos.cicloDeVida);
</script>

<SpikePasso titulo={t("spike.p6.titulo")} texto={t("spike.p6.texto")} resultado={eventos.length ? eventos.slice(-15) : null}>
  <p class="meta">{t("spike.p6.eventos", { n: eventos.length })}</p>
</SpikePasso>
