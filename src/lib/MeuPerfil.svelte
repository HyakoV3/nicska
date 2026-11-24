<script lang="ts">
  import { armazenamento } from "./armazenamento";
  import { recusarArquivo } from "./avatar";
  import Avatar from "./Avatar.svelte";
  import Aviso from "./Aviso.svelte";
  import EditorAvatar from "./EditorAvatar.svelte";
  import type { Chave } from "./i18n/pt";
  import { i18n } from "./i18n/index.svelte";
  import { lerAtirador, salvarAtirador } from "./registro";

  // Ajustes → Meu perfil: o nome (o mesmo do backup) e a foto, que fica só neste aparelho. Sem foto, o círculo mostra as iniciais.
  const t = (c: Chave, p?: Record<string, string | number>) => i18n.t(c, p);
  let atirador = $state(lerAtirador(i18n.t("atirador.padrao")));
  let escolhido = $state<File | null>(null);
  let versao = $state(0);
  let temFoto = $state(false);
  let aviso = $state<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  const atualizarTemFoto = () => armazenamento.lerAvatar(atirador.id).then((a) => (temFoto = a !== null), () => (temFoto = false));
  void atualizarTemFoto();

  function escolher(e: Event) {
    const entrada = e.currentTarget as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    entrada.value = "";
    if (!arquivo) return;
    const motivo = recusarArquivo(arquivo);
    aviso = motivo ? { tipo: "erro", texto: t(motivo === "grande" ? "perfil.erro_grande" : "perfil.erro_tipo") } : null;
    escolhido = motivo ? null : arquivo;
  }

  async function guardar(blob: Blob) {
    await armazenamento.salvarAvatar(atirador.id, blob);
    escolhido = null;
    versao++;
    temFoto = true;
    aviso = { tipo: "sucesso", texto: t("perfil.salvo") };
  }

  function falhou(motivo: "abrir" | "salvar") {
    if (motivo === "abrir") escolhido = null;
    aviso = { tipo: "erro", texto: t(motivo === "abrir" ? "perfil.erro_abrir" : "perfil.erro_salvar") };
  }

  async function remover() {
    await armazenamento.apagarAvatar(atirador.id).then(
      () => {
        versao++;
        temFoto = false;
        aviso = { tipo: "sucesso", texto: t("perfil.removida") };
      },
      () => (aviso = { tipo: "erro", texto: t("perfil.erro_salvar") }),
    );
  }
</script>

<div class="perfil">
  <label class="campo">
    <span>{t("perfil.nome")}</span>
    <input type="text" maxlength="80" bind:value={atirador.nome} onchange={() => salvarAtirador({ ...atirador, nome: atirador.nome.trim() || i18n.t("atirador.padrao") })} />
  </label>
  {#if escolhido}
    <EditorAvatar arquivo={escolhido} aoSalvar={guardar} aoCancelar={() => (escolhido = null)} aoFalhar={falhou} />
  {:else}
    <div class="foto">
      <Avatar id={atirador.id} nome={atirador.nome} tamanho={5} {versao} />
      <div class="botoes">
        <label class="botao arquivo">{t(temFoto ? "perfil.trocar" : "perfil.escolher")}<input type="file" accept="image/*" onchange={escolher} /></label>
        {#if temFoto}<button type="button" class="botao" onclick={remover}>{t("perfil.remover")}</button>{/if}
      </div>
    </div>
    <p class="meta">{t("perfil.ajuda")}</p>
  {/if}
  {#if aviso}<Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>{/if}
</div>

<style>
  .perfil { display: grid; gap: 0.6rem; }
  .foto { display: flex; flex-wrap: wrap; align-items: center; gap: 0.9rem; }
  .botoes { display: grid; gap: 0.5rem; flex: 1; min-width: 10rem; }
  .botoes .botao { min-height: 3rem; }
  .campo { display: grid; gap: 0.2rem; }
  .campo span { font-size: 0.9rem; color: var(--suave); }
  .campo input { width: 100%; box-sizing: border-box; min-height: 3rem; font-size: 1rem; padding: 0 0.6rem; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); }
  .arquivo { position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .arquivo input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
  .arquivo:has(input:focus-visible) { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
</style>
