<script lang="ts">
  import { trilha } from "./trilha";
  import { codificar, decodificar, renderizar } from "./avatarImagem";
  import { FILTROS, type FiltroId } from "./avatarFiltros";
  import { arrastar, ZOOM_MAXIMO, type Recorte } from "./avatarRecorte";
  import type { Chave } from "./i18n/pt";
  import { i18n } from "./i18n/index.svelte";

  // O editor da foto: a imagem escolhida numa janela redonda (arrastar, ou setas do teclado e botões, e zoom pela barra), a fileira de filtros com prévia e Salvar/Cancelar.
  let { arquivo, aoSalvar, aoCancelar, aoFalhar }: { arquivo: Blob; aoSalvar: (b: Blob) => Promise<void>; aoCancelar: () => void; aoFalhar: (motivo: "abrir" | "salvar") => void } = $props();
  const t = (c: Chave, p?: Record<string, string | number>) => i18n.t(c, p);

  const LADO_MINIATURA = 64;
  let bitmap = $state<ImageBitmap | null>(null);
  let zoom = $state(1);
  let deslocX = $state(0);
  let deslocY = $state(0);
  let filtro = $state<FiltroId>("original");
  let salvando = $state(false);
  let tela = $state<HTMLCanvasElement>();
  let miniaturas = $state<Partial<Record<FiltroId, HTMLCanvasElement>>>({});
  let arrasto: { x: number; y: number } | null = null;

  const recorte = (): Recorte => ({ largura: bitmap!.width, altura: bitmap!.height, zoom, deslocX, deslocY });

  $effect(() => {
    let vivo = true;
    decodificar(arquivo).then(
      (b) => (vivo ? (bitmap = b) : b.close()),
      () => vivo && aoFalhar("abrir"),
    );
    return () => {
      vivo = false;
      bitmap?.close();
    };
  });

  /** Redesenha a janela e as miniaturas (uma vez por quadro, mesmo que muitas mudanças cheguem juntas). */
  $effect(() => {
    if (!bitmap || !tela) return;
    const b = bitmap;
    const pedido = { bitmap: b, recorte: { zoom, deslocX, deslocY } };
    const f = filtro;
    const q = requestAnimationFrame(() => {
      tela!.getContext("2d")!.drawImage(renderizar({ ...pedido, filtro: f }), 0, 0);
      for (const id of FILTROS) miniaturas[id]?.getContext("2d")!.drawImage(renderizar({ ...pedido, filtro: id, lado: LADO_MINIATURA }), 0, 0);
    });
    return () => cancelAnimationFrame(q);
  });

  function mover(dx: number, dy: number) {
    const r = arrastar(recorte(), { dx, dy, janelaPx: tela!.clientWidth });
    deslocX = r.deslocX;
    deslocY = r.deslocY;
  }
  function comecar(e: PointerEvent) {
    arrasto = { x: e.clientX, y: e.clientY };
    tela!.setPointerCapture(e.pointerId);
  }
  function andar(e: PointerEvent) {
    if (!arrasto) return;
    mover(e.clientX - arrasto.x, e.clientY - arrasto.y);
    arrasto = { x: e.clientX, y: e.clientY };
  }
  const SETAS: Record<string, [number, number]> = { ArrowLeft: [24, 0], ArrowRight: [-24, 0], ArrowUp: [0, 24], ArrowDown: [0, -24] };
  function tecla(e: KeyboardEvent) {
    const s = SETAS[e.key];
    if (!s) return;
    e.preventDefault();
    mover(...s);
  }
  const botao = (dx: number, dy: number) => () => mover(dx * 24, dy * 24);

  async function salvar() {
    salvando = true;
    try {
      await aoSalvar(await codificar(renderizar({ bitmap: bitmap!, recorte: { zoom, deslocX, deslocY }, filtro })));
    } catch {
      aoFalhar("salvar");
    } finally {
      salvando = false;
    }
  }
</script>

<div class="editor" role="group" aria-label={t("perfil.editor")}>
  <!-- A janela de recorte é um controle de arrastar: o foco e as setas do teclado fazem o mesmo que o dedo (e há botões de mover logo abaixo). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div class="janela" role="group" aria-label={t("perfil.area")} tabindex="0" onkeydown={tecla}>
    <canvas bind:this={tela} width="256" height="256" onpointerdown={comecar} onpointermove={andar} onpointerup={() => (arrasto = null)} onpointercancel={() => (arrasto = null)}></canvas>
  </div>
  <div class="mover">
    <button type="button" class="botao" aria-label={t("perfil.mover_esq")} onclick={botao(1, 0)}>←</button>
    <button type="button" class="botao" aria-label={t("perfil.mover_cima")} onclick={botao(0, 1)}>↑</button>
    <button type="button" class="botao" aria-label={t("perfil.mover_baixo")} onclick={botao(0, -1)}>↓</button>
    <button type="button" class="botao" aria-label={t("perfil.mover_dir")} onclick={botao(-1, 0)}>→</button>
  </div>
  <label class="zoom"><span>{t("perfil.zoom")}</span><input type="range" use:trilha={zoom} min="1" max={ZOOM_MAXIMO} step="0.05" bind:value={zoom} /></label>
  <p class="rotulo" id="rotulo-filtros">{t("perfil.filtros")}</p>
  <div class="filtros" role="radiogroup" aria-labelledby="rotulo-filtros">
    {#each FILTROS as id (id)}
      <label class="filtro" class:ativo={filtro === id}>
        <input type="radio" name="filtro-avatar" value={id} bind:group={filtro} />
        <canvas bind:this={miniaturas[id]} width={LADO_MINIATURA} height={LADO_MINIATURA}></canvas>
        <span>{t(`perfil.filtro.${id}` as Chave)}</span>
      </label>
    {/each}
  </div>
  <div class="acoes">
    <button type="button" class="botao" onclick={aoCancelar} disabled={salvando}>{t("perfil.cancelar")}</button>
    <button type="button" class="botao primario" onclick={salvar} disabled={salvando || !bitmap}>{t("perfil.salvar")}</button>
  </div>
</div>

<style>
  .editor { display: grid; gap: 0.7rem; justify-items: center; }
  .editor > :global(*) { max-width: 100%; }
  .janela { width: min(16rem, 100%); aspect-ratio: 1; border-radius: 50%; overflow: hidden; border: 0.125rem solid var(--acento); background: var(--superficie-alt); }
  .janela:focus-visible { outline: 0.1875rem solid var(--foco); outline-offset: 0.25rem; }
  .janela canvas { width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
  .mover { display: flex; gap: 0.4rem; }
  .mover .botao { min-width: 3rem; min-height: 3rem; }
  .zoom { display: grid; gap: 0.2rem; width: min(20rem, 100%); }
  .zoom span, .rotulo { font-size: 0.9rem; color: var(--suave); margin: 0; }
  .zoom input { width: 100%; min-height: 3rem; }
  .filtros { display: flex; gap: 0.4rem; overflow-x: auto; width: 100%; padding: 0.25rem 0.1rem; }
  .filtro { position: relative; display: grid; justify-items: center; gap: 0.2rem; flex: none; width: 4.5rem; padding: 0.25rem; box-sizing: border-box; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); font-size: 0.75rem; text-align: center; cursor: pointer; }
  .filtro input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .filtro canvas { width: 3.5rem; height: 3.5rem; border-radius: 50%; }
  .filtro.ativo { border: 0.125rem solid var(--acento); font-weight: 700; }
  .filtro:has(input:focus-visible) { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
  .acoes { display: flex; gap: 0.5rem; width: min(20rem, 100%); }
  .acoes .botao { flex: 1; min-height: 3rem; }
</style>
