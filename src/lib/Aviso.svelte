<script lang="ts">
  import type { Snippet } from "svelte";
  import Icone from "./Icone.svelte";

  // Aviso de sucesso, erro ou informação. O tipo aparece por ícone e posição, nunca só por cor.
  let { tipo = "info", children }: { tipo?: "sucesso" | "erro" | "info"; children: Snippet } = $props();
  const letras = { erro: "!", info: "i" } as const;
</script>

<div class={`aviso ${tipo}`} role={tipo === "erro" ? "alert" : "status"}>
  <span class="icone" aria-hidden="true">{#if tipo === "sucesso"}<Icone nome="ok" tamanho={16} />{:else}{letras[tipo]}{/if}</span>
  <div class="texto">{@render children()}</div>
</div>

<style>
  .aviso {
    display: flex; gap: 0.75rem; align-items: flex-start; margin: 0.8rem 0; padding: 0.8rem 0.9rem;
    background: var(--superficie); color: var(--texto);
    border: 0.0625rem solid var(--borda-controle); border-left-width: 0.3125rem; border-radius: 0.75rem;
  }
  .icone {
    flex: none; width: 1.5rem; height: 1.5rem; display: grid; place-items: center; border-radius: 50%;
    font-weight: 700; font-size: 0.9rem; line-height: 1;
  }
  .texto { flex: 1; min-width: 0; line-height: 1.45; overflow-wrap: anywhere; }
  .sucesso { border-left-color: var(--sucesso); }
  .sucesso .icone { background: var(--sucesso); color: var(--superficie); }
  .erro { border-left-color: var(--perigo); }
  .erro .icone { background: var(--perigo); color: var(--superficie); }
  .info { border-left-color: var(--info); }
  .info .icone { background: var(--info); color: var(--superficie); }
</style>
