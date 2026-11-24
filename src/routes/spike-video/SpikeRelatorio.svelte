<script lang="ts">
  import { i18n } from "$lib/i18n/index.svelte";
  import { copiarTexto } from "$lib/spike/copiar";
  import { compartilharVideoDeTeste } from "$lib/spike/compartilhar";
  import { apagarRelatorio, estado } from "$lib/spike/estado.svelte";
  import { montarRelatorio, nomeDoRelatorio } from "$lib/spike/relatorio";
  import SpikePasso from "./SpikePasso.svelte";

  // SPIKE passo 7 (EXPERIMENTAL, descartável): o relatório JSON, copiável e compartilhável. Sem áudio, sem vídeo.
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let campo = $state<HTMLTextAreaElement>();
  let aviso = $state<string | null>(null);
  const texto = $derived(JSON.stringify(montarRelatorio({ quando: new Date(), ambiente: estado.ambiente, passos: estado.passos, erros: estado.erros }), null, 2));

  async function copiar() {
    const como = await copiarTexto(texto, campo ?? null);
    aviso = t(como === "clipboard" ? "spike.p7.copiado" : como === "selecao" ? "spike.p7.selecionado" : "spike.p7.falhou");
  }

  async function compartilhar() {
    const r = await compartilharVideoDeTeste(new Blob([texto], { type: "application/json" }), nomeDoRelatorio(new Date()), "Nicska spike");
    aviso = r.resultado === "ok" || r.resultado === "cancelado" ? null : t("spike.p7.falhou");
  }
</script>

<SpikePasso titulo={t("spike.p7.titulo")} texto={t("spike.p7.texto")}>
  <button class="botao primario" onclick={copiar}>{t("spike.p7.copiar")}</button>
  <button class="botao" onclick={compartilhar}>{t("spike.p7.compartilhar")}</button>
  <button class="botao perigo" onclick={apagarRelatorio}>{t("spike.p7.limpar")}</button>
  {#if aviso}<p role="status">{aviso}</p>{/if}
  <textarea bind:this={campo} readonly rows="10" value={texto} aria-label={t("spike.p7.titulo")}></textarea>
</SpikePasso>

<style>
  textarea {
    flex: 1 1 100%; box-sizing: border-box; padding: 0.5rem; font: 0.75rem/1.4 ui-monospace, monospace; border-radius: 0.75rem;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
</style>
