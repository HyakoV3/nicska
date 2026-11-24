<script lang="ts">
  import type { ResumoDoPercurso } from "./armazenamento";
  import type { Percurso } from "./documento";
  import { data, seg } from "./formatosHistorico";
  import { i18n } from "./i18n/index.svelte";

  // A lista de percursos do Histórico, cada um com quantas tentativas, o melhor tempo e a última. Tocar abre o percurso.
  let { percursos, resumos, onabrir }: { percursos: Percurso[]; resumos: Record<string, ResumoDoPercurso>; onabrir: (p: Percurso) => void } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
</script>

<h2>{t("historico.percursos")}</h2>
<ul class="percursos">
  {#each percursos as p (p.id)}
    {@const m = resumos[p.id]}
    <li>
      <button class="percurso" onclick={() => onabrir(p)}>
        <strong>{p.nome}</strong>
        <span class="meta">{i18n.tn("plural.tentativas", m?.tentativas ?? 0)}{#if m?.melhorMs != null} · {t("historico.melhor", { tempo: seg(m.melhorMs) })}{/if}{#if m?.ultima} · {t("historico.ultima", { data: data(m.ultima) })}{/if}</span>
      </button>
    </li>
  {/each}
</ul>

<style>
  h2 { margin: 0.6rem 0 0.2rem; font-size: 1.1rem; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
  .percurso {
    width: 100%; display: grid; gap: 0.15rem; text-align: left; min-height: 3.5rem; padding: 0.6rem 0.8rem; font: inherit; color: var(--texto); cursor: pointer;
    border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie);
  }
</style>
