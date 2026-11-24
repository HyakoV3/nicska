<script lang="ts" module>
  let contador = 0;
</script>

<script lang="ts">
  import Icone from "./Icone.svelte";
  import { i18n } from "./i18n/index.svelte";

  // Controle genérico "− valor +" (atraso, sensibilidade, tempo morto, silêncio). `valor` e os limites vêm na unidade guardada; `mostrar` o escreve
  // com a unidade; `passo` é o salto de cada toque. Alvos de 3 rem (48 px) e o valor em <output aria-live="polite">.
  let {
    rotulo,
    valor,
    min,
    max,
    passo,
    mostrar,
    aoMudar,
    desabilitado = false,
    ajuda,
  }: { rotulo: string; valor: number; min: number; max: number; passo: number; mostrar: (v: number) => string; aoMudar: (v: number) => void; desabilitado?: boolean; ajuda?: string } = $props();
  // Ajuda de uma linha (opcional): fica ligada ao grupo por aria-describedby, então o leitor de tela a lê junto com o nome.
  const idAjuda = `ajuda-controle-${++contador}`;
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  // Arredonda para o passo: 0,1 + 0,2 não pode virar 0,30000000000000004.
  const limitar = (v: number) => Math.min(max, Math.max(min, Math.round(v / passo) * passo));
  const mudar = (d: number) => aoMudar(Number(limitar(valor + d).toFixed(6)));
  const item = $derived(rotulo.toLowerCase());
</script>

<div class="controle" role="group" aria-label={rotulo} aria-describedby={ajuda ? idAjuda : undefined}>
  <span class="rotulo" aria-hidden="true">{rotulo}</span>
  <div class="passo">
    <button class="botao-barra" aria-label={t("controle.diminuir", { item })} disabled={desabilitado || valor <= min} onclick={() => mudar(-passo)}>
      <Icone nome="menos" tamanho={24} />
    </button>
    <output aria-live="polite">{mostrar(valor)}</output>
    <button class="botao-barra" aria-label={t("controle.aumentar", { item })} disabled={desabilitado || valor >= max} onclick={() => mudar(passo)}>
      <Icone nome="mais" tamanho={24} />
    </button>
  </div>
</div>
{#if ajuda}<p class="meta ajuda" id={idAjuda}>{ajuda}</p>{/if}

<style>
  .controle { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.4rem 0; }
  .ajuda { margin: -0.2rem 0 0.4rem; }
  .rotulo { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .passo { display: flex; align-items: center; gap: 0.4rem; }
  output { min-width: 4.5rem; text-align: center; font-variant-numeric: tabular-nums; font-weight: 600; }
</style>
