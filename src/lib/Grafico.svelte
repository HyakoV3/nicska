<script lang="ts">
  import { onMount } from "svelte";
  import { i18n } from "./i18n/index.svelte";
  import { escala } from "./estatisticas";

  // Gráfico de linhas em SVG, sem biblioteca. O tamanho acompanha a largura da tela e a fonte do sistema (tudo em rem, e o SVG é desenhado 1:1 com os pixels, então o
  // texto cresce a 200%). Cada série tem cor, forma de marcador e tracejado diferentes: nunca só a cor. Há sempre a tabela equivalente, num "Ver como tabela".
  type Ponto = { x: number; y: number | null };
  type Serie = { nome: string; pontos: Ponto[] };
  let {
    titulo,
    series,
    rotulosX,
    formatarY,
    unidadeY = "",
    zeroNoEixo = false,
  }: { titulo: string; series: Serie[]; rotulosX: string[]; formatarY: (v: number) => string; unidadeY?: string; zeroNoEixo?: boolean } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  const ESTILOS = [
    { cor: "var(--grafico-a)", forma: "circulo", tracejado: "none" },
    { cor: "var(--grafico-b)", forma: "quadrado", tracejado: "0.6rem 0.3rem" },
    { cor: "var(--grafico-c)", forma: "triangulo", tracejado: "0.15rem 0.3rem" },
    { cor: "var(--grafico-d)", forma: "losango", tracejado: "0.6rem 0.25rem 0.15rem 0.25rem" },
  ] as const;

  let largura = $state(320);
  let rem = $state(16);
  onMount(() => {
    rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  });

  const margem = $derived({ esq: 3.6 * rem, dir: 1.6 * rem, topo: 0.8 * rem, base: 2.6 * rem });
  const altura = $derived(15 * rem);
  const valores = $derived(series.flatMap((s) => s.pontos.map((p) => p.y).filter((y): y is number => y !== null)));
  const eixoY = $derived(valores.length ? escala(zeroNoEixo ? 0 : Math.min(...valores), Math.max(...valores)) : escala(0, 1));
  const n = $derived(rotulosX.length);
  const xDe = (x: number) => margem.esq + (n <= 1 ? (largura - margem.esq - margem.dir) / 2 : ((x - 1) / (n - 1)) * (largura - margem.esq - margem.dir));
  const yDe = (y: number) => margem.topo + (1 - (y - eixoY.min) / (eixoY.max - eixoY.min)) * (altura - margem.topo - margem.base);
  /** No máximo ~6 rótulos no eixo X, para não se sobreporem. */
  const passoX = $derived(Math.max(1, Math.ceil(n / Math.max(2, Math.floor((largura - margem.esq) / (4.5 * rem))))));

  function caminho(s: Serie): string {
    const pontos = [...s.pontos].sort((a, b) => a.x - b.x);
    // "L" continua o traço; depois de uma lacuna (y nulo) ou no começo é "M".
    return pontos.map((p, i) => (p.y === null ? "" : `${i > 0 && pontos[i - 1].y !== null ? "L" : "M"}${xDe(p.x).toFixed(1)} ${yDe(p.y).toFixed(1)}`)).join("");
  }
  /** O marcador de cada ponto, centrado em (cx, cy), com raio r. */
  function marcador(forma: (typeof ESTILOS)[number]["forma"], cx: number, cy: number, r: number): string {
    if (forma === "quadrado") return `M${cx - r} ${cy - r}h${2 * r}v${2 * r}h${-2 * r}z`;
    if (forma === "triangulo") return `M${cx} ${cy - r * 1.2}L${cx + r * 1.15} ${cy + r * 0.9}H${cx - r * 1.15}z`;
    if (forma === "losango") return `M${cx} ${cy - r * 1.3}L${cx + r * 1.3} ${cy}L${cx} ${cy + r * 1.3}L${cx - r * 1.3} ${cy}z`;
    return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
  }
  const valorEm = (s: Serie, x: number) => s.pontos.find((p) => p.x === x)?.y ?? null;
</script>

<figure class="grafico">
  <figcaption>{titulo}{#if unidadeY}&nbsp;<span class="unidade">({unidadeY})</span>{/if}</figcaption>
  {#if valores.length === 0}
    <p class="meta">{t("grafico.sem_dados")}</p>
  {:else}
    <div class="area" bind:clientWidth={largura}>
      <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={`${titulo}: ${series.map((s) => s.nome).join(", ")}`}>
        {#each eixoY.marcas as m (m)}
          <line x1={margem.esq} x2={largura - margem.dir} y1={yDe(m)} y2={yDe(m)} class="grade" />
          <text x={margem.esq - 0.4 * rem} y={yDe(m)} class="rotulo" text-anchor="end" dominant-baseline="middle">{formatarY(m)}</text>
        {/each}
        {#each rotulosX as r, i (i)}
          {#if i % passoX === 0 || i === n - 1}
            <text x={xDe(i + 1)} y={altura - 0.7 * rem} class="rotulo" text-anchor="middle">{r}</text>
          {/if}
        {/each}
        {#each series as s, i (s.nome)}
          {@const e = ESTILOS[i % ESTILOS.length]}
          <path d={caminho(s)} class="linha" style:stroke={e.cor} style:stroke-dasharray={e.tracejado} />
          {#each s.pontos as p (p.x)}
            {#if p.y !== null}<path d={marcador(e.forma, xDe(p.x), yDe(p.y), 0.32 * rem)} class="marca" style:fill={e.cor} />{/if}
          {/each}
        {/each}
      </svg>
    </div>
    <ul class="legenda">
      {#each series as s, i (s.nome)}
        {@const e = ESTILOS[i % ESTILOS.length]}
        <li>
          <svg width={1.6 * rem} height={1.1 * rem} aria-hidden="true">
            <line x1="0" x2={1.6 * rem} y1={0.55 * rem} y2={0.55 * rem} class="linha" style:stroke={e.cor} style:stroke-dasharray={e.tracejado} />
            <path d={marcador(e.forma, 0.8 * rem, 0.55 * rem, 0.3 * rem)} class="marca" style:fill={e.cor} />
          </svg>
          {s.nome}
        </li>
      {/each}
    </ul>
    <details>
      <summary>{t("grafico.tabela")}</summary>
      <div class="rolagem">
        <table>
          <caption class="so-leitor">{titulo}</caption>
          <thead><tr><th scope="col"></th>{#each series as s (s.nome)}<th scope="col">{s.nome}</th>{/each}</tr></thead>
          <tbody>
            {#each rotulosX as r, i (i)}
              <tr>
                <th scope="row">{r}</th>
                {#each series as s (s.nome)}{@const v = valorEm(s, i + 1)}<td>{v === null ? "–" : formatarY(v)}</td>{/each}
              </tr>
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
  .linha { fill: none; stroke-width: 2.5; stroke-linejoin: round; }
  .marca { stroke: var(--superficie); stroke-width: 1; }
  .legenda { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; list-style: none; margin: 0.4rem 0; padding: 0; font-size: 0.9rem; }
  .legenda li { display: inline-flex; align-items: center; gap: 0.4rem; }
  .legenda svg { display: inline-block; }
  details { margin-top: 0.3rem; }
  summary { cursor: pointer; min-height: 2.75rem; display: flex; align-items: center; color: var(--acento); }
  .rolagem { overflow-x: auto; }
  table { border-collapse: collapse; font-variant-numeric: tabular-nums; width: 100%; }
  th, td { padding: 0.35rem 0.5rem; text-align: right; border-top: 0.0625rem solid var(--borda); }
  td { white-space: nowrap; }
  th[scope="row"], thead th:first-child { text-align: left; }
</style>
