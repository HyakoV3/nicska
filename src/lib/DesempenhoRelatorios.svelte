<script lang="ts">
  import Aviso from "./Aviso.svelte";
  import { entregarArquivo, hoje, mensagemDeErro, versaoDoApp } from "./dados";
  import { data } from "./formatosHistorico";
  import { i18n } from "./i18n/index.svelte";
  import { apagarRelatoriosDeDesempenho, lerRelatoriosDeDesempenho } from "./preferencias";
  import { arquivoDeRelatorios, fpsConfigurado, fpsRealDaFase, resumoDaFase, type FaseDeMedicao } from "./video/desempenho";

  // Ajustes → Diagnóstico de desempenho: a lista dos relatórios guardados (data, qualidade, o que estava ligado e, por fase, o p95 e os quadros acima de 50 ms),
  // o botão que entrega TODOS num arquivo .json (a folha de compartilhar do aparelho; no navegador, baixa) e o que apaga (com um segundo toque).
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let relatorios = $state(lerRelatoriosDeDesempenho());
  let aviso = $state<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  let apagando = $state(false);

  const FASES = [["standby", "ajustes.desempenho_antes"], ["correndo", "ajustes.desempenho_correndo"]] as const satisfies readonly (readonly [FaseDeMedicao, Parameters<typeof i18n.t>[0]])[];
  const quando = (iso: string) => {
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? data(ms) : iso;
  };
  const faseTexto = (r: (typeof relatorios)[number], fase: FaseDeMedicao, rotulo: Parameters<typeof i18n.t>[0]) => {
    const f = resumoDaFase(r, fase);
    const fps = fpsRealDaFase(r, fase); // o ENTREGUE pela câmera (o configurado vai na linha própria)
    return fps === null ? t("ajustes.desempenho_fase", { fase: t(rotulo), p95: f.p95Ms.toFixed(1), lentos: f.acima50, n: f.n }) : t("ajustes.desempenho_fase_fps", { fase: t(rotulo), p95: f.p95Ms.toFixed(1), lentos: f.acima50, n: f.n, fps });
  };
  const marcas = (r: (typeof relatorios)[number]) =>
    [`${r.qualidadePedida.altura}p${r.qualidadePedida.fps}`, t("ajustes.lab_taxa_hz", { n: r.laboratorio?.taxaHz ?? 30 }), r.laboratorio?.overlayAoVivo === false ? t("ajustes.desempenho_sem_overlay") : "", r.laboratorio?.gravarVideo === false ? t("ajustes.desempenho_sem_video") : ""]
      .filter(Boolean)
      .join(" · ");

  async function compartilhar() {
    aviso = null;
    apagando = false;
    try {
      const texto = JSON.stringify(arquivoDeRelatorios(lerRelatoriosDeDesempenho(), versaoDoApp(), new Date().toISOString()), null, 2);
      await entregarArquivo(new Blob([texto], { type: "application/json" }), `nicska-desempenho-${hoje()}.json`);
      aviso = { tipo: "sucesso", texto: t("ajustes.desempenho_compartilhado") };
    } catch (e) {
      aviso = { tipo: "erro", texto: mensagemDeErro(e, t) };
    }
  }
  function apagar() {
    if (!apagando) return void (apagando = true);
    apagarRelatoriosDeDesempenho();
    relatorios = [];
    apagando = false;
    aviso = null;
  }
</script>

<p class="meta">{t("ajustes.desempenho_ajuda")}</p>
{#if relatorios.length === 0}
  <p class="meta">{t("ajustes.desempenho_vazio")}</p>
{:else}
  <ul class="lista">
    {#each relatorios as r (r.quando)}
      <li>
        <strong>{quando(r.quando)}</strong> <span class="meta">{marcas(r)}</span>
        {#each FASES as [fase, rotulo] (fase)}<span class="linha">{faseTexto(r, fase, rotulo)}</span>{/each}
        {#if fpsConfigurado(r) !== null}<span class="meta">{t("ajustes.desempenho_configurado", { fps: fpsConfigurado(r) ?? 0 })}</span>{/if}
      </li>
    {/each}
  </ul>
  <div class="botoes">
    <button class="botao" onclick={compartilhar}>{t("ajustes.desempenho_compartilhar")}</button>
    <button class="botao" class:perigo={apagando} onclick={apagar}>{apagando ? t("ajustes.desempenho_apagar_certeza") : t("ajustes.desempenho_apagar")}</button>
  </div>
{/if}
{#if aviso}<Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>{/if}

<style>
  .meta { margin: 0.4rem 0; }
  .lista { list-style: none; margin: 0.4rem 0 0.8rem; padding: 0; display: grid; gap: 0.2rem; }
  .lista li { display: grid; gap: 0.1rem; padding: 0.6rem 0; border-top: 0.0625rem solid var(--borda-controle); }
  .lista li:first-child { border-top: 0; }
  .linha { font-size: 0.9rem; font-variant-numeric: tabular-nums; }
  .botoes { display: grid; gap: 0.5rem; }
</style>
