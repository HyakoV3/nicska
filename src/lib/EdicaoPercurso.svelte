<script lang="ts">
  import { untrack } from "svelte";
  import { DIVISOES, type Percurso } from "./documento";
  import { camposDe, percursoEditado } from "./edicaoPercurso";
  import { i18n } from "./i18n/index.svelte";

  // O formulário de editar o percurso aberto (nome, disparos, pontos máximos, divisão). Os campos começam com os valores do percurso.
  let { percurso, onsalvar, oncancelar }: { percurso: Percurso; onsalvar: (novo: Percurso) => void; oncancelar: () => void } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let ed = $state(untrack(() => camposDe(percurso)));

  function enviar(e: Event) {
    e.preventDefault();
    const novo = percursoEditado(percurso, ed);
    if (novo) onsalvar(novo);
  }
</script>

<form class="edicao" onsubmit={enviar}>
  <label class="campo"><span>{t("percurso.nome")}</span><input type="text" bind:value={ed.nome} maxlength="80" required /></label>
  <label class="campo"><span>{t("percurso.disparos")}</span><input type="number" inputmode="numeric" min="1" max="500" bind:value={ed.disparos} /></label>
  <label class="campo"><span>{t("percurso.pontos_maximos")}</span><input type="number" inputmode="numeric" min="1" max="100000" bind:value={ed.pontos} /></label>
  <label class="campo">
    <span>{t("percurso.divisao")}</span>
    <select bind:value={ed.divisao}>
      <option value="">{t("percurso.sem_divisao")}</option>
      {#each DIVISOES as d}<option value={d}>{d}</option>{/each}
    </select>
  </label>
  <div class="acoes-linha">
    <button type="submit" class="botao primario" disabled={!ed.nome.trim()}>{t("percurso.salvar")}</button>
    <button type="button" class="botao" onclick={oncancelar}>{t("timer.cancelar")}</button>
  </div>
</form>

<style>
  .edicao { display: grid; gap: 0.5rem; }
  .campo { display: grid; gap: 0.2rem; }
  .campo span { font-size: 0.9rem; color: var(--suave); }
  .campo select,
  .campo input {
    width: 100%; box-sizing: border-box; min-height: 3rem; font-size: 1rem; padding: 0 0.6rem; border-radius: 0.75rem;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  .acoes-linha { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .acoes-linha .botao { flex: 1; }
</style>
