<script lang="ts" generics="V extends string | number | null">
  import Icone from "./Icone.svelte";

  // Um grupo de opções lado a lado, de uma só escolha (botões de rádio por baixo): a escolhida tem "✓", negrito e borda de acento (não só cor).
  // O rótulo visível dá o nome ao grupo (aria-labelledby). `id` junta rótulo e nome do rádio; tem de ser único na tela.
  // `desabilitado`: o grupo inteiro fica travado (ex.: o modo de registro durante o Standby).
  let { id, rotulo, opcoes, valor = $bindable(), aoMudar, desabilitado = false }: { id: string; rotulo: string; opcoes: { valor: V; texto: string }[]; valor: V; aoMudar?: (v: V) => void; desabilitado?: boolean } = $props();
</script>

<p class="rotulo-grupo" id={`rotulo-${id}`}>{rotulo}</p>
<fieldset class="segmentos" aria-labelledby={`rotulo-${id}`} disabled={desabilitado}>
  {#each opcoes as o (o.valor)}
    <label class:ativo={valor === o.valor}>
      <input type="radio" name={id} checked={valor === o.valor} onchange={() => { valor = o.valor; aoMudar?.(o.valor); }} />
      <span>{#if valor === o.valor}<Icone nome="ok" tamanho={18} />{/if}{o.texto}</span>
    </label>
  {/each}
</fieldset>

<style>
  .rotulo-grupo { margin: 0.9rem 0 0.35rem; font-size: 0.9rem; color: var(--suave); }
  .segmentos { display: grid; grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr)); gap: 0.4rem; margin: 0; padding: 0; border: 0; }
  label { position: relative; }
  input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  span { display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; width: 100%; min-height: 3rem; box-sizing: border-box; padding: 0 0.5rem; text-align: center; border-radius: 0.75rem; font-size: 0.95rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); }
  .ativo span { border: 0.125rem solid var(--acento); font-weight: 700; }
  fieldset:disabled span { opacity: 0.6; }
  fieldset:disabled input { cursor: not-allowed; }
  input:focus-visible + span { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
</style>
