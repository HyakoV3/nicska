<script lang="ts">
  import type { Snippet } from "svelte";

  // Estados de tela sem conteúdo: carregando (com indicador) ou vazio (com ação opcional).
  let {
    tipo,
    texto,
    acao,
  }: { tipo: "carregando" | "vazio"; texto: string; acao?: Snippet } = $props();
</script>

<div class="estado" role="status">
  {#if tipo === "carregando"}<span class="giro" aria-hidden="true"></span>{/if}
  <p>{texto}</p>
  {#if acao}<div class="acao">{@render acao()}</div>{/if}
</div>

<style>
  .estado { display: flex; flex-direction: column; align-items: center; gap: 0.8rem; padding: 2rem 1rem; text-align: center; }
  p { margin: 0; color: var(--suave); line-height: 1.5; }
  .giro {
    width: 1.75rem; height: 1.75rem; border-radius: 50%;
    border: 0.1875rem solid var(--borda); border-top-color: var(--acento);
    animation: gira 0.9s linear infinite;
  }
  @keyframes gira { to { transform: rotate(360deg); } }
  /* Sem movimento: o texto "Carregando…" já comunica o estado. */
  @media (prefers-reduced-motion: reduce) { .giro { animation: none; } }
</style>
