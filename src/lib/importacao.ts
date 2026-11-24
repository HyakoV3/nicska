// Importar um arquivo do Nicska em duas etapas (CONS-014): primeiro uma PRÉVIA (ler, validar e contar o que entraria, sem gravar nada) e só depois, com a confirmação
// da pessoa, gravar. Usa a API pública de `documento.ts` e do `armazenamento`. Um backup (`nicska-backup/1`) de OUTRA pessoa traz as tentativas sem `atirador_id`,
// que o app trataria como minhas (DADOS-001): nesse caso a pessoa diz se é o seu backup (restaurar) ou de outra pessoa (entra como dela, para o ranking).
import { armazenamento } from "./armazenamento";
import { lerDocumento, novidades, type Importavel, type JaAqui, type Novidades } from "./documento";

/** De quem são as tentativas sem `atirador_id` de um backup: "meu" (restaurar o meu histórico) ou "outro" (do atirador que exportou). */
export type Dono = "meu" | "outro";

export type Previa = {
  doc: Importavel;
  /** O que entraria agora (nada foi gravado). */
  novas: Novidades;
  /** A pessoa precisa escolher o `Dono` antes de importar. */
  perguntaDono: boolean;
};

/** É um backup de outro atirador, com tentativas sem dono declarado: sem perguntar, elas virariam minhas. */
export function precisaPerguntarDono(doc: Importavel, meuId: string): boolean {
  return doc.origem === "backup" && doc.atirador.id !== meuId && doc.tentativas.some((t) => t.atirador_id === undefined);
}

/** O documento com as tentativas sem dono atribuídas a quem exportou o arquivo (a escolha "outra pessoa"). */
export function comoDeOutro(doc: Importavel): Importavel {
  const comDono = (t: Importavel["tentativas"][number]) => (t.atirador_id === undefined ? { ...t, atirador_id: doc.atirador.id } : t);
  return { ...doc, tentativas: doc.tentativas.map(comDono) };
}

/** O que entra, dado quem é o dono das tentativas sem `atirador_id` (puro: `aqui` são os ids que já existem). */
export function novidadesDoDono({ doc, aqui, meuId, dono }: { doc: Importavel; aqui: JaAqui; meuId: string; dono: Dono }): Novidades {
  return novidades(dono === "outro" ? comoDeOutro(doc) : doc, aqui, meuId);
}

/** Lê e valida o texto e conta o que entraria, sem gravar. Joga `ErroDeDocumento` se o arquivo não presta. */
export async function prepararImportacao(texto: string, meuId: string): Promise<Previa> {
  const doc = lerDocumento(texto);
  const aqui = await armazenamento.ids();
  const novas = novidadesDoDono({ doc, aqui, meuId, dono: "meu" });
  return { doc, novas, perguntaDono: precisaPerguntarDono(doc, meuId) };
}

/** Grava a prévia confirmada (releio os ids: o que entrou entre a prévia e o toque em Importar não duplica). Devolve o que entrou. */
export async function confirmarImportacao({ previa, meuId, dono }: { previa: Previa; meuId: string; dono: Dono }): Promise<Novidades> {
  const novas = novidadesDoDono({ doc: previa.doc, aqui: await armazenamento.ids(), meuId, dono });
  await armazenamento.importar(novas);
  return novas;
}
