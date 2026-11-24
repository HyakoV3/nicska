// Enviar o vídeo da tentativa (V2b): o vídeo CRU, como foi gravado (com os tempos sobre a imagem é a V3, video/exportacao.ts), montado dos pedaços com a
// duração corrigida pelo mesmo caminho da reprodução (webm/duracao.ts, C6), e entregue à folha de compartilhamento com MIME e extensão de VÍDEO. Nunca passa
// por `prepararOgg` (que remuxa para Ogg e perderia a imagem, achado 1 da revisão). A escolha dos botões (só áudio, ou a pílula vídeo + áudio) também é daqui.
import type { ArmazenamentoDeVideos } from "../armazenamento/videos";
import { comDuracao } from "../webm/duracao";
import { tipoSemCodec, type Envio } from "./arquivo";
import { enviarPeloNavegador, type Resultado } from "./navegador";
import { enviarPelaPonte, ponte } from "./ponte";

/** O que a tentativa pode enviar: o áudio, o vídeo, os dois (a pílula) ou nada. */
export type EnviosDaTentativa = { audio: boolean; video: boolean };
export type FormaDoEnvio = "nenhum" | "audio" | "video" | "pilula";

/** Só áudio: um botão; com vídeo e áudio: a pílula de duas partes (vídeo, o principal, e áudio). Sem compartilhamento no aparelho, nada. */
export function formaDoEnvio(e: EnviosDaTentativa, podeCompartilhar: boolean): FormaDoEnvio {
  if (!podeCompartilhar) return "nenhum";
  if (e.video && e.audio) return "pilula";
  if (e.video) return "video";
  return e.audio ? "audio" : "nenhum";
}

/** O tipo do vídeo sem codec ("video/webm;codecs=vp9,opus" → "video/webm"); um tipo vazio ou que não é de vídeo vale WebM (o que o MediaRecorder grava). */
export function tipoDoVideo(tipo: string): string {
  const t = tipoSemCodec(tipo);
  return t.startsWith("video/") ? t : "video/webm";
}

/** A extensão do arquivo pelo tipo: MP4 só se o aparelho gravou MP4; o resto é WebM. */
export const extensaoDoVideo = (tipo: string): string => (tipoDoVideo(tipo) === "video/mp4" ? "mp4" : "webm");

/** O percurso no nome do arquivo: sem acento, minúsculo, só letras, números e hífens, curto ("El Presidente!" → "el-presidente"). */
export function trechoDoPercurso(nome: string | undefined): string {
  const limpo = (nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return limpo.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
}

/** "nicska-<percurso>-AAAA-MM-DD-HHMM.webm" (sem percurso: "nicska-AAAA-MM-DD-HHMM.webm"), na hora do aparelho. */
export function nomeDoVideo(criadaEm: number, tipo: string, percurso?: string): string {
  const d = new Date(criadaEm);
  const dois = (n: number) => String(n).padStart(2, "0");
  const quando = `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}-${dois(d.getHours())}${dois(d.getMinutes())}`;
  const trecho = trechoDoPercurso(percurso);
  return `nicska-${trecho ? `${trecho}-` : ""}${quando}.${extensaoDoVideo(tipo)}`;
}

/** O vídeo guardado da tentativa `id`, montado e com a duração no cabeçalho (o mesmo preparo da reprodução); nulo se não há vídeo. */
export async function videoParaEnviar(loja: Pick<ArmazenamentoDeVideos, "video">, id: string, preparar: (b: Blob) => Promise<Blob> = comDuracao): Promise<Blob | null> {
  const blob = await loja.video(id);
  return blob ? preparar(blob) : null;
}

/** Entrega o vídeo como é: pela ponte do Android (com o tipo de vídeo, sem conversão) ou pela Web Share API. Joga `AbortError` se a pessoa fechou a folha. */
export async function enviarVideoAgora({ blob, nome, titulo }: Envio): Promise<Resultado> {
  const video = new Blob([blob], { type: tipoDoVideo(blob.type) });
  const envio = { blob: video, nome, titulo };
  const p = ponte();
  if (p) return (await enviarPelaPonte(p, envio)) ? "ok" : "erro";
  return enviarPeloNavegador(envio, { alternativa: null, jaEraOriginal: false });
}
