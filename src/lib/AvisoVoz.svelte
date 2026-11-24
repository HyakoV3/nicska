<script lang="ts">
  import Aviso from "./Aviso.svelte";
  import { i18n } from "./i18n/index.svelte";
  import { lerAvisoVozVisto, salvarAvisoVozVisto } from "./preferencias";

  // Aviso único, no primeiro Standby com a voz ligada: a voz do celular pode ser confundida com o comando de uma baia vizinha.
  let { standby, voz, aoDesligar }: { standby: boolean; voz: boolean; aoDesligar: () => void } = $props();
  let visivel = $state(false);

  $effect(() => {
    if (standby && voz && !visivel && !lerAvisoVozVisto()) {
      salvarAvisoVozVisto(); // conta como visto já na primeira exibição, mesmo que a pessoa não toque em nada
      visivel = true;
    }
  });
</script>

{#if visivel}
  <Aviso tipo="info">
    <p class="msg">{i18n.t("timer.aviso_voz_vizinha")}</p>
    <div class="acoes">
      <button class="botao secundario" onclick={() => ((visivel = false), aoDesligar())}>{i18n.t("timer.aviso_voz_desligar")}</button>
      <button class="botao" onclick={() => (visivel = false)}>{i18n.t("timer.aviso_voz_entendi")}</button>
    </div>
  </Aviso>
{/if}

<style>
  .msg { margin: 0 0 0.6rem; }
  .acoes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
</style>
