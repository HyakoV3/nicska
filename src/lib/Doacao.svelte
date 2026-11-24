<script lang="ts">
  import Aviso from "./Aviso.svelte";
  import { abrirDoacao } from "./doacao";
  import { i18n } from "./i18n/index.svelte";

  // "Apoie o desenvolvedor": fora de card, acima da versão. A doação é voluntária e abre o navegador do sistema; o app em si não usa internet.
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let falhou = $state(false);
</script>

<section class="doacao" aria-labelledby="titulo-doacao">
  <h2 id="titulo-doacao">{t("doacao.titulo")}</h2>
  <p>{t("doacao.texto")}</p>
  <button class="botao primario" onclick={() => (falhou = !abrirDoacao())}>{t("doacao.botao")}</button>
  {#if falhou}<Aviso tipo="erro">{t("doacao.erro")}</Aviso>{/if}
</section>

<style>
  .doacao { display: grid; justify-items: center; gap: 0.5rem; text-align: center; margin: 1.2rem 0 0.9rem; }
  h2 { margin: 0; font-size: 1.05rem; }
  p { margin: 0; line-height: 1.5; }
  .doacao button { min-height: 3rem; padding-inline: 1.5rem; }
</style>
