<script lang="ts">
  import Cartao from "./Cartao.svelte";
  import ControleNumerico from "./ControleNumerico.svelte";
  import { pedirPermissaoDeMovimento } from "./batidas";
  import { TAXA_MINIMA_BOA_HZ, taxaBaixa } from "./taxaDoSensor";
  import { i18n } from "./i18n/index.svelte";
  import { LIMITES_TIMER, type PrefsTimer } from "./preferencias";

  // O cartão de Ajustes da aba Timer: atraso, sensibilidade, tempo morto, silêncio, avisos do Standby, batidas e o diagnóstico da escuta.
  let { prefs, ocupado, mudarPref, diag, taxaSensor = null }: {
    prefs: PrefsTimer;
    ocupado: boolean;
    mudarPref: <K extends keyof PrefsTimer>(k: K, v: PrefsTimer[K]) => void;
    /** O que o aparelho realmente deu à escuta (Etapa 7), lido quando ela começa. */
    diag: { taxa: number; filtros: boolean | null; saidaMs: number } | null;
    /** A taxa real do sensor de movimento (Hz), medida na escuta das batidas; null se ainda não houve leitura. */
    taxaSensor?: number | null;
  } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const L = LIMITES_TIMER;
  const s = (ms: number) => t("timer.unid_s", { n: (ms / 1000).toLocaleString(i18n.idioma) });
  const pct = (v: number) => t("timer.unid_pct", { n: Math.round(v * 100) });
  const ms = (v: number) => t("timer.unid_ms", { n: v });

  let aberto = $state(false);
  let permissaoNegada = $state(false);
  async function escolherBatidas(n: 0 | 2 | 3) {
    permissaoNegada = false;
    if (n > 0 && !(await pedirPermissaoDeMovimento())) {
      permissaoNegada = true;
      return mudarPref("batidas", 0);
    }
    mudarPref("batidas", n);
  }
  const resumo = $derived(t("timer.resumo_ajustes", { min: (prefs.atrasoMinMs / 1000).toLocaleString(i18n.idioma), max: (prefs.atrasoMaxMs / 1000).toLocaleString(i18n.idioma) }));
</script>

<Cartao titulo={t("timer.ajustes")} {resumo} bind:aberto>
  <ControleNumerico rotulo={t("timer.atraso_min")} valor={prefs.atrasoMinMs} min={L.atrasoMs.min} max={L.atrasoMs.max} passo={L.atrasoMs.passo} mostrar={s} desabilitado={ocupado} aoMudar={(v) => mudarPref("atrasoMinMs", v)} />
  <ControleNumerico rotulo={t("timer.atraso_max")} valor={prefs.atrasoMaxMs} min={L.atrasoMs.min} max={L.atrasoMs.max} passo={L.atrasoMs.passo} mostrar={s} desabilitado={ocupado} aoMudar={(v) => mudarPref("atrasoMaxMs", v)} />
  <ControleNumerico rotulo={t("timer.sensibilidade")} valor={prefs.sensibilidade} min={L.sensibilidade.min} max={L.sensibilidade.max} passo={L.sensibilidade.passo} mostrar={pct} ajuda={t("timer.ajuda_sensibilidade")} desabilitado={ocupado} aoMudar={(v) => mudarPref("sensibilidade", v)} />
  <ControleNumerico rotulo={t("timer.tempo_morto")} valor={prefs.tempoMortoMs} min={L.tempoMortoMs.min} max={L.tempoMortoMs.max} passo={L.tempoMortoMs.passo} mostrar={ms} ajuda={t("timer.ajuda_tempo_morto")} desabilitado={ocupado} aoMudar={(v) => mudarPref("tempoMortoMs", v)} />
  <ControleNumerico rotulo={t("timer.silencio")} valor={prefs.silencioMs} min={L.silencioMs.min} max={L.silencioMs.max} passo={L.silencioMs.passo} mostrar={s} desabilitado={ocupado} aoMudar={(v) => mudarPref("silencioMs", v)} />
  <fieldset class="avisos" disabled={ocupado}>
    <legend>{t("timer.aviso_standby")}</legend>
    <label><input type="checkbox" checked={prefs.standbyVibrar} onchange={(e) => mudarPref("standbyVibrar", e.currentTarget.checked)} /> <span>{t("timer.aviso_vibrar")}</span></label>
    <label><input type="checkbox" checked={prefs.standbyVoz} onchange={(e) => mudarPref("standbyVoz", e.currentTarget.checked)} /> <span>{t("timer.aviso_voz")}</span></label>
    <label><input type="checkbox" checked={prefs.standbyBipe} disabled={prefs.standbyVoz} onchange={(e) => mudarPref("standbyBipe", e.currentTarget.checked)} /> <span>{t("timer.aviso_bipe")}</span></label>
    <p class="meta">{t("timer.aviso_ajuda")}</p>
    <label><input type="checkbox" checked={prefs.vibracao321} onchange={(e) => mudarPref("vibracao321", e.currentTarget.checked)} /> <span>{t("timer.vibracao321")}</span></label>
    <p class="meta">{t("timer.vibracao321_ajuda")}</p>
  </fieldset>
  <fieldset class="batidas" disabled={ocupado}>
    <legend>{t("timer.batidas")}</legend>
    {#each [0, 2, 3] as n}
      <label class:ativo={prefs.batidas === n}>
        <input type="radio" name="batidas" value={n} checked={prefs.batidas === n} onchange={() => escolherBatidas(n as 0 | 2 | 3)} />
        <span>{t(`timer.batidas_${n}` as Parameters<typeof t>[0])}</span>
      </label>
    {/each}
  </fieldset>
  <p class="meta">{t("timer.batidas_ajuda")}</p>
  {#if diag || taxaSensor !== null}
    <h4 class="diag-titulo">{t("diag.titulo")}</h4>
    <ul class="diag">
      {#if taxaSensor !== null}
        <li>{t("diag.sensor_taxa", { hz: taxaSensor })}</li>
        {#if taxaBaixa(taxaSensor)}<li role="alert">{t("diag.sensor_baixa", { min: TAXA_MINIMA_BOA_HZ })}</li>{/if}
      {/if}
      {#if diag}
      <li>{t("diag.taxa", { hz: diag.taxa })}</li>
      <li>{diag.filtros === null ? t("diag.filtros_desconhecido") : diag.filtros ? t("diag.filtros_ok") : t("diag.filtros_ligados")}</li>
      <li>{t("diag.saida", { ms: diag.saidaMs })}</li>
      {/if}
    </ul>
  {/if}
  {#if permissaoNegada}<p class="meta" role="alert">{t("timer.sem_permissao")}</p>{/if}
</Cartao>

<style>
  .diag-titulo { margin: 0.8rem 0 0.2rem; font-size: 0.95rem; }
  .diag { margin: 0; padding-left: 1.2rem; line-height: 1.5; }
  .avisos { margin: 0.8rem 0 0.4rem; padding: 0; border: 0; display: grid; gap: 0.2rem; }
  .avisos legend { padding: 0; margin-bottom: 0.3rem; font-size: 0.9rem; color: var(--suave); }
  .avisos label { display: flex; align-items: center; gap: 0.6rem; min-height: 3rem; }
  .avisos input { width: 1.5rem; height: 1.5rem; flex: none; }
  .batidas { display: flex; gap: 0.4rem; margin: 0.8rem 0 0.4rem; padding: 0; border: 0; }
  .batidas legend { padding: 0; margin-bottom: 0.3rem; font-size: 0.9rem; color: var(--suave); }
  .batidas label { position: relative; flex: 1; }
  .batidas input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  .batidas span { display: flex; align-items: center; justify-content: center; min-height: 3rem; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); text-align: center; padding: 0 0.3rem; }
  .batidas .ativo span { border: 0.125rem solid var(--acento); font-weight: 700; }
  .batidas input:focus-visible + span { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
</style>
