<script lang="ts">
  // Abas internas de uma tela (ex.: Visão geral | Tentativas | Análises | Comparar), no topo do conteúdo. O pai desenha os painéis
  // (`<div role="tabpanel" id="painel-<id>" aria-labelledby="aba-<id>" hidden={...}>`). Teclado: setas, Home e End movem a seleção (WAI-ARIA Tabs).
  type Aba = { id: string; rotulo: string };
  let { abas, selecionada = $bindable(), rotulo, prefixo = "sec" }: { abas: Aba[]; selecionada: string; rotulo: string; prefixo?: string } = $props();

  function teclar(e: KeyboardEvent) {
    const i = abas.findIndex((a) => a.id === selecionada);
    const alvo = e.key === "ArrowRight" ? (i + 1) % abas.length : e.key === "ArrowLeft" ? (i - 1 + abas.length) % abas.length : e.key === "Home" ? 0 : e.key === "End" ? abas.length - 1 : -1;
    if (alvo < 0) return;
    e.preventDefault();
    selecionada = abas[alvo].id;
    document.getElementById(`${prefixo}-aba-${selecionada}`)?.focus();
  }
</script>

<div class="secoes" role="tablist" aria-label={rotulo}>
  {#each abas as a (a.id)}
    <button
      type="button"
      role="tab"
      id={`${prefixo}-aba-${a.id}`}
      aria-selected={selecionada === a.id}
      aria-controls={`${prefixo}-painel-${a.id}`}
      tabindex={selecionada === a.id ? 0 : -1}
      class:ativa={selecionada === a.id}
      onclick={() => (selecionada = a.id)}
      onkeydown={teclar}>{a.rotulo}</button
    >
  {/each}
</div>

<style>
  .secoes { display: flex; flex-wrap: wrap; gap: 0.25rem; border-bottom: 0.0625rem solid var(--borda); }
  button {
    flex: 1 1 auto; min-height: 3rem; padding: 0 0.35rem; font-size: 0.95rem; color: var(--suave); background: none; cursor: pointer;
    border: 0; border-bottom: 0.1875rem solid transparent; border-radius: 0.5rem 0.5rem 0 0;
  }
  button.ativa { color: var(--texto); font-weight: 700; border-bottom-color: var(--acento); }
  button:focus-visible { outline: 0.1875rem solid var(--foco); outline-offset: -0.1875rem; }
</style>
