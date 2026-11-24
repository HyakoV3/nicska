// SPIKE S2, passo 5 (EXPERIMENTAL, descartável): compartilhar um vídeo de teste (ou o relatório) SEM passar por `prepararOgg`.
// O caminho do app (`compartilharArquivo`) remuxa tudo para Ogg e perderia o vídeo (revisão, achado 1). Aqui a ponte nativa recebe o arquivo como é, com o MIME e a extensão certos.
import { enviarPelaPonte, ponte } from "../compartilhar/ponte";
import { extensaoDoMime, tipoSemCodec } from "./mime";

export type ResultadoDoEnvio = { caminho: "ponte" | "navegador" | "indisponivel"; resultado: "ok" | "cancelado" | "erro" | "indisponivel"; mime: string; nome: string; bytes: number; detalhe?: string };

/** O nome com a extensão que combina com o tipo (se o nome já termina nela, mantém). */
export function nomeComExtensao(nome: string, tipo: string): string {
  const ext = extensaoDoMime(tipo);
  return nome.toLowerCase().endsWith(`.${ext}`) ? nome : `${nome.replace(/\.[a-z0-9]+$/i, "")}.${ext}`;
}

async function pelaPonte(p: NonNullable<ReturnType<typeof ponte>>, blob: Blob, nome: string, titulo: string): Promise<"ok" | "erro"> {
  return (await enviarPelaPonte(p, { blob, nome, titulo })) ? "ok" : "erro";
}

async function pelaWebShare(blob: Blob, nome: string, titulo: string): Promise<"ok" | "cancelado" | "erro" | "indisponivel"> {
  const arquivo = new File([blob], nome, { type: tipoSemCodec(blob.type) });
  if (!navigator.canShare?.({ files: [arquivo] })) return "indisponivel";
  try {
    await navigator.share({ files: [arquivo], title: titulo });
    return "ok";
  } catch (e) {
    return (e as Error).name === "AbortError" ? "cancelado" : "erro";
  }
}

/** Entrega o vídeo à folha de compartilhamento: pela ponte do Android (MIME e extensão do próprio vídeo, sem conversão) ou, fora dele, por `navigator.share({files})`. */
export async function compartilharVideoDeTeste(blob: Blob, nome: string, titulo = "Nicska spike"): Promise<ResultadoDoEnvio> {
  const mime = tipoSemCodec(blob.type) || "application/octet-stream";
  const final = nomeComExtensao(nome, mime);
  const base = { mime, nome: final, bytes: blob.size };
  const p = ponte();
  try {
    if (p) return { ...base, caminho: "ponte", resultado: await pelaPonte(p, blob, final, titulo) };
    const r = await pelaWebShare(blob, final, titulo);
    return { ...base, caminho: r === "indisponivel" ? "indisponivel" : "navegador", resultado: r };
  } catch (e) {
    return { ...base, caminho: p ? "ponte" : "navegador", resultado: "erro", detalhe: `${(e as Error).name}: ${(e as Error).message}` };
  }
}
