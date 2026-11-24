// Erros de documento (`ErroDeDocumento`, documento/tipos.ts; a validação é toda em TypeScript, não existe validação em Rust) viram um JSON `["codigo", "argumento", ...]`
// (ver `mensagemDeErro` em dados.ts): um código estável e os dados, sem frase pronta, para a interface traduzir no idioma da pessoa. É JSON, e não texto separado por
// delimitador, porque os argumentos podem vir de dados importados (nomes de voz) e conter qualquer caractere. Texto que não for um desses JSON, ou cujo código não
// seja conhecido, é devolvido como está. (Os nomes `ERROS_DO_RUST` e `erro.rust.*` são históricos.)
import type { Chave } from "./i18n/pt";

type Tradutor = (c: Chave, p?: Record<string, string | number>) => string;

/** Código -> nomes dos argumentos, na ordem em que o Rust os envia (são os `{nomes}` do texto `erro.rust.<codigo>`). */
export const ERROS_DO_RUST: Readonly<Record<string, readonly string[]>> = {
  json_invalido: ["detalhe"],
  versao: ["versao", "esperado"],
  grande_demais: [],
  dados_invalidos: ["detalhe"],
};

/** `["codigo", "arg", ...]` decodificado, ou null se o texto não tiver esse formato. */
function decodificar(texto: string): string[] | null {
  if (!texto.startsWith("[")) return null;
  try {
    const v: unknown = JSON.parse(texto);
    return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string") ? v : null;
  } catch {
    return null;
  }
}

export function traduzirErro(texto: string, t: Tradutor): string {
  const partes = decodificar(texto);
  if (!partes || !Object.hasOwn(ERROS_DO_RUST, partes[0])) return texto;
  const [codigo, ...args] = partes;
  const params: Record<string, string> = {};
  ERROS_DO_RUST[codigo].forEach((nome, k) => {
    params[nome] = args[k] ?? "";
  });
  return t(`erro.rust.${codigo}` as Chave, params);
}
