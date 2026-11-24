<script lang="ts">
  import { i18n } from "./i18n/index.svelte";
  import type { Dono, Previa } from "./importacao";

  // A confirmação ANTES de gravar um arquivo importado: de quem é, quantas tentativas e quais percursos entrariam. Backup de outra pessoa pede escolher de quem
  // são as tentativas. Nada foi gravado até tocar em Importar.
  let { previa, onimportar, oncancelar }: { previa: Previa; onimportar: (dono: Dono) => void; oncancelar: () => void } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let dono = $state<Dono | null>(null);

  const quem = $derived(previa.doc.atirador.nome);
  const percursos = $derived(previa.novas.percursos.map((p) => p.nome));
  const nada = $derived(previa.novas.tentativas.length === 0 && percursos.length === 0);
  const pronto = $derived(!nada && (!previa.perguntaDono || dono !== null));
  const lista = $derived(percursos.length > 3 ? `${percursos.slice(0, 3).join(", ")} (+${percursos.length - 3})` : percursos.join(", "));
</script>

<section class="importacao" aria-labelledby="titulo-importacao">
  <h2 id="titulo-importacao">{t("historico.confirmar_titulo")}</h2>
  <p>{t("historico.confirmar_de", { nome: quem })}</p>
  {#if nada}
    <p>{t("historico.confirmar_nada")}</p>
  {:else}
    <ul class="resumo">
      <li>{t("historico.confirmar_tentativas", { n: previa.novas.tentativas.length })}</li>
      {#if percursos.length}<li>{t("historico.confirmar_percursos", { lista })}</li>{/if}
      {#if previa.novas.jaExistiam}<li>{t("historico.confirmar_existentes", { n: previa.novas.jaExistiam })}</li>{/if}
    </ul>
  {/if}
  {#if previa.perguntaDono && !nada}
    <fieldset class="dono">
      <legend>{t("historico.confirmar_dono")}</legend>
      <label><input type="radio" name="dono" value="meu" bind:group={dono} /> {t("historico.confirmar_dono_meu")}</label>
      <label><input type="radio" name="dono" value="outro" bind:group={dono} /> {t("historico.confirmar_dono_outro", { nome: quem })}</label>
    </fieldset>
  {/if}
  <p class="meta">{t("historico.confirmar_nao_gravado")}</p>
  <div class="acoes-linha">
    <button class="botao primario" disabled={!pronto} onclick={() => onimportar(dono ?? "meu")}>{t("historico.confirmar_importar")}</button>
    <button class="botao" onclick={oncancelar}>{t("timer.cancelar")}</button>
  </div>
</section>

<style>
  .importacao { display: grid; gap: 0.6rem; padding: 0.8rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); }
  h2 { margin: 0; font-size: 1.1rem; }
  p { margin: 0; }
  .resumo { margin: 0; padding-left: 1.2rem; display: grid; gap: 0.2rem; }
  .dono { display: grid; gap: 0.4rem; margin: 0; padding: 0.5rem 0.8rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; }
  .dono label { display: flex; align-items: center; gap: 0.5rem; min-height: 3rem; cursor: pointer; }
  .dono input { width: 1.5rem; height: 1.5rem; flex: none; }
  .acoes-linha { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .acoes-linha .botao { flex: 1; }
</style>
