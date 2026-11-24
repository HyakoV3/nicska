<script lang="ts">
  import { armazenamento } from "./armazenamento";
  import Avatar from "./Avatar.svelte";
  import type { Atirador, Percurso } from "./documento";
  import { i18n } from "./i18n/index.svelte";
  import { divisoesPresentes, ranking, type Linha, type Ranking } from "./ranking";
  import { formatarSegundos } from "./tentativa";

  // O ranking de um percurso entre o atirador deste aparelho e quem foi importado (Etapa 9). Só aparece se há tentativas de outra pessoa.
  let { percurso, eu, versao = 0 }: { percurso: Percurso; eu: Atirador; versao?: number } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  let divisao = $state("");
  let dados = $state<{ r: Ranking; divisoes: string[]; temOutros: boolean } | null>(null);

  $effect(() => {
    const p = percurso.id;
    void versao;
    const d = divisao;
    let vivo = true;
    carregar({ p, d, vivo: () => vivo });
    return () => (vivo = false);
  });

  async function carregar({ p, d, vivo }: { p: string; d: string; vivo: () => boolean }) {
    const [todas, outros] = await Promise.all([armazenamento.todasDoPercurso(p), armazenamento.atiradores()]);
    if (!vivo()) return;
    const temOutros = todas.some((x) => x.atirador_id !== undefined && x.atirador_id !== eu.id);
    const divisoes = divisoesPresentes(todas, { eu, outros });
    const divisao = divisoes.includes(d) ? d : "";
    dados = { r: ranking(todas, { eu, outros, divisao, disparosMinimos: percurso.disparos_minimos }), divisoes, temOutros };
  }

  const seg = (ms: number | null) => (ms === null ? "–" : formatarSegundos(ms, i18n.idioma));
  /** "3 tentativas, 2 pontuadas": o HF só conta as pontuadas, então a contagem diz quantas são. */
  const detalheContagem = (l: Linha) => [i18n.tn("plural.tentativas", l.tentativas), l.pontuadas > 0 ? i18n.tn("plural.pontuadas", l.pontuadas) : ""].filter(Boolean).join(", ");
  const hf = (v: number | null) => (v === null ? "–" : new Intl.NumberFormat(i18n.idioma, { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(v));
</script>

{#if dados?.temOutros}
  <section class="ranking" aria-labelledby="titulo-ranking">
    <h3 id="titulo-ranking">{t("ranking.titulo")}</h3>
    {#if dados.divisoes.length > 0}
      <label class="campo">
        <span>{t("ranking.divisao")}</span>
        <select bind:value={divisao}>
          <option value="">{t("ranking.todas")}</option>
          {#each dados.divisoes as d (d)}<option value={d}>{d}</option>{/each}
        </select>
      </label>
    {/if}
    <p class="meta">{t(dados.r.criterio === "hf" ? "ranking.criterio_hf" : "ranking.criterio_tempo")}</p>
    <div class="rolagem">
      <table>
        <thead>
          <tr>
            <th scope="col">{t("ranking.pos")}</th>
            <th scope="col">{t("ranking.atirador")}</th>
            <th scope="col">{t("ranking.melhor")}</th>
            <th scope="col">HF</th>
          </tr>
        </thead>
        <tbody>
          {#each dados.r.linhas as l (l.atirador.id)}
            <tr class:eu={l.eu}>
              <td>{l.posicao}º</td>
              <th scope="row">
                <span class="quem"><Avatar id={l.atirador.id} nome={l.atirador.nome} tamanho={2} oculto comFoto={l.eu} />{l.atirador.nome}{l.eu ? ` (${t("ranking.voce")})` : ""}</span>
                <span class="detalhe">{[`${t("ranking.media")} ${seg(l.mediaMs)}`, l.mediaHf !== null ? `${t("ranking.hf_medio")} ${hf(l.mediaHf)}` : "", detalheContagem(l), l.motivos.firmeza ? t("ranking.duvidosas", { n: l.motivos.firmeza }) : "", l.motivos.faltando ? t("ranking.duvidosas_disparos", { n: l.motivos.faltando, min: percurso.disparos_minimos ?? 0 }) : ""].filter(Boolean).join(" · ")}</span>
              </th>
              <td>{seg(l.melhorMs)}</td>
              <td>{hf(l.melhorHf)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="meta">{t("ranking.aviso")}</p>
  </section>
{/if}

<style>
  .ranking { display: grid; gap: 0.5rem; }
  .ranking > :global(*) { min-width: 0; }
  .rolagem { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
  th, td { padding: 0.4rem 0.5rem; text-align: left; border-bottom: 0.0625rem solid var(--borda-controle); vertical-align: top; }
  td { white-space: nowrap; }
  .quem { display: flex; align-items: center; gap: 0.5rem; }
  .detalhe { display: block; font-weight: 400; font-size: 0.85rem; color: var(--suave); }
  .campo { display: grid; gap: 0.2rem; }
  .campo span { font-size: 0.9rem; color: var(--suave); }
  .campo select { width: 100%; box-sizing: border-box; min-height: 3rem; font-size: 1rem; padding: 0 0.6rem; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); }
  tr.eu { background: var(--superficie); font-weight: 600; }
</style>
