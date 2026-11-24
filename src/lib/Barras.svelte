<script lang="ts">
  import { onMount } from "svelte";
  import { i18n } from "./i18n/index.svelte";
  import { escala } from "./estatisticas";

  // Gráfico de barras em SVG (os splits de uma tentativa por número do disparo, ou a distribuição dos splits). A barra em destaque (por exemplo o maior split, onde
  // está a transição ou a recarga) tem contorno grosso e um "▲" em cima, não só cor. A tabela equivalente fica num "Ver como tabela".
  type Barra = { rotulo: string; valor: number; destaque?: boolean; descricao?: string };
  let { titulo, barras, formatar, unidade = "", rotuloX = "" }: { titulo: string; barras: Barra[]; formatar: (v: number) => string; unidade?: string; rotuloX?: string } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  let largura = $state(320);
  let rem = $state(16);
  onMount(() => {
    rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  });
  const margem = $derived({ esq: 3.6 * rem, dir: 1.6 * rem, topo: 1.4 * rem, base: 2.6 * rem });
  const altura = $derived(14 * rem);
  const eixo = $derived(escala(0, Math.max(0, ...barras.map((b) => b.valor)) || 1));
  const area = $derived(largura - margem.esq - margem.dir);
  const larguraBarra = $derived(Math.min(4 * rem, (area / Math.max(1, barras.length)) * 0.7));
  const xDe = (i: number) => margem.esq + ((i + 0.5) / Math.max(1, barras.length)) * area;
  const yDe = (v: number) => margem.topo + (1 - v / eixo.max) * (altura - margem.topo - margem.base);
  const passo = $derived(Math.max(1, Math.ceil(barras.length / Math.max(2, Math.floor(area / (3.2 * rem))))));
</script>

<figure class="grafico">
  <figcaption>{titulo}{#if unidade}&nbsp;<span class="unidade">({unidade})</span>{/if}</figcaption>
  {#if barras.length === 0}
    <p class="meta">{t("grafico.sem_dados")}</p>
  {:else}
    <div class="area" bind:clientWidth={largura}>
      <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={titulo}>
        {#each eixo.marcas as m (m)}
          <line x1={margem.esq} x2={largura - margem.dir} y1={yDe(m)} y2={yDe(m)} class="grade" />
          <text x={margem.esq - 0.4 * rem} y={yDe(m)} class="rotulo" text-anchor="end" dominant-baseline="middle">{formatar(m)}</text>
        {/each}
        {#each barras as b, i (i)}
          <rect x={xDe(i) - larguraBarra / 2} y={yDe(b.valor)} width={larguraBarra} height={Math.max(0, yDe(0) - yDe(b.valor))} class="barra" class:destaque={b.destaque} />
          {#if b.destaque}<text x={xDe(i)} y={yDe(b.valor) - 0.3 * rem} class="rotulo forte" text-anchor="middle">▲</text>{/if}
          {#if i % passo === 0 || i === barras.length - 1}<text x={xDe(i)} y={altura - 0.7 * rem} class="rotulo" text-anchor="middle">{b.rotulo}</text>{/if}
        {/each}
      </svg>
    </div>
    {#if rotuloX}<p class="meta eixo-x">{rotuloX}</p>{/if}
    <details>
      <summary>{t("grafico.tabela")}</summary>
      <div class="rolagem">
        <table>
          <caption class="so-leitor">{titulo}</caption>
          <thead><tr><th scope="col">{rotuloX}</th><th scope="col">{unidade || titulo}</th></tr></thead>
          <tbody>
            {#each barras as b, i (i)}
              <tr class:destaque={b.destaque}><th scope="row">{b.descricao ?? b.rotulo}</th><td>{formatar(b.valor)}{b.destaque ? " ▲" : ""}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  {/if}
</figure>

<style>
  .grafico { margin: 0.6rem 0; min-width: 0; }
  figcaption { font-weight: 600; margin-bottom: 0.3rem; }
  .unidade { font-weight: 400; color: var(--suave); }
  .area { width: 100%; min-width: 0; overflow: hidden; box-sizing: border-box; background: var(--superficie); border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; }
  svg { display: block; max-width: 100%; }
  .grade { stroke: var(--borda); stroke-width: 1; }
  .rotulo { fill: var(--suave); font-size: 0.75rem; }
  .rotulo.forte { fill: var(--texto); font-weight: 700; }
  .barra { fill: var(--grafico-b); }
  .barra.destaque { fill: var(--grafico-a); stroke: var(--texto); stroke-width: 2.5; }
  .eixo-x { margin: 0.2rem 0 0; text-align: center; font-size: 0.85rem; }
  details { margin-top: 0.3rem; }
  summary { cursor: pointer; min-height: 2.75rem; display: flex; align-items: center; color: var(--acento); }
  .rolagem { overflow-x: auto; }
  table { border-collapse: collapse; font-variant-numeric: tabular-nums; width: 100%; }
  th, td { padding: 0.35rem 0.5rem; text-align: right; border-top: 0.0625rem solid var(--borda); }
  td { white-space: nowrap; }
  th[scope="row"], thead th:first-child { text-align: left; }
  tr.destaque { font-weight: 700; }
</style>
