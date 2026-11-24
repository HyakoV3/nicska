<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Aviso from "./Aviso.svelte";
  import Segmentos from "./Segmentos.svelte";
  import { compartilharVideo } from "./compartilhar";
  import { i18n } from "./i18n/index.svelte";
  import { lerOverlay } from "./preferencias";
  import { manterTelaAcesa } from "./telaAcesa";
  import { exportarEEntregar, nomeComTempos, type IdDoMotor, type MotorDeExportacao } from "./video/exportacao";
  import { disponibilidade, prepararEntrada, type PedidoDeExportacao } from "./video/exportarComTempos";
  import { avisoDoFim, demoraOTamanho, escolhaInicial, escolhasDaJanela, motivoSemTempos, porcentagem, type Disponibilidade, type Escolha, type FaseDaJanela } from "./video/janelaDeExportacao";

  // O conteúdo da janela de enviar o vídeo (V3), aberta pela parte "Vídeo" da pílula: escolher "Com os tempos" (gera um vídeo novo com o overlay) ou
  // "Sem os tempos" (o envio cru de antes, rápido). A escolha marcada é a chave "Tempos sobre o vídeo" de Ajustes, sem mudá-la. Exportando: a barra de progresso,
  // o aviso de deixar o app aberto (a tela fica acesa) e o Cancelar, que para de verdade. Sair da janela (X, Esc, Voltar) também cancela: o componente some
  // e o `onDestroy` aborta. O fim sobe por `onfim` (com o aviso, ou nulo), como nos outros envios. As regras estão em video/janelaDeExportacao.ts.
  type Mensagem = { tipo: "sucesso" | "erro" | "info"; texto: string } | null;
  let { pedido, nomeCru, onsem, onfim, oncancelar }: {
    pedido: PedidoDeExportacao;
    /** O nome do vídeo cru ("nicska-percurso-AAAA-MM-DD-HHMM.webm"); o exportado ganha "-tempos" e a extensão dele. */
    nomeCru: string;
    /** "Sem os tempos": quem abriu a janela fecha e envia o vídeo como foi gravado. */
    onsem: () => void;
    onfim: (m: Mensagem) => void;
    oncancelar: () => void;
  } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const uid = $props.id();

  let fase = $state<FaseDaJanela>("carregando");
  let disp = $state<(Disponibilidade & { motores: MotorDeExportacao[] }) | null>(null);
  let escolha = $state<Escolha>("sem");
  let progresso = $state<number | null>(0);
  let motor = $state<IdDoMotor | null>(null);
  let controle: AbortController | null = null;
  let vivo = true;

  const motivo = $derived(disp ? motivoSemTempos(disp) : null);
  const pct = $derived(porcentagem(progresso));
  const opcoes = $derived((disp ? escolhasDaJanela(disp) : ["sem" as const]).map((v) => ({ valor: v, texto: t(v === "com" ? "exportar.com" : "exportar.sem") })));

  onMount(async () => {
    const d = await disponibilidade(pedido);
    if (!vivo) return;
    disp = d;
    escolha = escolhaInicial(lerOverlay().ligado, d);
    fase = "escolhendo";
  });
  onDestroy(() => {
    vivo = false;
    controle?.abort();
  });

  async function exportar(motores: MotorDeExportacao[]) {
    controle = new AbortController();
    fase = "exportando";
    let entregou = false;
    let detalhe = "";
    const passos = {
      preparar: (s: AbortSignal) => prepararEntrada(pedido, s),
      motores,
      entregar: (b: Blob) => compartilharVideo(b, nomeComTempos(nomeCru, b.type), t("compartilhar_video.enviar_video")),
      manterTelaAcesa: () => manterTelaAcesa(),
    };
    const aoEntregar = () => {
      entregou = true;
      fase = "enviando";
    };
    const fim = await exportarEEntregar(passos, { aoProgresso: (f) => (progresso = f), aoMotor: (id) => (motor = id), aoEntregar, aoFalhar: (d) => (detalhe = d) }, controle.signal);
    controle = null;
    const aviso = avisoDoFim(fim, entregou);
    if (vivo) onfim(aviso ? { tipo: aviso.tipo, texto: detalhe && aviso.chave === "exportar.erro" ? `${t(aviso.chave)} [${detalhe}]` : t(aviso.chave) } : null);
  }
  const enviar = () => (escolha === "com" && disp && !motivo ? void exportar(disp.motores) : onsem());
</script>

{#if fase === "carregando"}
  <p class="meta" role="status">{t("exportar.carregando")}</p>
{:else if fase === "escolhendo"}
  <Segmentos id={`${uid}-tempos`} rotulo={t("exportar.escolha")} {opcoes} bind:valor={escolha} />
  {#if motivo}<p class="meta">{t(motivo === "sem_zero" ? "exportar.sem_zero" : "exportar.sem_motor")}</p>{/if}
  {#if escolha === "com"}
    <p class="meta">{t("exportar.com_ajuda")}</p>
    {#if disp && demoraOTamanho(disp)}<p class="meta">{t("exportar.tempo_real")}</p>{/if}
  {:else}
    <p class="meta">{t("compartilhar_video.nota")}</p>
  {/if}
  <div class="acoes">
    <button class="botao primario" onclick={enviar}>{t("exportar.enviar")}</button>
    <button class="botao" onclick={oncancelar}>{t("timer.cancelar")}</button>
  </div>
{:else}
  <p class="estado" role="status">{t(fase === "enviando" ? "exportar.enviando" : "exportar.gerando")}</p>
  <div class="barra" role="progressbar" aria-label={t("exportar.progresso")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined} aria-valuetext={pct === null ? t("exportar.gerando") : t("exportar.pronto_pct", { p: pct })}>
    <div class="cheio" style:width={`${pct ?? 0}%`}></div>
  </div>
  {#if pct !== null}<p class="meta" aria-hidden="true">{t("exportar.pronto_pct", { p: pct })}</p>{/if}
  <Aviso tipo="info">{t("exportar.aberto")}</Aviso>
  {#if motor === "tempo-real"}<p class="meta">{t("exportar.tempo_real")}</p>{/if}
  <button class="botao" onclick={() => controle?.abort()} disabled={fase === "enviando"} aria-label={t("exportar.cancelar_aria")}>{t("timer.cancelar")}</button>
{/if}

<style>
  .meta, .estado { margin: 0; }
  .estado { font-weight: 600; }
  .acoes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .acoes .botao { flex: 1 1 8rem; }
  /* A barra: trilha com borda (o limite não depende só de cor) e o preenchido na cor do tempo; sem animação (a largura só muda com o progresso). */
  .barra { height: 1rem; border: 0.0625rem solid var(--borda-controle); border-radius: 999rem; background: var(--tempo-trilha); overflow: hidden; }
  .cheio { height: 100%; background: var(--tempo-fundo); }
</style>
