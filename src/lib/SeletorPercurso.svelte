<script lang="ts">
  import { onMount } from "svelte";
  import { armazenamento } from "./armazenamento";
  import type { Percurso } from "./documento";
  import { idEstavelPorNome } from "./drills";
  import Icone from "./Icone.svelte";
  import Janela from "./Janela.svelte";
  import { i18n } from "./i18n/index.svelte";
  import { lembrar, sugerir, type NomeLembrado } from "./nomesDePercurso";
  import { lerNomesDePercurso, salvarNomesDePercurso } from "./preferencias";
  import { escolherPercurso, novoId, percursoEscolhido } from "./registro";

  // O percurso em que a próxima tentativa será salva: uma pílula [ lista | + ]; o "+" abre uma janela com o formulário de um percurso novo (sem nome pronto: as sugestões vêm do que a pessoa já digitou).
  let { percursoId = $bindable<string | null>(null), pontosMaximos = $bindable<number | undefined>(undefined), desabilitado = false, memorizar = true }: {
    percursoId?: string | null;
    pontosMaximos?: number;
    desabilitado?: boolean;
    /** Falso: não lê nem grava o "percurso escolhido" do Cronômetro (a janela de trocar o percurso de uma tentativa salva); parte do `percursoId` recebido. */
    memorizar?: boolean;
  } = $props();
  $effect(() => {
    pontosMaximos = lista.find((p) => p.id === percursoId)?.pontos_maximos;
  });
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  let lista = $state<Percurso[]>([]);
  let criando = $state(false);
  let nome = $state("");
  let disparos = $state("");
  let erro = $state("");
  /** Os nomes já digitados neste aparelho (com os disparos): a fonte das sugestões enquanto a pessoa escreve. */
  let lembrados = $state<NomeLembrado[]>(lerNomesDePercurso());
  const sugestoes = $derived(sugerir(lembrados, nome, lista.map((p) => p.nome)));

  onMount(async () => {
    try {
      lista = await armazenamento.percursos();
    } catch (e) {
      erro = mensagemDe(e);
    }
    const guardado = memorizar ? percursoEscolhido() : percursoId;
    percursoId = lista.some((p) => p.id === guardado) ? guardado : (lista[0]?.id ?? null);
    aprender(lista.map((p) => ({ nome: p.nome, disparos: p.disparos_minimos })).reverse()); // os que já existem também viram sugestão se forem apagados depois
  });

  function escolher(id: string) {
    percursoId = id;
    if (memorizar) escolherPercurso(id);
  }

  function fecharFormulario() {
    nome = "";
    disparos = "";
    criando = false;
  }

  function jaTem(id: string) {
    escolher(id); // CONS-026: o percurso-modelo já existe aqui (mesmo id estável): usa o que há, sem duplicar
    fecharFormulario();
  }

  /** Guarda os nomes (do mais antigo ao mais novo, o último fica no topo). */
  function aprender(itens: NomeLembrado[]) {
    lembrados = itens.reduce(lembrar, lembrados);
    salvarNomesDePercurso(lembrados);
  }

  const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

  function montarPercurso(id: string, n: string): Percurso {
    const d = Number.parseInt(disparos, 10);
    const minimos = Number.isInteger(d) && d >= 1 && d <= 500 ? { disparos_minimos: d } : {};
    return { id, nome: n.slice(0, 80), ...minimos, criado_em: Date.now() };
  }

  function usarSugestao(x: NomeLembrado) {
    nome = x.nome;
    disparos = x.disparos ? String(x.disparos) : "";
  }

  async function criar(e: Event) {
    e.preventDefault();
    const n = nome.trim();
    if (!n) return;
    const doPronto = idEstavelPorNome(n, (d) => (d.chave ? t(d.chave) : d.nome)); // quem escreve "Bill Drill" cai no mesmo id de todo mundo
    if (doPronto && lista.some((x) => x.id === doPronto)) return jaTem(doPronto);
    const p = montarPercurso(doPronto ?? novoId(), n);
    try {
      await armazenamento.salvarPercurso(p);
    } catch (err) {
      erro = mensagemDe(err);
      return;
    }
    aprender([{ nome: p.nome, disparos: p.disparos_minimos }]);
    lista = [p, ...lista];
    escolher(p.id);
    fecharFormulario();
    erro = "";
  }
</script>

<div class="percurso">
  <span class="rotulo">{t("percurso.rotulo")}</span>
  <!-- A pílula: a lista de percursos e, na ponta, o "+" que abre a janela de um percurso novo. -->
  <div class="pilula">
    {#if lista.length > 0}
      <!-- O seletor sem o desenho nativo (que some quando se tira a borda): a seta é o mesmo ícone "abrir" dos cartões. -->
      <div class="caixa">
        <select aria-label={t("percurso.rotulo")} value={percursoId ?? ""} disabled={desabilitado} onchange={(e) => escolher(e.currentTarget.value)}>
          {#each lista as p (p.id)}<option value={p.id}>{p.nome}</option>{/each}
        </select>
        <span class="seta"><Icone nome="abrir" tamanho={24} /></span>
      </div>
    {:else}
      <p class="vazio">{t("percurso.sem")}</p>
    {/if}
    <button type="button" class="mais" aria-label={t("percurso.novo")} title={t("percurso.novo")} disabled={desabilitado} onclick={() => (criando = true)}><Icone nome="mais" tamanho={24} /></button>
  </div>

  {#if criando}
    <Janela titulo={t("percurso.novo")} onfechar={fecharFormulario}>
      <form onsubmit={criar}>
        <label>
          <span>{t("percurso.nome")}</span>
          <input type="text" bind:value={nome} maxlength="80" required />
        </label>
        <label>
          <span>{t("percurso.disparos")}</span>
          <input type="number" inputmode="numeric" min="1" max="500" bind:value={disparos} />
        </label>
        {#if sugestoes.length > 0}
          <p class="meta">{t("percurso.sugestoes")}</p>
          <div class="sugestoes">
            {#each sugestoes as x (x.nome)}
              <button type="button" class="botao" onclick={() => usarSugestao(x)}>{x.nome}</button>
            {/each}
          </div>
        {/if}
        <div class="linha">
          <button type="submit" class="botao primario" disabled={!nome.trim()}>{t("percurso.criar")}</button>
          <button type="button" class="botao" onclick={fecharFormulario}>{t("timer.cancelar")}</button>
        </div>
      </form>
    </Janela>
  {/if}
  {#if erro}<p class="meta" role="alert">{erro}</p>{/if}
</div>

<style>
  .percurso { display: grid; gap: 0.5rem; }
  .rotulo { font-size: 0.9rem; color: var(--suave); }
  .pilula { display: flex; align-items: stretch; min-height: 3rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); overflow: hidden; }
  .pilula:focus-within { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
  .caixa { position: relative; flex: 1; min-width: 0; display: flex; }
  .pilula select { appearance: none; -webkit-appearance: none; flex: 1; min-width: 0; border: 0; background: transparent; color: var(--texto); font-size: 1rem; padding: 0 2.6rem 0 0.75rem; text-overflow: ellipsis; }
  .seta { position: absolute; inset: 0 0.6rem 0 auto; display: grid; place-items: center; color: var(--suave); pointer-events: none; }
  .pilula select:focus-visible { outline: none; }
  .vazio { flex: 1; margin: 0; align-self: center; padding: 0 0.6rem; font-size: 0.9rem; color: var(--suave); }
  .mais { flex: none; width: 3.5rem; border: 0; border-inline-start: 0.0625rem solid var(--borda-controle); background: var(--acento-botao); color: var(--acento-texto); display: grid; place-items: center; cursor: pointer; }
  .mais:disabled { opacity: 0.5; cursor: default; }
  .mais:focus-visible { outline: 0.1875rem solid var(--foco); outline-offset: -0.25rem; }
  label { display: grid; gap: 0.2rem; }
  label span { font-size: 0.9rem; color: var(--suave); }
  input {
    width: 100%; box-sizing: border-box; min-height: 3rem; font-size: 1rem; padding: 0 0.6rem; border-radius: 0.75rem;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  form { display: grid; gap: 0.5rem; }
  .sugestoes { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .linha { display: flex; gap: 0.5rem; }
  .linha .botao { flex: 1; }
</style>
