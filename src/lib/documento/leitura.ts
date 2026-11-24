// Ler e validar o texto de um arquivo do Nicska, de qualquer um dos dois formatos: `nicska-backup/1` (o backup do aparelho) e `nicska/1` (um percurso compartilhado).
// A validação é toda em TypeScript, na WebView (não existe validação em Rust, docs/FORMATO.md). Campos desconhecidos são ignorados e não voltam no que se guarda.
import { bytesDoTexto, ehObjeto, invalido, listaAte, semRepetidos } from "./campos";
import { lerAtirador, lerOutrosAtiradores, lerPercurso } from "./percurso";
import { idsDe, mensagemDe, opcional, textoCurto } from "./util";
import { lerTentativa, type ContextoDeLeitura } from "./tentativa";
import { ErroDeDocumento, FORMATO_BACKUP, FORMATO_COMPARTILHADO, LIMITES, type Atirador, type Backup, type Importavel } from "./tipos";

/** O arquivo cabe no limite? Mede BYTES em UTF-8 (um texto de acentos ou CJK passa dos 20 MiB com menos caracteres). Sem codificar quando é óbvio. */
function cabeNoLimite(t: string): boolean {
  if (t.length > LIMITES.bytes) return false;
  return t.length * 3 <= LIMITES.bytes || bytesDoTexto(t) <= LIMITES.bytes;
}

/** Abre o JSON: confere o tamanho em bytes, ignora a marca de ordem de bytes (BOM, que alguns editores e o caminho Android deixam) e exige um objeto. */
function abrirJson(textoJson: string): Record<string, unknown> {
  if (!cabeNoLimite(textoJson)) throw new ErroDeDocumento("grande_demais");
  const bruto = analisarJson(textoJson.charCodeAt(0) === 0xfeff ? textoJson.slice(1) : textoJson);
  return ehObjeto(bruto) ? bruto : invalido("documento", "objeto");
}

const jsonInvalido = (e: unknown): ErroDeDocumento => new ErroDeDocumento("json_invalido", { detalhe: mensagemDe(e) });

function analisarJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch (e) {
    throw jsonInvalido(e);
  }
}

/** Confere o campo `formato`: `prefixo` ("nicska-backup/") reconhece a família; `esperado` é a versão que este app entende. */
function conferirFormato(bruto: Record<string, unknown>, { prefixo, esperado }: { prefixo: string; esperado: string }): void {
  if (typeof bruto.formato !== "string" || !bruto.formato.startsWith(prefixo)) invalido("formato", prefixo);
  if (bruto.formato !== esperado) throw new ErroDeDocumento("versao", { versao: (bruto.formato as string).slice(prefixo.length), esperado: "1" });
}

const lerTentativas = (lista: unknown[], ctx: ContextoDeLeitura) => {
  const tentativas = lista.map((t, indice) => lerTentativa(t, { ...ctx, indice }));
  semRepetidos(tentativas, "tentativas");
  return tentativas;
};

/** As chaves de identificação do backup, na ordem do documento: o formato, o app que o gerou e quando. */
const identificacaoDoBackup = (bruto: Record<string, unknown>) => ({ formato: FORMATO_BACKUP as typeof FORMATO_BACKUP, app: textoCurto(bruto.app, 80), exportado_em: textoCurto(bruto.exportado_em, 40) });

/** Lê e valida o texto de um backup. Joga `ErroDeDocumento` com o motivo. */
export function lerBackup(textoJson: string): Backup {
  const bruto = abrirJson(textoJson);
  conferirFormato(bruto, { prefixo: "nicska-backup/", esperado: FORMATO_BACKUP });
  const listaDePercursos = listaAte(bruto.percursos, LIMITES.percursos, "percursos");
  const listaDeTentativas = listaAte(bruto.tentativas, LIMITES.tentativas, "tentativas");
  const percursos = listaDePercursos.map(lerPercurso);
  semRepetidos(percursos, "percursos");
  const tentativas = lerTentativas(listaDeTentativas, { percursos: idsDe(percursos) });
  const outros = lerOutrosAtiradores(bruto.atiradores);
  const comOutros = opcional(outros?.length, { atiradores: outros });
  return {
    ...identificacaoDoBackup(bruto),
    atirador: lerAtirador(bruto.atirador, "atirador"),
    ...comOutros,
    percursos,
    tentativas,
  };
}

export function paraImportavel(b: Backup): Importavel {
  return { origem: "backup", atirador: b.atirador, atiradores: b.atiradores ?? [], percursos: b.percursos, tentativas: b.tentativas };
}

const objetoOuVazio = (x: unknown): Record<string, unknown> => (ehObjeto(x) ? x : {});

export function lerCompartilhado(textoJson: string): Importavel {
  const bruto = abrirJson(textoJson);
  conferirFormato(bruto, { prefixo: "nicska/", esperado: FORMATO_COMPARTILHADO });
  const lista = listaAte(bruto.tentativas, LIMITES.tentativas, "tentativas");
  const atirador = lerAtirador({ ...objetoOuVazio(bruto.atirador), divisao: bruto.divisao }, "atirador");
  const percurso = lerPercurso(bruto.percurso, 0);
  const tentativas = lerTentativas(lista, { percursos: idsDe([percurso]), percursoImplicito: percurso.id }).map((t) => ({ ...t, atirador_id: atirador.id }));
  return { origem: "compartilhado", atirador, atiradores: [], percursos: [percurso], tentativas };
}

/** Abre um arquivo do Nicska, seja backup (`nicska-backup/1`) seja percurso compartilhado (`nicska/1`). */
export function lerDocumento(textoJson: string): Importavel {
  const bruto = abrirJson(textoJson);
  if (typeof bruto.formato === "string" && bruto.formato.startsWith("nicska-backup/")) return paraImportavel(lerBackup(textoJson));
  return lerCompartilhado(textoJson);
}
