<script lang="ts">
  import type { Snippet } from "svelte";
  import Icone from "./Icone.svelte";
  import { i18n } from "./i18n/index.svelte";
  import { registrarNivel } from "./navegacao";

  // Uma janela flutuante (modal) para formulários curtos: abre sobre a tela, prende o foco (o <dialog> nativo faz isso), fecha com Esc, com o X, tocando fora ou com o Voltar do Android.
  // Existe só enquanto estiver na tela (quem a usa a põe num `{#if}`); o conteúdo decide quando salvar.
  let { titulo, onfechar, children }: { titulo: string; onfechar: () => void; children: Snippet } = $props();
  let caixa = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    caixa?.showModal();
    return () => caixa?.close();
  });
  // O Voltar do Android fecha a janela (CONS-030).
  $effect(() => registrarNivel(onfechar));

  const cancelar = (e: Event) => {
    e.preventDefault(); // o Esc passa por aqui: quem fecha é `onfechar`, para a tela saber
    onfechar();
  };
</script>

<dialog bind:this={caixa} aria-labelledby="janela-titulo" oncancel={cancelar} onclick={(e) => e.target === caixa && onfechar()}>
  <div class="janela">
    <header>
      <h2 id="janela-titulo">{titulo}</h2>
      <button type="button" class="botao fechar" aria-label={i18n.t("timer.fechar")} title={i18n.t("timer.fechar")} onclick={onfechar}><Icone nome="x" tamanho={20} /></button>
    </header>
    {@render children()}
  </div>
</dialog>

<style>
  dialog { box-sizing: border-box; width: min(32rem, calc(100% - 1.5rem)); max-height: calc(100dvh - 2rem); padding: 0; border: 0.0625rem solid var(--borda-controle); border-radius: 1rem; background: var(--superficie); color: var(--texto); overflow: auto; }
  dialog::backdrop { background: rgb(0 0 0 / 0.55); }
  .janela { display: grid; gap: 0.75rem; padding: 1rem; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  h2 { margin: 0; font-size: 1.15rem; }
  .fechar { min-width: 3rem; padding: 0; }
</style>
