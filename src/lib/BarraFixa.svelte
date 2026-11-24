<script lang="ts">
  import type { Snippet } from "svelte";

  // A ação principal da tela, fixa logo ACIMA da barra de abas (o lugar do "miniplayer" do outro projeto): Standby, Parar ou Nova tentativa ficam sempre ao
  // alcance do polegar, sem rolar. Publica a própria altura em --altura-miniplayer, que o layout soma ao espaço do fim da página (nada fica coberto).
  // Com a barra de abas na lateral (celular deitado), fica embaixo, ao lado dela (--largura-trilho).
  let { children }: { children: Snippet } = $props();
  let altura = $state(0);

  $effect(() => {
    const raiz = document.documentElement.style;
    raiz.setProperty("--altura-miniplayer", `${altura}px`);
    return () => raiz.removeProperty("--altura-miniplayer");
  });
</script>

<div class="barra-fixa" bind:offsetHeight={altura}>
  <div class="coluna miolo">{@render children()}</div>
</div>

<style>
  .barra-fixa {
    position: fixed; left: var(--largura-trilho, 0rem); right: 0; bottom: var(--altura-navegacao, 0rem); z-index: 14;
    background: var(--fundo); border-top: 0.0625rem solid var(--borda);
    padding: 0.5rem 0 calc(0.5rem + var(--inset-miniplayer, 0rem));
  }
  .miolo { display: grid; gap: 0.5rem; }
</style>
