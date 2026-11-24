<script lang="ts">
  import "$lib/tema.css";
  import "$lib/movimento.css";
  import { i18n } from "$lib/i18n/index.svelte";
  import { aplicarEstilo, aplicarTema, estilo, tema } from "$lib/tema.svelte";
  import { sincronizarBarras } from "$lib/barras";

  let { children } = $props();

  // Mantém o atributo lang do documento em sintonia com o idioma escolhido.
  $effect(() => {
    document.documentElement.lang = i18n.idioma;
  });

  // Aplica a aparência escolhida: o modo (Automático, Claro ou Escuro) e o estilo de cor (Normal, Titânio ou Telemetria).
  $effect(() => {
    aplicarTema(tema.atual);
    aplicarEstilo(estilo.atual);
    // As barras do sistema (Android) seguem o fundo real: depois de o CSS assentar, e de novo se o sistema trocar claro/escuro (modo Automático).
    const quadro = requestAnimationFrame(() => sincronizarBarras());
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const mudou = () => requestAnimationFrame(() => sincronizarBarras());
    mq.addEventListener("change", mudou);
    return () => {
      cancelAnimationFrame(quadro);
      mq.removeEventListener("change", mudou);
    };
  });
</script>

{@render children()}

<style>
  :global(:root) {
    font-family: system-ui, sans-serif;
    color: var(--texto);
    background: var(--fundo);
  }
  /* --largura-trilho: a barra lateral de abas (celular deitado) ocupa o lado esquerdo; a página inteira se afasta dela. */
  :global(body) { margin: 0; -webkit-text-size-adjust: 100%; padding-left: var(--largura-trilho, 0rem); }
  /* Anel de foco visível para teclado e leitores de tela com navegação por foco. */
  :global(:focus-visible) { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
  :global(a) { color: var(--acento); }
  /* Alto contraste (I-06): foco e bordas mais grossos e links sempre sublinhados, para nada depender só de cor. */
  :global(:root[data-tema="alto-contraste"] :focus-visible) { outline-width: 0.25rem; }
  :global(:root[data-tema="alto-contraste"] .botao) { border-width: 0.125rem; }
  :global(:root[data-tema="alto-contraste"] a) { text-decoration: underline; }
  /* Coluna central; respeita o recorte da câmera e a barra de gestos (viewport-fit=cover). */
  :global(.coluna) {
    max-width: 40rem; margin: 0 auto; box-sizing: border-box;
    padding-left: max(1rem, env(safe-area-inset-left)); padding-right: max(1rem, env(safe-area-inset-right));
  }
  :global(.conteudo) {
    padding-top: 1rem;
    /* --altura-miniplayer e --altura-navegacao (barra de abas) são definidas por quem as mostra. */
    padding-bottom: calc(
      var(--altura-miniplayer, 0rem) + var(--altura-navegacao, 0rem) + max(1.5rem, env(safe-area-inset-bottom))
    );
  }
  :global(.meta) { color: var(--suave); font-size: 0.9rem; }
  /* Fonte dos números grandes (cronômetro, resultado) e do STAND BY: a Sora, embutida no app (OFL, static/fontes/). O resto do app usa a fonte padrão. */
  :global(.digitos, .standby-grande) { font-family: var(--fonte-display); }
  /* Texto só para leitores de tela. */
  :global(.so-leitor) {
    position: absolute; width: 0.0625rem; height: 0.0625rem; margin: -0.0625rem; padding: 0; overflow: hidden;
    clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  :global(.botao) {
    display: inline-flex; align-items: center; justify-content: center; min-height: 3rem; box-sizing: border-box;
    padding: 0 1rem; font-size: 1rem; text-decoration: none; border-radius: 0.75rem;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); cursor: pointer;
  }
    /* Controles deslizantes do app (disparos da linha do tempo, zoom, retenção): trilha gorda com borda e a bolinha na cor do tempo, como a barra de progresso; nada de azul do sistema. */
  :global(input[type="range"]) { -webkit-appearance: none; appearance: none; background: transparent; width: 100%; min-height: 2.25rem; cursor: pointer; }
  :global(input[type="range"]::-webkit-slider-runnable-track) { height: 1rem; box-sizing: border-box; border: 0.0625rem solid var(--borda-controle); border-radius: 999rem; background: linear-gradient(to right, var(--acento) var(--p, 0%), var(--tempo-trilha) var(--p, 0%)); }
  :global(input[type="range"]::-webkit-slider-thumb) { -webkit-appearance: none; appearance: none; width: 1.75rem; height: 1.75rem; margin-top: -0.4375rem; border-radius: 50%; border: 0.1875rem solid var(--fundo); background: var(--tempo-fundo); box-shadow: 0 0 0 0.0625rem var(--borda-controle); }
  :global(input[type="range"]::-moz-range-track) { height: 1rem; box-sizing: border-box; border: 0.0625rem solid var(--borda-controle); border-radius: 999rem; background: var(--tempo-trilha); }
  :global(input[type="range"]::-moz-range-thumb) { width: 1.5rem; height: 1.5rem; border-radius: 50%; border: 0.1875rem solid var(--fundo); background: var(--tempo-fundo); }
  :global(input[type="range"]:focus-visible) { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; border-radius: 999rem; }
:global(.botao.primario) { background: var(--acento-botao); color: var(--acento-texto); border-color: var(--acento-botao); font-weight: 600; }
  /* Tempo em evidência (medição): bloco sólido em --tempo-fundo com texto em --tempo-sobre. Não é o vermelho de erro (--perigo). */
  :global(.botao.tocando) { background: var(--tempo-fundo); color: var(--tempo-sobre); border: 0.125rem solid var(--tempo-ativo); font-weight: 600; }
  :global(.bandeira-final) { color: var(--tempo-ativo); font-weight: 700; }
  :global(.botao.tocando .bandeira-final) { color: inherit; }
  /* Níveis de ação (docs/archive/roadmap-ux-ui.md): primário (cheio, a ação principal da tela), secundário (contorno azul, a que vem depois),
     neutro (borda cinza, o resto), perigo (vermelho: apagar, descartar, parar). `.confirmar` marca o 2º toque de uma exclusão (borda e peso maiores). */
  :global(.botao.secundario) { color: var(--acento); border: 0.125rem solid var(--acento); font-weight: 600; }
  :global(.botao.perigo) { color: var(--perigo); border-color: var(--perigo); }
  :global(.botao.perigo.confirmar) { border-width: 0.125rem; font-weight: 700; }
  :global(.botao:disabled) { opacity: 0.5; cursor: not-allowed; }
  /* Cartão: a moldura dos cartões do player e de Ajustes (Cartao.svelte e o cartão fixo "Tocar"). */
  :global(.cartao) { border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); }
  /* Botão quadrado das barras de controle (tamanho e alinhamento da letra, tamanho da partitura): 3 rem, só ícone; o que está
     ligado (aria-pressed) leva borda dourada. */
  :global(.botao-barra) {
    display: inline-flex; align-items: center; justify-content: center; padding: 0; min-width: 3rem; height: 3rem;
    border-radius: 0.75rem; line-height: 1; cursor: pointer;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  :global(.botao-barra:disabled) { opacity: 0.5; cursor: default; }
  :global(.botao-barra[aria-pressed="true"]) { border: 0.125rem solid var(--acento); }
</style>
