<script lang="ts">
  import { i18n } from "./i18n/index.svelte";
  import { hitFactor, pontuar, type Pontos } from "./tentativa";

  // A pontuação de uma tentativa: quantas Alfa, Charlie, Delta, Miss, No-shoot e procedimentais, o fator (minor ou major), os pontos e o HF. Opcional: sem `pontos` há só o botão de pontuar.
  let { pontos = $bindable<Pontos | null>(null), totalMs, pontosMaximos, semTitulo = false }: { pontos?: Pontos | null; totalMs: number | null; pontosMaximos?: number; semTitulo?: boolean } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  const CAMPOS = ["A", "C", "D", "M", "NS", "procedimentais"] as const;
  const vazio = (): Pontos => ({ A: 0, C: 0, D: 0, M: 0, NS: 0, procedimentais: 0, fator: "minor" });

  const total = $derived(pontos ? pontuar(pontos) : 0);
  const hf = $derived(pontos ? hitFactor(total, totalMs) : null);
  const num = (v: number, casas: number) => new Intl.NumberFormat(i18n.idioma, { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);

  function mudar(c: (typeof CAMPOS)[number], delta: number) {
    if (!pontos) return;
    pontos = { ...pontos, [c]: Math.min(1000, Math.max(0, pontos[c] + delta)) };
  }
</script>

<section class="pontuacao" aria-labelledby={semTitulo ? undefined : "titulo-pontuacao"}>
  {#if !semTitulo}<h3 id="titulo-pontuacao">{t("pontos.titulo")}</h3>{/if}
  {#if !pontos}
    <button class="botao" onclick={() => (pontos = vazio())}>{t("pontos.usar")}</button>
  {:else}
    <fieldset class="fator">
      <legend>{t("pontos.fator")}</legend>
      {#each ["minor", "major"] as const as f}
        <label class:ativo={pontos.fator === f}>
          <input type="radio" name="fator" value={f} checked={pontos.fator === f} onchange={() => (pontos = { ...pontos!, fator: f })} />
          <span>{t(`pontos.${f}`)}</span>
        </label>
      {/each}
    </fieldset>
    <ul class="campos">
      {#each CAMPOS as c (c)}
        <li>
          <span class="nome">{t(`pontos.${c}`)}</span>
          <button class="botao-barra" aria-label={t("pontos.menos", { campo: t(`pontos.${c}`) })} onclick={() => mudar(c, -1)} disabled={pontos[c] === 0}>−</button>
          <output aria-live="polite">{pontos[c]}</output>
          <button class="botao-barra" aria-label={t("pontos.mais", { campo: t(`pontos.${c}`) })} onclick={() => mudar(c, 1)}>+</button>
        </li>
      {/each}
    </ul>
    <p class="resultado-pontos">
      <strong>{t("pontos.total", { n: total })}</strong>
      {#if hf !== null}<strong>{t("pontos.hf", { hf: num(hf, 4) })}</strong>{:else}<span class="meta">{t("pontos.sem_tempo")}</span>{/if}
    </p>
    {#if pontosMaximos}<p class="meta">{t("pontos.pct", { p: num((Math.max(0, total) / pontosMaximos) * 100, 1) })}</p>{/if}
    <button class="botao" onclick={() => (pontos = null)}>{t("pontos.remover")}</button>
  {/if}
</section>

<style>
  .pontuacao { display: grid; gap: 0.5rem; }
  h3 { margin: 0.8rem 0 0; font-size: 1rem; }
  .fator { display: flex; gap: 0.4rem; margin: 0; padding: 0; border: 0; }
  .fator legend { padding: 0; margin-bottom: 0.3rem; font-size: 0.9rem; color: var(--suave); }
  .fator label { position: relative; flex: 1; }
  .fator input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  .fator span { display: flex; align-items: center; justify-content: center; min-height: 3rem; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); }
  .fator .ativo span { border: 0.125rem solid var(--acento); font-weight: 700; }
  .fator input:focus-visible + span { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
  .campos { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
  .campos li { display: grid; grid-template-columns: 1fr auto 2.5rem auto; align-items: center; gap: 0.4rem; }
  .campos output { text-align: center; font-size: 1.3rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .resultado-pontos { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.3rem 1rem; margin: 0.3rem 0 0; font-size: 1.2rem; font-variant-numeric: tabular-nums; }
</style>
