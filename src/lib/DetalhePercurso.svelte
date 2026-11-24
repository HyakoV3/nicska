<script lang="ts">
  import { untrack } from "svelte";
  import Aviso from "./Aviso.svelte";
  import EdicaoPercurso from "./EdicaoPercurso.svelte";
  import Janela from "./Janela.svelte";
  import Graficos from "./Graficos.svelte";
  import ListaTentativas from "./ListaTentativas.svelte";
  import MenuPercurso from "./MenuPercurso.svelte";
  import Ranking from "./Ranking.svelte";
  import Secoes from "./Secoes.svelte";
  import { armazenamento, TAMANHO_DA_PAGINA, type Posicao } from "./armazenamento";
  import { entregarJson, hoje, versaoDoApp } from "./dados";
  import { agruparEmSessoes, montarCompartilhado, type Atirador, type Percurso, type TentativaGuardada } from "./documento";
  import { data, motivo, seg } from "./formatosHistorico";
  import { i18n } from "./i18n/index.svelte";
  import { salvarAtirador } from "./registro";

  // O percurso aberto no Histórico: o menu "⋯", a edição e as abas internas (Visão geral, Tentativas, Análises, Comparar). Carrega as tentativas (a lista por páginas
  // e todas, para os gráficos) ao abrir e sempre que `versao` muda; a aba interna escolhida (`secao`) é do pai, então uma recarga não a devolve à Visão geral.
  type Mensagem = { tipo: "sucesso" | "erro" | "info"; texto: string } | null;
  let { percurso, atirador, nTentativas, versao, secao = $bindable(), onerro, onmudou, onvoltar, onapagado }: {
    percurso: Percurso;
    atirador: Atirador;
    nTentativas: number;
    versao: number;
    secao: string;
    onerro: (msg: string) => void;
    onmudou: () => void;
    onvoltar: () => void;
    onapagado: () => void;
  } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const SECOES = ["visao", "tentativas", "analises", "comparar"] as const;

  let tentativas = $state<TentativaGuardada[]>([]);
  /** Todas as tentativas do percurso (para os gráficos); a lista da aba Tentativas carrega por páginas. */
  let todas = $state<TentativaGuardada[]>([]);
  let temMais = $state(false);
  let editando = $state(false);
  // O Voltar do Android fecha a janela de edição e volta ao detalhe (CONS-030): quem registra o nível é a `Janela`.
  let aviso = $state<Mensagem>(null);
  let pedido = 0;

  const sessoes = $derived(agruparEmSessoes(tentativas));
  // Os números da Visão geral, das tentativas com disparos (as minhas).
  const indicadores = $derived.by(() => {
    const totais = todas.filter((x) => x.disparos_ms.length > 0).map((x) => x.disparos_ms[x.disparos_ms.length - 1]);
    if (totais.length === 0) return null;
    const ultima = Math.max(...todas.map((x) => x.quando));
    return { n: totais.length, melhor: Math.min(...totais), media: totais.reduce((a, b) => a + b, 0) / totais.length, ultima };
  });

  async function carregar() {
    const meu = ++pedido;
    try {
      const pg = await armazenamento.tentativas(percurso.id, TAMANHO_DA_PAGINA, undefined, atirador.id);
      const tudo = await armazenamento.todasDoPercurso(percurso.id, atirador.id);
      if (meu !== pedido) return; // uma carga mais nova já está a caminho
      tentativas = pg.itens;
      temMais = pg.temMais;
      todas = tudo;
    } catch (e) {
      onerro(motivo(e));
    }
  }
  $effect(() => {
    void [versao, percurso.id];
    untrack(() => void carregar());
  });

  async function maisTentativas() {
    if (tentativas.length === 0) return;
    const u = tentativas[tentativas.length - 1];
    const antes: Posicao = { quando: u.quando, id: u.id };
    try {
      const pg = await armazenamento.tentativas(percurso.id, TAMANHO_DA_PAGINA, antes, atirador.id);
      tentativas = [...tentativas, ...pg.itens];
      temMais = pg.temMais;
    } catch (e) {
      onerro(motivo(e));
    }
  }

  async function salvarEdicao(novo: Percurso) {
    try {
      await armazenamento.salvarPercurso(novo);
      editando = false;
      onmudou();
    } catch (e) {
      onerro(motivo(e));
    }
  }
  async function apagarPercurso() {
    try {
      await armazenamento.apagarPercurso(percurso.id);
      onapagado();
    } catch (e) {
      onerro(motivo(e));
    }
  }

  /** O nome do percurso como parte de um nome de arquivo: sem acento nem símbolos. */
  const nomeLimpo = (nome: string) => nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "percurso";

  /** Monta o arquivo do percurso aberto com as MINHAS tentativas nele e o entrega; devolve quantas foram. */
  async function entregarPercurso() {
    salvarAtirador(atirador);
    const minhas = await armazenamento.todasDoPercurso(percurso.id, atirador.id);
    const doc = montarCompartilhado(versaoDoApp(), atirador, percurso, minhas);
    await entregarJson(doc, `nicska-${nomeLimpo(percurso.nome)}-${hoje()}.json`);
    return minhas.length;
  }

  /** Compartilha o percurso aberto e as MINHAS tentativas nele (nicska/1, sem áudio). */
  async function compartilharPercurso() {
    aviso = null;
    aviso = await entregarPercurso().then(avisoDePercursoPronto, avisoDeErro);
  }

  const avisoDePercursoPronto = (n: number) => ({ tipo: "sucesso" as const, texto: t("historico.percurso_pronto", { t: n }) });
  const avisoDeErro = (e: unknown) => ({ tipo: "erro" as const, texto: motivo(e) });
</script>

<div class="topo-percurso">
  <button class="botao" onclick={onvoltar}>← {t("historico.voltar")}</button>
  <MenuPercurso tentativas={nTentativas} oncompartilhar={compartilharPercurso} oneditar={() => (editando = true)} onapagar={apagarPercurso} />
</div>
<h2>{percurso.nome}</h2>
{#if percurso.disparos_minimos || percurso.pontos_maximos || percurso.divisao}
  <p class="meta">{[percurso.disparos_minimos ? i18n.tn("plural.disparos", percurso.disparos_minimos) : "", percurso.pontos_maximos ? t("pontos.total", { n: percurso.pontos_maximos }) : "", percurso.divisao ?? ""].filter(Boolean).join(" · ")}</p>
{/if}
{#if aviso}<Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>{/if}
{#if editando}
  <Janela titulo={t("percurso.editar")} onfechar={() => (editando = false)}>
    <EdicaoPercurso {percurso} onsalvar={salvarEdicao} oncancelar={() => (editando = false)} />
  </Janela>
{/if}
<Secoes abas={SECOES.map((id) => ({ id, rotulo: t(`historico.aba_${id}`) }))} bind:selecionada={secao} rotulo={t("historico.abas")} prefixo="hist" />

<div role="tabpanel" id="hist-painel-visao" aria-labelledby="hist-aba-visao" hidden={secao !== "visao"} class="painel">
  {#if indicadores}
    <dl class="numeros">
      <div><dt>{t("historico.ind_melhor")}</dt><dd>{seg(indicadores.melhor)} s</dd></div>
      <div><dt>{t("historico.ind_media")}</dt><dd>{seg(indicadores.media)} s</dd></div>
      <div><dt>{t("historico.ind_tentativas")}</dt><dd>{indicadores.n}</dd></div>
      <div><dt>{t("historico.ind_ultima")}</dt><dd>{data(indicadores.ultima)}</dd></div>
    </dl>
  {/if}
  <Graficos tentativas={todas} secao="visao" />
</div>

<div role="tabpanel" id="hist-painel-tentativas" aria-labelledby="hist-aba-tentativas" hidden={secao !== "tentativas"} class="painel">
  <ListaTentativas {sessoes} {percurso} {atirador} {temMais} onmais={maisTentativas} {onmudou} {onerro} onaviso={(a) => (aviso = a)} />
</div>

<div role="tabpanel" id="hist-painel-analises" aria-labelledby="hist-aba-analises" hidden={secao !== "analises"} class="painel">
  <Graficos tentativas={todas} secao="analises" />
</div>

<div role="tabpanel" id="hist-painel-comparar" aria-labelledby="hist-aba-comparar" hidden={secao !== "comparar"} class="painel">
  <Graficos tentativas={todas} secao="comparar" />
  <Ranking {percurso} eu={atirador} versao={todas.length} />
</div>

<style>
  h2 { margin: 0.6rem 0 0.2rem; font-size: 1.1rem; }
  .topo-percurso { display: flex; gap: 0.5rem; align-items: flex-start; justify-content: space-between; position: relative; }
  .painel { display: grid; gap: 0.6rem; }
  .painel[hidden] { display: none; }
  .painel > :global(*) { min-width: 0; }
  .numeros { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; margin: 0.4rem 0; }
  .numeros div { padding: 0.5rem 0.8rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); }
  .numeros dt { font-size: 0.9rem; color: var(--suave); }
  .numeros dd { margin: 0; font-size: 1.2rem; font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
