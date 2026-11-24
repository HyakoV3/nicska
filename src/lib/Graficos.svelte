<script lang="ts">
  import Barras from "./Barras.svelte";
  import Grafico from "./Grafico.svelte";
  import { agruparEmSessoes, type TentativaGuardada } from "./documento";
  import { distribuicao, resumoDaSessao } from "./estatisticas";
  import { i18n } from "./i18n/index.svelte";
  import { formatarSegundos, resumir } from "./tentativa";

  // Os gráficos de um percurso (Etapa 6): a evolução por sessão, os splits de uma tentativa (onde estão as transições e recargas) e a comparação de até 3 sessões
  // (medidas, tempo médio até cada disparo e distribuição dos splits). Tudo calculado das tentativas guardadas, offline.
  // `secao` escolhe o que aparece (as abas internas do percurso, docs/archive/roadmap-ux-ui.md 3.1): "visao" = evolução; "analises" = splits de uma tentativa; "comparar" = sessões, tabela e os gráficos da comparação.
  // O componente fica montado entre as abas, então a escolha de sessões e de tentativa sobrevive à troca.
  let { tentativas, secao = "visao" }: { tentativas: TentativaGuardada[]; secao?: "visao" | "analises" | "comparar" } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const seg = (ms: number) => formatarSegundos(ms, i18n.idioma);
  const diaCurto = (dia: string) => dia.split("-").reverse().slice(0, 2).join("/");
  const hora = (ms: number) => new Intl.DateTimeFormat(i18n.idioma, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));

  // Da mais antiga para a mais nova (o tempo corre para a direita); só as sessões com alguma tentativa com disparos.
  const sessoes = $derived(agruparEmSessoes(tentativas).map((s) => ({ ...s, r: resumoDaSessao(s.dia, s.tentativas) })).filter((s) => s.r.tentativas > 0).reverse());
  const comSplits = $derived(tentativas.filter((x) => x.disparos_ms.length >= 2).sort((a, b) => b.quando - a.quando));

  // ---- 2. splits de uma tentativa ----
  let escolhidaId = $state<string | null>(null);
  const escolhida = $derived(comSplits.find((x) => x.id === escolhidaId) ?? comSplits[0] ?? null);
  const splitsDaEscolhida = $derived(escolhida ? resumir(escolhida.disparos_ms).splits : []);
  const maiorIndice = $derived(splitsDaEscolhida.length ? splitsDaEscolhida.indexOf(Math.max(...splitsDaEscolhida)) : -1);

  // ---- 3. comparar sessões ----
  const MAXIMO = 3;
  let marcadas = $state<string[] | null>(null);
  const selecionadas = $derived(marcadas ?? sessoes.slice(-MAXIMO).map((s) => s.dia));
  const doComparar = $derived(sessoes.filter((s) => selecionadas.includes(s.dia)));
  function alternar(dia: string) {
    const atual = [...selecionadas];
    marcadas = atual.includes(dia) ? atual.filter((d) => d !== dia) : atual.length < MAXIMO ? [...atual, dia] : atual;
  }
  const rotuloSessao = (s: (typeof sessoes)[number]) => diaCurto(s.dia);

  const medidas = $derived(
    [
      ["m_tentativas", (s: (typeof sessoes)[number]) => String(s.r.tentativas)],
      ["m_melhor_total", (s: (typeof sessoes)[number]) => fmt(s.r.total.melhor)],
      ["m_media_total", (s: (typeof sessoes)[number]) => fmt(s.r.total.media)],
      ["m_mediana_total", (s: (typeof sessoes)[number]) => fmt(s.r.total.mediana)],
      ["m_desvio_total", (s: (typeof sessoes)[number]) => fmt(s.r.total.desvio)],
      ["m_primeiro", (s: (typeof sessoes)[number]) => fmt(s.r.primeiro.media)],
      ["m_split_medio", (s: (typeof sessoes)[number]) => fmt(s.r.splits.media)],
      ["m_split_mediana", (s: (typeof sessoes)[number]) => fmt(s.r.splits.mediana)],
      ["m_split_desvio", (s: (typeof sessoes)[number]) => fmt(s.r.splits.desvio)],
      ["m_split_melhor", (s: (typeof sessoes)[number]) => fmt(s.r.splits.melhor)],
    ] as const,
  );
  const fmt = (ms: number | null) => (ms === null ? "–" : `${seg(ms)} s`);

  // Tempo médio até cada disparo: x = número do disparo, y = média do instante desse disparo nas tentativas da sessão que chegaram até ele.
  const acumulado = $derived(
    doComparar.map((s) => {
      const maxN = Math.max(0, ...s.tentativas.map((x) => x.disparos_ms.length));
      return {
        nome: rotuloSessao(s),
        pontos: Array.from({ length: maxN }, (_, i) => {
          const v = s.tentativas.filter((x) => x.disparos_ms.length > i).map((x) => x.disparos_ms[i]);
          return { x: i + 1, y: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null };
        }),
      };
    }),
  );
  const maxDisparos = $derived(Math.max(0, ...doComparar.flatMap((s) => s.tentativas.map((x) => x.disparos_ms.length))));
  const dist = $derived(distribuicao(doComparar.map((s) => s.tentativas.flatMap((x) => resumir(x.disparos_ms).splits))));
  const distSeries = $derived(doComparar.map((s, i) => ({ nome: rotuloSessao(s), pontos: dist.porcentagens[i].map((y, k) => ({ x: k + 1, y })) })));
  const pct = (v: number) => `${new Intl.NumberFormat(i18n.idioma, { maximumFractionDigits: 0 }).format(v)}%`;
</script>

<section class="graficos" aria-label={t(`historico.aba_${secao}`)}>
  {#if sessoes.length === 0}
    <p class="meta">{t("graficos.pouco")}</p>
  {:else if secao === "visao"}
    {#if sessoes.length >= 2}
      <Grafico
        titulo={t("graficos.evolucao")}
        unidadeY="s"
        rotulosX={sessoes.map(rotuloSessao)}
        series={[
          { nome: t("graficos.total_media"), pontos: sessoes.map((s, i) => ({ x: i + 1, y: s.r.total.media })) },
          { nome: t("graficos.primeiro_media"), pontos: sessoes.map((s, i) => ({ x: i + 1, y: s.r.primeiro.media })) },
        ]}
        formatarY={(v) => seg(v)}
      />
    {:else}
      <p class="meta">{t("graficos.so_uma_sessao")}</p>
    {/if}
  {:else if secao === "analises"}
    {#if escolhida}
      <label class="campo">
        <span>{t("graficos.tentativa")}</span>
        <select value={escolhida.id} onchange={(e) => (escolhidaId = e.currentTarget.value)}>
          {#each comSplits as x (x.id)}<option value={x.id}>{diaCurto(x.data.slice(0, 10))} {hora(x.quando)} · {seg(x.disparos_ms.at(-1)!)} s</option>{/each}
        </select>
      </label>
      <Barras
        titulo={t("graficos.splits")}
        unidade="s"
        rotuloX={t("graficos.splits_eixo")}
        barras={splitsDaEscolhida.map((v, i) => ({ rotulo: String(i + 2), valor: v, destaque: i === maiorIndice, descricao: t("graficos.split_desc", { a: i + 1, b: i + 2 }) }))}
        formatar={(v) => seg(v)}
      />
    {:else}
      <p class="meta">{t("graficos.sem_splits")}</p>
    {/if}
  {:else}
    <h3>{t("graficos.comparar")}</h3>
    <p class="meta">{t("graficos.comparar_ajuda")}</p>
    <ul class="sessoes">
      {#each [...sessoes].reverse() as s (s.dia)}
        {@const marcada = selecionadas.includes(s.dia)}
        <li>
          <label class:ativo={marcada}>
            <input type="checkbox" checked={marcada} disabled={!marcada && selecionadas.length >= MAXIMO} onchange={() => alternar(s.dia)} />
            <span>{t("graficos.sessao", { dia: diaCurto(s.dia), n: i18n.tn("plural.tentativas", s.r.tentativas) })}</span>
          </label>
        </li>
      {/each}
    </ul>

    {#if doComparar.length === 0}
      <p class="meta">{t("graficos.marque")}</p>
    {:else}
      <div class="rolagem">
        <table>
          <caption class="so-leitor">{t("graficos.comparar")}</caption>
          <thead><tr><th scope="col">{t("graficos.col_medida")}</th>{#each doComparar as s (s.dia)}<th scope="col">{rotuloSessao(s)}</th>{/each}</tr></thead>
          <tbody>
            {#each medidas as [chave, f] (chave)}
              <tr><th scope="row">{t(`graficos.${chave}`)}</th>{#each doComparar as s (s.dia)}<td>{f(s)}</td>{/each}</tr>
            {/each}
          </tbody>
        </table>
      </div>
      <Grafico
        titulo={t("graficos.acumulado")}
        unidadeY="s"
        rotulosX={Array.from({ length: maxDisparos }, (_, i) => String(i + 1))}
        series={acumulado}
        formatarY={(v) => seg(v)}
        zeroNoEixo
      />
      <Grafico
        titulo={t("graficos.distribuicao")}
        unidadeY="%"
        rotulosX={dist.faixas.map((f) => seg(f.iniMs))}
        series={distSeries}
        formatarY={pct}
        zeroNoEixo
      />
    {/if}
  {/if}
</section>

<style>
  .graficos { display: grid; gap: 0.4rem; margin: 0.6rem 0; }
  .graficos > :global(*) { min-width: 0; }
  h3 { margin: 0.8rem 0 0.2rem; font-size: 1rem; }
  .campo { display: grid; gap: 0.2rem; }
  .campo span { font-size: 0.9rem; color: var(--suave); }
  select { width: 100%; box-sizing: border-box; min-height: 3rem; font-size: 1rem; padding: 0 0.6rem; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); }
  .sessoes { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .sessoes label { position: relative; display: block; }
  .sessoes input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  .sessoes span { display: flex; align-items: center; min-height: 3rem; padding: 0 0.8rem; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); }
  .sessoes .ativo span { border: 0.125rem solid var(--acento); font-weight: 700; }
  .sessoes .ativo span::before { content: "✓ "; white-space: pre; }
  .sessoes input:focus-visible + span { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
  .sessoes input:disabled + span { opacity: 0.55; }
  .rolagem { overflow-x: auto; }
  table { border-collapse: collapse; font-variant-numeric: tabular-nums; width: 100%; }
  th, td { padding: 0.35rem 0.5rem; text-align: right; border-top: 0.0625rem solid var(--borda); }
  td { white-space: nowrap; }
  th[scope="row"], thead th:first-child { text-align: left; }
</style>
