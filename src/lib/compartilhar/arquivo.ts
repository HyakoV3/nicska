// O arquivo a enviar: tipo, nome e a conversão do áudio WebM/Opus em Ogg/Opus (o WhatsApp recusa .webm e trata .weba como documento: docs/roadmap-ideas.md, I-02).
import { webmParaOgg } from "../ogg";

/** O que se envia: o arquivo, o nome dele e o título da folha de compartilhamento. */
export type Envio = { blob: Blob; nome: string; titulo: string };

/** "audio/webm;codecs=opus" → "audio/webm". */
export function tipoSemCodec(tipo: string): string {
  return tipo.split(";")[0]!.trim().toLowerCase() || "audio/*";
}

/** É áudio WebM (o que se converte para Ogg)? */
export const ehWebm = (blob: Blob): boolean => tipoSemCodec(blob.type).includes("webm");

/** Nome do arquivo de áudio enviado: "nicska-AAAA-MM-DD-HHMM.ext", com a extensão do formato. O áudio em WebM sai como ".ogg" (convertido em `prepararOgg`); o ".webm" só vale quando a conversão falha. */
export function nomeDoArquivo(criadaEm: number, tipo: string): string {
  const d = new Date(criadaEm);
  const dois = (n: number) => String(n).padStart(2, "0");
  const t = tipoSemCodec(tipo);
  const ext = t.includes("webm") ? "webm" : t.includes("mp4") || t.includes("aac") ? "m4a" : t.includes("ogg") ? "ogg" : "audio";
  return `nicska-${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}-${dois(d.getHours())}${dois(d.getMinutes())}.${ext}`;
}

/** Áudio WebM/Opus vira Ogg/Opus (sem recodificar): é o que o WhatsApp, o Telegram e os outros aceitam como áudio. Se não der, devolve null (segue o original). */
export async function prepararOgg(envio: Envio): Promise<Envio | null> {
  const ogg = ehWebm(envio.blob) ? await converter(envio.blob) : null;
  return ogg && { ...envio, blob: ogg, nome: envio.nome.replace(/\.(webm|weba)$/i, "") + ".ogg" };
}

const comoOgg = (ogg: Uint8Array): Blob => new Blob([ogg as BlobPart], { type: "audio/ogg" });

async function converter(webm: Blob): Promise<Blob | null> {
  try {
    const ogg = webmParaOgg(new Uint8Array(await webm.arrayBuffer()));
    return ogg && comoOgg(ogg);
  } catch (e) {
    console.warn("compartilhar: não foi possível converter para Ogg, enviando o original", e);
    return null;
  }
}
