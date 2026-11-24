// Percursos e atiradores (as outras pessoas, de arquivos importados).
import { pedido, transacao } from "../banco";
import type { Atirador, Percurso } from "../documento";
import { BaseDoArmazenamento } from "./base";

/** Os atiradores por nome (e `id` para desempatar). */
export const porNomeDoAtirador = (x: Atirador, y: Atirador): number => x.nome.localeCompare(y.nome) || x.id.localeCompare(y.id);

export class ArmazenamentoDePercursos extends BaseDoArmazenamento {
  /** Os percursos, do mais novo para o mais antigo. */
  async percursos(): Promise<Percurso[]> {
    const b = await this.abrir();
    const todos = await transacao(b, ["percursos"], "readonly", (t) => pedido(t.objectStore("percursos").getAll() as IDBRequest<Percurso[]>));
    return todos.sort((x, y) => y.criado_em - x.criado_em || x.nome.localeCompare(y.nome));
  }

  async salvarPercurso(p: Percurso): Promise<void> {
    const b = await this.abrir();
    await transacao(b, ["percursos"], "readwrite", (t) => {
      t.objectStore("percursos").put(p);
    });
  }

  /** As outras pessoas (de arquivos importados), por nome. */
  async atiradores(): Promise<Atirador[]> {
    const b = await this.abrir();
    const todos = await transacao(b, ["atiradores"], "readonly", (t) => pedido(t.objectStore("atiradores").getAll() as IDBRequest<Atirador[]>));
    return todos.sort(porNomeDoAtirador);
  }
}
