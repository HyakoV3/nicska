<script lang="ts">
  import Icone from "./Icone.svelte";
  import type { Snippet } from "svelte";

  // Barra de topo fixa; a altura se ajusta sozinha a fonte ampliada ou a título de duas linhas, sem número mágico.
  let {
    titulo,
    subtitulo,
    logo,
    voltar,
    rotuloVoltar = "",
    acao,
    lang,
    quebra = false,
  }: {
    titulo: string;
    subtitulo?: string;
    /** Endereço de uma imagem de marca, mostrada antes do título (tela inicial). Decorativa: o nome fica no título. */
    logo?: string;
    voltar?: () => void;
    rotuloVoltar?: string;
    acao?: Snippet;
    /** Idioma do título quando difere da interface (ex.: um nome em outra língua). */
    lang?: string;
    /** A ação (à direita) desce para uma 2ª linha, alinhada à direita, quando não cabe ao lado do título; o título não quebra no meio da palavra. Vale para qualquer fonte e tamanho de letra. */
    quebra?: boolean;
  } = $props();
</script>

<header class="barra">
  <div class="coluna linha" class:quebra>
    {#if voltar}
      <button class="voltar" onclick={voltar} aria-label={rotuloVoltar}><Icone nome="voltar" tamanho={24} /></button>
    {/if}
    {#if logo}<img class="logo" src={logo} alt="" />{/if}
    <div class="textos">
      <h1 title={titulo} {lang}>{titulo}</h1>
      {#if subtitulo}<p>{subtitulo}</p>{/if}
    </div>
    {#if acao}<div class="acao">{@render acao()}</div>{/if}
  </div>
</header>

<style>
  .barra {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--fundo);
    border-bottom: 0.0625rem solid var(--borda);
    padding-top: env(safe-area-inset-top);
  }
  .linha { display: flex; align-items: center; gap: 0.5rem; min-height: 3.5rem; }
  .voltar {
    min-width: 3rem; min-height: 3rem; margin-left: -0.6rem; font-size: 1.5rem; line-height: 1;
    background: transparent; border: 0; color: inherit; cursor: pointer; border-radius: 0.75rem;
  }
  /* Do tamanho do botão de Ajustes (3rem x 3rem, o `.botao-icone` da tela inicial), com o mesmo raio: logo e botão formam o par das pontas da barra. */
  .logo { flex: none; width: 3rem; height: 3rem; border-radius: 0.75rem; }
  .textos { flex: 1; min-width: 0; padding: 0.25rem 0; }
  h1 {
    margin: 0; font-size: 1.2rem; line-height: 1.25; overflow-wrap: anywhere;
    display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  p { margin: 0; font-size: 0.78rem; color: var(--suave); }
  .acao { flex: none; }
  /* Com `quebra`: o título fica numa linha só e a ação, se faltar espaço, desce para a linha de baixo (à direita) em vez de espremer o título. */
  .linha.quebra { flex-wrap: wrap; row-gap: 0; }
  .quebra .textos { flex: 1 1 auto; min-width: max-content; }
  .quebra h1 { white-space: nowrap; }
  .quebra .acao { flex: 0 1 auto; margin-inline-start: auto; padding-bottom: 0.25rem; }
</style>
