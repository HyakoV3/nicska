// A Web Share API, fora do Android (quando o navegador compartilha arquivos).
import { tipoSemCodec, type Envio } from "./arquivo";

/** "ok": a folha abriu (ou o navegador compartilhou). "original": abriu, mas com o arquivo WebM como foi gravado (a conversão para Ogg não deu): apps como o WhatsApp podem recusá-lo. "cancelado": a pessoa fechou a folha do navegador sem enviar. "erro": não foi possível preparar o envio. */
export type Resultado = "ok" | "original" | "cancelado" | "erro";

const paraArquivo = (e: Envio): File => new File([e.blob], e.nome, { type: tipoSemCodec(e.blob.type) });
const navegadorAceita = (f: File): boolean => !!navigator.canShare?.({ files: [f] });

export const navegadorCompartilha = (): boolean => typeof navigator !== "undefined" && typeof navigator.canShare === "function" && typeof navigator.share === "function";

/** Web Share API. Se o navegador não aceita o Ogg convertido, tenta a `alternativa` (o original). Joga `AbortError` se a pessoa fechou a folha. */
export async function enviarPeloNavegador(envio: Envio, { alternativa, jaEraOriginal }: { alternativa: Envio | null; jaEraOriginal: boolean }): Promise<Resultado> {
  let escolhido = envio;
  let foiOriginal = jaEraOriginal;
  if (!navegadorAceita(paraArquivo(envio)) && alternativa) {
    escolhido = alternativa;
    foiOriginal = true;
  }
  const arquivo = paraArquivo(escolhido);
  if (!navegadorAceita(arquivo)) return "erro";
  await navigator.share({ files: [arquivo], title: envio.titulo });
  return foiOriginal ? "original" : "ok";
}
