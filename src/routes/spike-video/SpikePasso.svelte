<script lang="ts">
  import type { Snippet } from "svelte";
  import { i18n } from "$lib/i18n/index.svelte";

  // SPIKE (EXPERIMENTAL, descartável): a moldura de um passo: título, instrução, botões (children), erro e o resultado do passo.
  let { titulo, texto, ocupado = false, erro = null, resultado = null, children }: {
    titulo: string; texto: string; ocupado?: boolean; erro?: string | null; resultado?: unknown; children: Snippet;
  } = $props();
</script>

<section class="passo">
  <h2>{titulo}</h2>
  <p class="meta">{texto}</p>
  <div class="botoes">{@render children()}</div>
  {#if ocupado}<p role="status">{i18n.t("spike.medindo")}</p>{/if}
  {#if erro}<p class="erro" role="alert">{erro}</p>{/if}
  {#if resultado}
    <details>
      <summary>{i18n.t("spike.resultado")}</summary>
      <pre>{JSON.stringify(resultado, null, 1)}</pre>
    </details>
  {/if}
</section>

<style>
  .passo { margin: 0 0 1.2rem; padding: 0.9rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); }
  h2 { margin: 0 0 0.4rem; font-size: 1.1rem; }
  .botoes { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.6rem 0; }
  .botoes :global(.botao) { min-height: 3rem; flex: 1 1 10rem; }
  .erro { color: var(--perigo); overflow-wrap: anywhere; }
  summary { min-height: 3rem; display: flex; align-items: center; cursor: pointer; color: var(--acento); }
  pre { margin: 0; max-height: 18rem; overflow: auto; font: 0.75rem/1.4 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
