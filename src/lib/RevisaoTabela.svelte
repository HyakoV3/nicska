<script lang="ts">
  import { i18n } from "./i18n/index.svelte";
  import { apagarDisparo, type Edicao } from "./revisao";
  import { formatarSegundos, type Resumo } from "./tentativa";

  // A tabela de disparos e splits da Revisão. Com o áudio decodificado (`comAudio`) cada linha ganha ouvir o trecho e apagar (duplo toque, com confirmação).
  let { edicao = $bindable(), resumo, selecionado = $bindable(), confirmando = $bindable(), comAudio, ouvir }: {
    edicao: Edicao;
    resumo: Resumo;
    selecionado: number | null;
    confirmando: number | null;
    comAudio: boolean;
    ouvir: (ms: number) => void;
  } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const seg = (ms: number) => formatarSegundos(ms, i18n.idioma);

  function apagar(i: number) {
    if (confirmando !== i) {
      confirmando = i;
      return;
    }
    confirmando = null;
    selecionado = null;
    edicao = apagarDisparo(edicao, i);
  }
</script>

<table>
  <caption>{t("timer.tabela_splits")}</caption>
  <thead><tr><th scope="col">{t("timer.col_disparo")}</th><th scope="col">{t("timer.col_tempo")}</th><th scope="col">{t("timer.col_split")}</th>{#if comAudio}<th scope="col"><span class="so-leitor">{t("revisao.acoes")}</span></th>{/if}</tr></thead>
  <tbody>
    {#each edicao.disparosMs as ms, i (ms)}
      <tr class:sel={selecionado === i}>
        <th scope="row">{i + 1}</th>
        <td>{seg(ms)}</td>
        <td>{i === 0 ? seg(ms) : seg(resumo.splits[i - 1])}</td>
        {#if comAudio}
          <td class="acoes-linha">
            <button class="botao-barra" aria-label={`${t("revisao.ouvir")}: ${t("timer.col_disparo")} ${i + 1}`} onclick={() => ouvir(ms)}>▶</button>
            <button class="botao perigo" class:confirmar={confirmando === i} aria-label={`${confirmando === i ? t("revisao.apagar_mesmo") : t("revisao.apagar")}: ${t("timer.col_disparo")} ${i + 1}`} onclick={() => apagar(i)}>
              {confirmando === i ? t("revisao.apagar_mesmo") : t("revisao.apagar")}
            </button>
          </td>
        {/if}
      </tr>
    {/each}
  </tbody>
</table>

<style>
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; margin-top: 0.6rem; }
  caption { text-align: left; color: var(--suave); padding: 0.4rem 0; }
  th, td { padding: 0.4rem 0.5rem; text-align: right; border-top: 0.0625rem solid var(--borda); }
  th[scope="row"], thead th:first-child { text-align: left; }
  tr.sel { outline: 0.125rem solid var(--acento); outline-offset: -0.125rem; }
  .acoes-linha { display: flex; gap: 0.4rem; justify-content: flex-end; }
</style>
