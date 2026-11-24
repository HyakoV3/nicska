<script lang="ts">
  import { i18n } from "./i18n/index.svelte";
  import { lerPrimeiroStandbyFeito, salvarPrimeiroStandbyFeito } from "./preferencias";

  // Orientação de primeiro uso no estado "Pronto" e pré-aviso do microfone (antes do primeiro pedido de permissão). Não bloqueia nada:
  // some para sempre na primeira vez que o timer sai do "parado", isto é, depois do primeiro toque em Standby.
  let { parado }: { parado: boolean } = $props();
  let feito = $state(lerPrimeiroStandbyFeito());

  $effect(() => {
    if (!parado && !feito) {
      salvarPrimeiroStandbyFeito();
      feito = true;
    }
  });
</script>

{#if parado && !feito}
  <div class="dica-primeiro-uso">
    <p>{i18n.t("timer.primeiro_uso")}</p>
    <p class="meta">{i18n.t("timer.primeiro_uso_microfone")}</p>
  </div>
{/if}

<style>
  .dica-primeiro-uso { text-align: center; }
  .dica-primeiro-uso p { margin: 0 0 0.3rem; }
</style>
