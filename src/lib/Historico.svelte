<script lang="ts">
  import { untrack } from "svelte";
  import Aviso from "./Aviso.svelte";
  import DetalhePercurso from "./DetalhePercurso.svelte";
  import Estado from "./Estado.svelte";
  import ListaPercursos from "./ListaPercursos.svelte";
  import { armazenamento, type ResumoDoPercurso } from "./armazenamento";
  import { interpretarRecebido } from "./compartilhar";
  import ConfirmarImportacao from "./ConfirmarImportacao.svelte";
  import { mensagemDeErro } from "./dados";
  import type { Percurso } from "./documento";
  import { motivo } from "./formatosHistorico";
  import { i18n } from "./i18n/index.svelte";
  import { confirmarImportacao, prepararImportacao, type Dono, type Previa } from "./importacao";
  import { inicio } from "./inicio.svelte";
  import { registrarNivel } from "./navegacao";
  import { lerAtirador } from "./registro";
  import { lerArquivo } from "./lerArquivo";

  // A aba Histórico: os percursos (com quantas tentativas e o melhor tempo) e, ao abrir um, o detalhe (DetalhePercurso); mais importar um arquivo do Nicska.
  let { ativa = true }: { ativa?: boolean } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  let carregando = $state(true);
  let erro = $state("");
  let percursos = $state<Percurso[]>([]);
  let resumos = $state<Record<string, ResumoDoPercurso>>({});
  let aberto = $state<Percurso | null>(null);
  /** A aba interna do percurso aberto. Fica aqui (e não no detalhe) para uma recarga, ou sair e voltar à aba, não a devolver à Visão geral. */
  let secao = $state("visao");
  /** Sobe a cada recarga: o detalhe do percurso aberto relê as tentativas. */
  let versao = $state(0);
  let aviso = $state<{ tipo: "sucesso" | "erro" | "info"; texto: string } | null>(null);
  let atirador = $state(lerAtirador(i18n.t("atirador.padrao")));
  /** Um arquivo lido e à espera de a pessoa confirmar: nada foi gravado ainda (CONS-014). */
  // `$state.raw`: a prévia vai para o IndexedDB, que não clona o proxy do `$state` ("could not be cloned").
  let pendente = $state.raw<Previa | null>(null);

  /** Depois de recarregar: o percurso aberto vira a versão nova dele; se sumiu (apagado em outro lugar), volta à lista. */
  function atualizarAberto() {
    if (!aberto) return;
    const id = aberto.id;
    aberto = percursos.find((p) => p.id === id) ?? null;
    versao++;
  }

  async function recarregar() {
    carregando = true;
    erro = "";
    await Promise.all([armazenamento.percursos(), armazenamento.resumoPorPercurso(atirador.id)])
      .then(([ps, rs]) => {
        [percursos, resumos] = [ps, rs];
        atualizarAberto();
      })
      .catch((e) => (erro = motivo(e)));
    carregando = false;
  }

  // Recarrega sempre que a aba aparece: uma tentativa salva no Timer entra na lista sem a pessoa fazer nada.
  $effect(() => {
    if (ativa) untrack(() => void recarregar());
  });

  /** A pessoa tocou num percurso da lista: abre na Visão geral. */
  function abrir(p: Percurso) {
    aberto = p;
    secao = "visao";
  }
  function fechar() {
    aberto = null;
  }

  // O Voltar do Android sobe um nível: a confirmação da importação se cancela; o detalhe volta à lista (CONS-030). Só enquanto a aba está à vista.
  const detalheAberto = $derived(aberto !== null);
  const importando = $derived(pendente !== null);
  $effect(() => {
    if (ativa && detalheAberto) return registrarNivel(fechar);
  });
  $effect(() => {
    if (ativa && importando) return registrarNivel(() => (pendente = null));
  });
  function apagado() {
    fechar();
    void recarregar();
  }

  // Um arquivo que outro app mandou abrir no Nicska chega por `inicio.recebido`.
  $effect(() => {
    const bruto = inicio.recebido;
    if (bruto === null) return;
    inicio.recebido = null;
    const recebido = interpretarRecebido(bruto);
    if ("erro" in recebido) aviso = { tipo: "erro", texto: t("historico.recebido_erro") };
    else void importarTexto(recebido.texto);
  });

  async function importar(e: Event) {
    const entrada = e.currentTarget as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    entrada.value = "";
    if (!arquivo) return;
    const texto = await lerArquivo(arquivo).catch(avisarErroDeImportacao);
    if (texto != null) await importarTexto(texto);
  }

  /** Lê o arquivo e mostra o que entraria; só grava em `confirmar`. */
  async function importarTexto(texto: string) {
    aviso = null;
    pendente = await prepararImportacao(texto, lerAtirador().id).catch(avisarErroDeImportacao);
  }

  /** Mostra o erro da importação e devolve null (não há prévia a confirmar). */
  function avisarErroDeImportacao(err: unknown) {
    aviso = { tipo: "erro", texto: mensagemDeErro(err, t) };
    return null;
  }

  /** O aviso de sucesso de uma importação confirmada (com "de <nome>" quando veio compartilhada por outra pessoa). */
  function avisoImportado(previa: Previa, n: Awaited<ReturnType<typeof confirmarImportacao>>) {
    const de = previa.doc.origem === "compartilhado" && n.atiradores.length ? ` ${t("historico.importado_de", { nome: previa.doc.atirador.nome })}` : "";
    return t("historico.importado", { p: n.percursos.length, t: n.tentativas.length, j: n.jaExistiam }) + de;
  }

  async function confirmar(dono: Dono) {
    const previa = pendente;
    if (!previa) return;
    pendente = null;
    await gravarImportacao(previa, dono).catch(avisarErroDeImportacao);
  }

  async function gravarImportacao(previa: Previa, dono: Dono) {
    const n = await confirmarImportacao({ previa, meuId: lerAtirador().id, dono });
    aviso = { tipo: "sucesso", texto: avisoImportado(previa, n) };
    await recarregar();
  }
</script>

{#if ativa}
  <div class="historico">
    {#if erro}<Aviso tipo="erro">{t("historico.erro", { motivo: erro })}</Aviso>{/if}
    {#if aviso}<Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>{/if}

    {#if pendente}
      <ConfirmarImportacao previa={pendente} onimportar={confirmar} oncancelar={() => (pendente = null)} />
    {:else if carregando && percursos.length === 0}
      <Estado tipo="carregando" texto={t("revisao.carregando")} />
    {:else if aberto}
      <DetalhePercurso percurso={aberto} {atirador} nTentativas={resumos[aberto.id]?.tentativas ?? 0} {versao} bind:secao onerro={(m) => (erro = m)} onmudou={recarregar} onvoltar={fechar} onapagado={apagado} />
    {:else}
      {#if percursos.length === 0}
        <Estado tipo="vazio" texto={t("historico.vazio")} />
      {:else}
        <ListaPercursos {percursos} {resumos} onabrir={abrir} />
      {/if}

      <label class="botao arquivo">{t("historico.importar_arquivo")}<input type="file" accept="application/json,.json" onchange={importar} /></label>
    {/if}
  </div>
{/if}

<style>
  .historico { display: grid; gap: 0.6rem; }
  .historico > :global(*) { min-width: 0; }
  .arquivo { position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer; box-sizing: border-box; min-height: 3rem; line-height: normal; }
  .arquivo input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
</style>
