<script lang="ts">
  import { criarConfirmacao } from "./confirmacao";
  import { i18n } from "./i18n/index.svelte";
  import { registrarNivel } from "./navegacao";

  // O menu "⋯" do percurso aberto: compartilhar, editar e apagar (apagar pede um 2º toque, que desarma sozinho passado o prazo). Fecha ao tocar fora, com Esc
  // e ao escolher uma ação; ao fechar, a confirmação de apagar também desarma.
  let { tentativas, oncompartilhar, oneditar, onapagar }: { tentativas: number; oncompartilhar: () => void; oneditar: () => void; onapagar: () => void } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const APAGAR = "apagar";
  let aberto = $state(false);
  let confirmando = $state<string | null>(null);
  let caixa = $state<HTMLDetailsElement | null>(null);
  const confirmacao = criarConfirmacao((id) => (confirmando = id));

  $effect(() => {
    if (!aberto) confirmacao.cancelar();
  });
  $effect(() => () => confirmacao.cancelar());
  // O Voltar do Android fecha o menu (CONS-030).
  $effect(() => {
    if (aberto) return registrarNivel(() => (aberto = false));
  });

  const escolher = (acao: () => void) => () => {
    aberto = false;
    acao();
  };
  const apagar = () => confirmacao.pedir(APAGAR) && onapagar();
  const fechar = (e: Event) => {
    if (aberto && caixa && !caixa.contains(e.target as Node)) aberto = false;
  };
</script>

<svelte:window onclick={fechar} onkeydown={(e) => e.key === "Escape" && (aberto = false)} />

<details class="menu-percurso" bind:open={aberto} bind:this={caixa}>
  <summary class="botao" aria-label={t("historico.mais_acoes")} title={t("historico.mais_acoes")}>⋯</summary>
  <div class="menu-itens">
    <button class="botao" onclick={escolher(oncompartilhar)}>{t("historico.compartilhar_percurso")}</button>
    <button class="botao" onclick={escolher(oneditar)}>{t("percurso.editar")}</button>
    <button class="botao perigo" class:confirmar={confirmando === APAGAR} onclick={apagar}>
      {confirmando === APAGAR ? t("percurso.apagar_mesmo", { n: i18n.tn("plural.tentativas", tentativas) }) : t("percurso.apagar")}
    </button>
  </div>
</details>

<style>
  .menu-percurso { position: relative; }
  .menu-percurso summary { list-style: none; min-width: 3rem; font-size: 1.4rem; line-height: 1; }
  .menu-percurso summary::-webkit-details-marker { display: none; }
  .menu-itens { position: absolute; right: 0; top: 3.25rem; z-index: 5; display: grid; gap: 0.4rem; min-width: 14rem; padding: 0.5rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); box-shadow: 0 0.25rem 1rem rgb(0 0 0 / 0.15); }
</style>
