<script lang="ts">
  import Aviso from "./Aviso.svelte";
  import { exportarBackup, importarTexto, mensagemDeErro } from "./dados";
  import { lerArquivo } from "./lerArquivo";
  import { i18n } from "./i18n/index.svelte";
  import { lerAtirador } from "./registro";

  // Dados do aparelho (Ajustes → Dados): exportar tudo e importar um arquivo do Nicska. Importar nunca apaga nada: só entra o que ainda não existe.
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let aviso = $state<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  /** Roda a ação e mostra o aviso de sucesso (texto devolvido) ou de erro. */
  async function comAviso(acao: () => Promise<string>) {
    aviso = null;
    aviso = await acao().then(
      (texto) => ({ tipo: "sucesso" as const, texto }),
      (e) => ({ tipo: "erro" as const, texto: mensagemDeErro(e, t) }),
    );
  }

  const exportar = () =>
    comAviso(async () => {
      const r = await exportarBackup(lerAtirador(i18n.t("atirador.padrao")));
      return t("historico.exportado", { p: r.percursos, t: r.tentativas }) + (r.grandeDemais ? ` ${t("historico.exportado_grande")}` : "");
    });

  async function importarArquivo(arquivo: File) {
    const { novas } = await importarTexto(await lerArquivo(arquivo), lerAtirador().id);
    return t("historico.importado", { p: novas.percursos.length, t: novas.tentativas.length, j: novas.jaExistiam });
  }

  function importar(e: Event) {
    const entrada = e.currentTarget as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    entrada.value = "";
    if (!arquivo) return;
    return comAviso(() => importarArquivo(arquivo));
  }
</script>

<div class="dados">
  <p class="meta">{t("historico.backup_ajuda")}</p>
  <div class="acoes-linha">
    <button class="botao" onclick={exportar}>{t("historico.exportar")}</button>
    <label class="botao arquivo">{t("historico.importar")}<input type="file" accept="application/json,.json" onchange={importar} /></label>
  </div>
  {#if aviso}<Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>{/if}
</div>

<style>
  .dados { display: grid; gap: 0.6rem; }
  .acoes-linha { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .acoes-linha .botao { flex: 1; }
  .arquivo { position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .arquivo input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
</style>
