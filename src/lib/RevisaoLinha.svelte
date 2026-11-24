<script lang="ts">
  import { trilha } from "./trilha";
  import { i18n } from "./i18n/index.svelte";
  import { DISTANCIA_MINIMA_MS, disparoPerto, inserirDisparo, instanteNaLinha, decimarEnvelope, janelaDaLinha, posicaoNaLinha, type Edicao } from "./revisao";
  import { formatarSegundos } from "./tentativa";

  // A linha do tempo da Revisão: o envelope como barras, o apito (tracejado), os disparos (numerados) e o cursor (pontilhado), mais o controle do cursor
  // e os botões de ouvir o trecho e inserir um disparo ali. Tocar na linha, perto de um disparo, o seleciona; em outro ponto, põe o cursor.
  let { audio, edicao = $bindable(), selecionado = $bindable(), confirmando = $bindable(), ouvir }: {
    audio: { amostras: Float32Array; taxa: number; envelope: Float32Array; zeroS: number };
    edicao: Edicao;
    selecionado: number | null;
    confirmando: number | null;
    /** Toca o trecho em volta de `ms` (desde o apito). */
    ouvir: (ms: number) => void;
  } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const seg = (ms: number) => formatarSegundos(ms, i18n.idioma);

  let cursorMs = $state(0);
  const duracaoMs = $derived((audio.amostras.length / audio.taxa - audio.zeroS) * 1000);
  const janela = $derived(janelaDaLinha(edicao.disparosMs, duracaoMs));

  const LARGURA = 1000;
  const ALTURA = 140;
  const barras = $derived.by(() => {
    const { envelope, zeroS } = audio;
    const porMs = 200 / 1000; // pontos do envelope por ms
    let d = "";
    const x0 = Math.max(0, Math.floor((zeroS * 1000 + janela.iniMs) * porMs));
    const x1 = Math.min(envelope.length, Math.ceil((zeroS * 1000 + janela.fimMs) * porMs));
    for (const { indice, pico } of decimarEnvelope(envelope, x0, x1)) {
      const x = posicaoNaLinha(indice / porMs - zeroS * 1000, janela) * LARGURA;
      const h = Math.min(1, pico * 1.6) * (ALTURA / 2 - 6);
      d += `M${x.toFixed(1)} ${(ALTURA / 2 - h).toFixed(1)}V${(ALTURA / 2 + h).toFixed(1)}`;
    }
    return d;
  });
  const xDe = (ms: number) => posicaoNaLinha(ms, janela) * LARGURA;

  function tocarLinha(e: MouseEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const ms = instanteNaLinha((e.clientX - r.left) / r.width, janela);
    const tolerancia = ((janela.fimMs - janela.iniMs) * 28) / r.width; // 28 px de cada lado
    const perto = disparoPerto(edicao.disparosMs, { ms, toleranciaMs: tolerancia });
    selecionado = perto >= 0 ? perto : null;
    cursorMs = perto >= 0 ? edicao.disparosMs[perto] : ms;
    confirmando = null;
  }

  function inserir() {
    const antes = edicao.disparosMs.length;
    edicao = inserirDisparo(edicao, cursorMs);
    if (edicao.disparosMs.length > antes) selecionado = edicao.disparosMs.indexOf(Math.round(cursorMs));
  }
  const podeInserir = $derived(cursorMs >= 0 && !edicao.disparosMs.some((d) => Math.abs(d - cursorMs) < DISTANCIA_MINIMA_MS));
</script>

<h3>{t("revisao.linha")}</h3>
<!-- Tocar na linha: perto de um disparo o seleciona; em outro ponto, põe o cursor ali. O controle deslizante e os botões abaixo fazem o mesmo sem tocar na figura. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg class="linha" viewBox={`0 0 ${LARGURA} ${ALTURA}`} preserveAspectRatio="none" role="img" aria-label={t("revisao.linha_aria", { n: edicao.disparosMs.length })} onclick={tocarLinha}>
  <path d={barras} class="onda" />
  <line x1={xDe(0)} x2={xDe(0)} y1="0" y2={ALTURA} class="apito" />
  <text x={xDe(0) + 6} y="14" class="rotulo-linha">{t("revisao.apito")}</text>
  {#each edicao.disparosMs as ms, i (ms)}
    <line x1={xDe(ms)} x2={xDe(ms)} y1="0" y2={ALTURA} class="marca" class:sel={selecionado === i} />
    <rect x={xDe(ms) - 11} y={ALTURA - 24} width="22" height="22" rx="4" class="etiqueta" class:sel={selecionado === i} />
    <text x={xDe(ms)} y={ALTURA - 8} text-anchor="middle" class="numero">{i + 1}</text>
  {/each}
  <line x1={xDe(cursorMs)} x2={xDe(cursorMs)} y1="0" y2={ALTURA} class="cursor" />
</svg>
<label class="cursor-controle">
  <span>{t("revisao.cursor", { ms: seg(cursorMs) })}</span>
  <input type="range" use:trilha={[cursorMs, janela.iniMs, janela.fimMs]} min={janela.iniMs} max={janela.fimMs} step="10" bind:value={cursorMs} aria-valuetext={`${seg(cursorMs)} s`} />
</label>
<div class="botoes-linha">
  <button class="botao" onclick={() => ouvir(cursorMs)}>{t("revisao.ouvir_cursor")}</button>
  <button class="botao" onclick={inserir} disabled={!podeInserir}>{t("revisao.inserir")}</button>
</div>

<style>
  h3 { margin: 1rem 0 0.3rem; font-size: 1rem; }
  .linha { width: 100%; height: 9rem; display: block; background: var(--superficie); border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; cursor: crosshair; touch-action: manipulation; }
  .onda { stroke: var(--suave); stroke-width: 2; fill: none; }
  .apito { stroke: var(--texto); stroke-width: 2; stroke-dasharray: 10 6; }
  .marca { stroke: var(--acento); stroke-width: 3; }
  .marca.sel { stroke-width: 6; }
  .cursor { stroke: var(--texto); stroke-width: 2; stroke-dasharray: 2 5; }
  .etiqueta { fill: var(--acento); }
  .etiqueta.sel { stroke: var(--texto); stroke-width: 3; }
  .numero { fill: var(--acento-texto); font-weight: 700; font-size: 0.9375rem; } /* rem num SVG vira unidade do viewBox: 15 no tamanho padrão, e acompanha a fonte do sistema */
  .rotulo-linha { fill: var(--texto); font-size: 0.875rem; }
  .cursor-controle { display: grid; gap: 0.2rem; margin-top: 0.6rem; }
  .cursor-controle input { width: 100%; min-height: 3rem; }
  .botoes-linha { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.4rem 0; }
  .botoes-linha .botao { flex: 1; }
</style>
