<script lang="ts">
  import { i18n } from "$lib/i18n/index.svelte";
  import { coletarAmbiente } from "$lib/spike/ambiente";
  import { estado, registrarErro } from "$lib/spike/estado.svelte";
  import SpikePasso from "./SpikePasso.svelte";

  // SPIKE passo 1 (EXPERIMENTAL, descartável): o ambiente da WebView.
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let ocupado = $state(false);
  let erro = $state<string | null>(null);

  async function medir() {
    ocupado = true;
    erro = null;
    try {
      estado.ambiente = await coletarAmbiente();
    } catch (e) {
      erro = t("spike.erro", { ...registrarErro("ambiente", e) });
    } finally {
      ocupado = false;
    }
  }
</script>

<SpikePasso titulo={t("spike.p1.titulo")} texto={t("spike.p1.texto")} {ocupado} {erro} resultado={estado.ambiente}>
  <button class="botao primario" onclick={medir} disabled={ocupado}>{t("spike.p1.botao")}</button>
</SpikePasso>
