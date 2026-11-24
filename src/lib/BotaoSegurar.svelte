<script lang="ts">
  import { onDestroy } from "svelte";
  import { i18n } from "./i18n/index.svelte";
  import { Segurar } from "./video/segurar";
  import type { AcaoDoBotao } from "./video/telaCheia";

  // O botão do alto da tela cheia (V2b). Antes do apito, um toque CANCELA. Com a tentativa correndo, é preciso SEGURAR ~1 s para PARAR (um toque acidental
  // não encerra nada): a barra dentro do botão enche enquanto segura e soltar antes zera e mostra a dica (`aoCedo`). Teclado: Espaço ou Enter seguros valem
  // o mesmo; o leitor de tela (TalkBack) passa o "tocar duas vezes e segurar" como toque longo, e um toque duplo solto também mostra a dica. O progresso
  // sobe em passos (video/segurar.ts), sem transição: com "menos movimento" nada desliza, só a barra que cresce.
  let { acao, aoCancelar, aoParar, aoCedo }: { acao: AcaoDoBotao; aoCancelar: () => void; aoParar: () => void; aoCedo: () => void } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  let progresso = $state(0);
  const segurar = new Segurar(() => aoParar());
  segurar.aoMudar = (p) => (progresso = p);
  onDestroy(() => segurar.parar());
  // Voltou a "cancelar" (não deve acontecer) ou saiu: nada fica contando.
  $effect(() => {
    if (acao !== "segurar") segurar.parar();
  });

  /** O dedo desceu neste toque: o clique que vem depois dele já foi tratado pelo segurar (não é o toque duplo do leitor de tela). */
  let peloDedo = false;
  function descer() {
    peloDedo = true;
    if (acao === "segurar") segurar.comecar();
  }
  const subir = () => segurar.soltar() && aoCedo();
  const ehTecla = (e: KeyboardEvent) => e.key === " " || e.key === "Enter";
  function teclaDesceu(e: KeyboardEvent) {
    if (!ehTecla(e) || acao !== "segurar") return;
    e.preventDefault(); // sem o clique que o Enter e o Espaço gerariam
    if (!e.repeat) segurar.comecar();
  }
  function teclaSubiu(e: KeyboardEvent) {
    if (!ehTecla(e) || acao !== "segurar") return;
    e.preventDefault();
    subir();
  }
  /** Um clique (toque curto, ou o toque duplo do leitor de tela): cancela antes do apito; correndo, só lembra que é preciso segurar. */
  function clique() {
    const dedo = peloDedo;
    peloDedo = false;
    if (acao === "cancelar") aoCancelar();
    else if (!dedo) aoCedo();
  }
</script>

<button
  class="segurar"
  class:correndo={acao === "segurar"}
  aria-label={acao === "segurar" ? t("tela_video.segure_aria") : t("tela_video.cancelar_aria")}
  onclick={clique}
  onpointerdown={descer}
  onpointerup={subir}
  onpointercancel={subir}
  onpointerleave={subir}
  onkeydown={teclaDesceu}
  onkeyup={teclaSubiu}
  oncontextmenu={(e) => e.preventDefault()}
>
  <span class="rotulo">{acao === "segurar" ? t("tela_video.parar") : t("tela_video.sair")}</span>
  {#if acao === "segurar"}
    <span class="dica-curta">{t("tela_video.segure")}</span>
    <span class="trilho" aria-hidden="true"><span class="cheio" style:transform={`scaleX(${progresso})`}></span></span>
  {/if}
</button>

<style>
  /* Semitransparente sobre a câmera, mas com borda e texto sólidos (legível sobre qualquer imagem); alvo grande. No alto contraste, fundo sólido. */
  .segurar {
    display: grid; justify-items: center; align-content: center; gap: 0.25rem; min-height: 4rem; padding: 0.4rem 1rem; box-sizing: border-box;
    border-radius: 1rem; border: 0.1875rem solid white; background: rgb(0 0 0 / 0.55); color: white; font-size: 1.3rem; font-weight: 700;
    cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  .segurar.correndo { border-color: var(--perigo); }
  .segurar:focus-visible { outline: 0.25rem solid var(--foco); outline-offset: 0.2rem; }
  :global(:root[data-tema="alto-contraste"]) .segurar { background: black; }
  .dica-curta { font-size: 0.8rem; font-weight: 600; }
  .trilho { display: block; width: 100%; height: 0.5rem; border-radius: 0.25rem; background: rgb(255 255 255 / 0.3); overflow: hidden; }
  .cheio { display: block; width: 100%; height: 100%; background: white; transform-origin: left center; }
</style>
