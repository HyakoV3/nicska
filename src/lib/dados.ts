// Os dados do aparelho (backup, importar, compartilhar um arquivo JSON): a lógica que o Histórico e Ajustes dividem. Sem interface.
import { armazenamento } from "./armazenamento";
import { compartilharArquivo, podeCompartilhar } from "./compartilhar";
import { ErroDeDocumento, LIMITES, lerDocumento, montarBackup, type Atirador, type Importavel, type Novidades } from "./documento";
import { traduzirErro } from "./erros";
import { salvarAtirador } from "./registro";

declare const __APP_VERSAO__: string;
declare const __APP_COMMIT__: string;

export const versaoDoApp = (): string => `${__APP_VERSAO__} (${__APP_COMMIT__})`;
export const hoje = (): string => new Date().toISOString().slice(0, 10);

/**
 * Entrega um JSON pela folha de compartilhamento do aparelho (ou baixa, no navegador). Joga se a folha não abriu.
 * Sem indentação (menor, para caber no limite de importação). Devolve os bytes e se passam de `limite` (o arquivo não reimportaria).
 */
export async function entregarJson(objeto: unknown, nome: string, limite: number = LIMITES.bytes): Promise<{ bytes: number; acimaDoLimite: boolean }> {
  const blob = new Blob([JSON.stringify(objeto)], { type: "application/json" });
  await entregarArquivo(blob, nome);
  return { bytes: blob.size, acimaDoLimite: blob.size > limite };
}

/** Entrega um arquivo (já com o tipo MIME certo) pela folha de compartilhamento, ou o baixa no navegador. Joga se a folha não abriu. */
export async function entregarArquivo(blob: Blob, nome: string): Promise<void> {
  if (podeCompartilhar()) {
    if ((await compartilharArquivo(blob, nome, nome)) === "erro") throw new Error("compartilhar");
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/** Exporta o backup de tudo (nicska-backup/1). Devolve quantos percursos e tentativas foram e `grandeDemais` (passou de 20 MiB: não reimportaria; falta chave i18n para avisar na tela). */
export async function exportarBackup(atirador: Atirador, limite: number = LIMITES.bytes): Promise<{ percursos: number; tentativas: number; grandeDemais: boolean }> {
  salvarAtirador(atirador);
  const { percursos, tentativas, atiradores } = await armazenamento.tudo();
  const { acimaDoLimite } = await entregarJson(montarBackup(versaoDoApp(), { atirador, percursos, tentativas, outros: atiradores }), `nicska-backup-${hoje()}.json`, limite);
  return { percursos: percursos.length, tentativas: tentativas.length, grandeDemais: acimaDoLimite };
}

/** Lê o texto de um arquivo do Nicska (backup ou percurso compartilhado) e importa o que é novo. Joga `ErroDeDocumento` se o arquivo não presta. */
export async function importarTexto(texto: string, meuId: string): Promise<{ doc: Importavel; novas: Novidades }> {
  const doc = lerDocumento(texto);
  const novas = await armazenamento.importarDocumento(doc, meuId); // ler os ids e gravar numa transação só
  return { doc, novas };
}

/** A mensagem de erro para a pessoa (traduzida) de uma falha ao importar ou exportar. */
export function mensagemDeErro(e: unknown, t: Parameters<typeof traduzirErro>[1]): string {
  if (e instanceof ErroDeDocumento) return traduzirErro(JSON.stringify([e.codigo, ...Object.values(e.args).map(String)]), t);
  return e instanceof Error ? e.message : String(e);
}
