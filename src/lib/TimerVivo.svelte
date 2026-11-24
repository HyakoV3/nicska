<script lang="ts">
  import { i18n } from "./i18n/index.svelte";
  import { formatarSegundos, resumir } from "./tentativa";
  import type { Instantaneo } from "./timer";

  // O que a aba Timer mostra enquanto a tentativa corre: o aviso grande do Standby (durante o atraso) ou o tempo do último disparo, o contador e os splits ao vivo.
  let { snap }: { snap: Instantaneo } = $props();
  const seg = (ms: number) => formatarSegundos(ms, i18n.idioma);
  const resumo = $derived(resumir(snap.disparosMs));
</script>

{#if snap.estado === "atraso"}
  <!-- O aviso de que o Standby começou: grande, parado (nada pisca) e igual nos três idiomas, que é o comando do esporte. -->
  <div class="vivo" aria-hidden="true"><p class="standby-grande">{i18n.t("timer.standby_grande")}</p></div>
{:else}
  <div class="vivo" aria-hidden="true">
    <p class="digitos grande" class:ativo={snap.estado === "escutando"}>{resumo.total === null ? "–,––" : seg(resumo.total)}<span class="unidade"> s</span></p>
    <p class="contador">{i18n.tn("plural.disparos", resumo.n)}</p>
    {#if resumo.splits.length}
      <ol class="splits">
        {#each resumo.splits as sp, i (i)}<li>{seg(sp)}</li>{/each}
      </ol>
    {/if}
  </div>
{/if}

<style>
  .digitos { margin: 0; text-align: center; font-variant-numeric: tabular-nums; font-weight: 700; line-height: 1.1; }
  .digitos.grande { font-size: clamp(3rem, 18vw, 5.5rem); }
  /* Cronômetro em andamento: o tempo em evidência leva a cor de medição (não é o vermelho de erro). */
  .digitos.ativo { color: var(--tempo-ativo); }
  .unidade { font-size: 0.3em; font-weight: 400; color: var(--suave); }
  .contador { margin: 0; text-align: center; font-size: 1.2rem; color: var(--suave); }
  .splits { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4rem 0.9rem; list-style: none; margin: 0.4rem 0 0; padding: 0; font-variant-numeric: tabular-nums; }
  .standby-grande { margin: 0; padding: 1.2rem 0; text-align: center; font-size: clamp(2.6rem, 15vw, 5rem); font-weight: 800; letter-spacing: 0.04em; line-height: 1.05; color: var(--acento); }
</style>
