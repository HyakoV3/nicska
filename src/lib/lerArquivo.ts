// Ler o arquivo que a pessoa escolheu (importar backup ou percurso) sem trazer um arquivo enorme para a memória.
import { ErroDeDocumento, LIMITES } from "./documento";

/** Lê o texto de um arquivo. Recusa por `size` ANTES de ler se passar de `LIMITES.bytes` (`grande_demais`). O BOM fica por conta do parser. */
export async function lerArquivo(arquivo: Pick<File, "size" | "text">, limite: number = LIMITES.bytes): Promise<string> {
  if (arquivo.size > limite) throw new ErroDeDocumento("grande_demais");
  return arquivo.text();
}
