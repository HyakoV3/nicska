<script lang="ts">
  import Aviso from "./Aviso.svelte";
  import Segmentos from "./Segmentos.svelte";
  import { i18n } from "./i18n/index.svelte";
  import { TAXAS_DO_CRONOMETRO, lerLaboratorio, salvarLaboratorio, type PrefsLaboratorio, type TaxaDoCronometro } from "./preferencias";

  // Ajustes → Laboratório: chaves SÓ PARA DIAGNÓSTICO da gravação ao vivo na tela cheia (overlay ligado ou não, taxa do cronômetro, medir desempenho, gravar o
  // vídeo ou não), para achar o que trava no aparelho. Valem na próxima gravação; o relatório de cada uma registra os valores usados.
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let prefs = $state<PrefsLaboratorio>(lerLaboratorio());
  const mudar = <K extends keyof PrefsLaboratorio>(k: K, v: PrefsLaboratorio[K]) => {
    prefs[k] = v;
    salvarLaboratorio($state.snapshot(prefs));
  };
</script>

<Aviso tipo="info">{t("ajustes.laboratorio_aviso")}</Aviso>

<label class="opcao"><input type="checkbox" checked={prefs.overlayAoVivo} onchange={(e) => mudar("overlayAoVivo", e.currentTarget.checked)} /> <span>{t("ajustes.lab_overlay")}</span></label>
<p class="meta">{t("ajustes.lab_overlay_ajuda")}</p>

<Segmentos id="lab-taxa" rotulo={t("ajustes.lab_taxa")} opcoes={TAXAS_DO_CRONOMETRO.map((n) => ({ valor: n, texto: t("ajustes.lab_taxa_hz", { n }) }))} valor={prefs.taxaHz} aoMudar={(v: TaxaDoCronometro) => mudar("taxaHz", v)} />
<p class="meta">{t("ajustes.lab_taxa_ajuda")}</p>

<label class="opcao"><input type="checkbox" checked={prefs.medirDesempenho} onchange={(e) => mudar("medirDesempenho", e.currentTarget.checked)} /> <span>{t("ajustes.lab_medir")}</span></label>
<p class="meta">{t("ajustes.lab_medir_ajuda")}</p>

<label class="opcao"><input type="checkbox" checked={prefs.gravarVideo} onchange={(e) => mudar("gravarVideo", e.currentTarget.checked)} /> <span>{t("ajustes.lab_gravar")}</span></label>
<p class="meta">{t("ajustes.lab_gravar_ajuda")}</p>

<style>
  .meta { margin: 0.2rem 0 0.8rem; }
  .opcao { display: flex; align-items: center; gap: 0.6rem; min-height: 3rem; margin-top: 0.4rem; font-weight: 600; }
  .opcao input { width: 1.5rem; height: 1.5rem; flex: none; }
</style>
