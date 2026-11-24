// A parte da revisão que precisa do navegador: decodificar o áudio guardado da tentativa e tocar um trecho dele. A conta em si está em `revisao.ts`.
import { TAXA_DA_REVISAO } from "./revisao";

/** Decodifica o áudio (Opus em WebM ou outro formato do aparelho) para amostras mono na taxa da revisão. */
export async function decodificar(blob: Blob): Promise<{ amostras: Float32Array; taxa: number }> {
  const bytes = await blob.arrayBuffer();
  // O OfflineAudioContext decodifica já na taxa pedida; não toca nada nem pede gesto.
  const ctx = new OfflineAudioContext(1, 1, TAXA_DA_REVISAO);
  const buf = await ctx.decodeAudioData(bytes);
  const canal = buf.getChannelData(0);
  return { amostras: canal, taxa: buf.sampleRate };
}

type Trecho = { iniS: number; fimS: number };

/** Copia o trecho das amostras para um buffer do contexto; null se o trecho é vazio. */
function recortar(ctx: BaseAudioContext, amostras: Float32Array, taxa: number, { iniS, fimS }: Trecho): AudioBuffer | null {
  const ini = Math.max(0, Math.round(iniS * taxa));
  const fim = Math.min(amostras.length, Math.round(fimS * taxa));
  if (fim <= ini) return null;
  const buf = ctx.createBuffer(1, fim - ini, taxa);
  buf.copyToChannel(new Float32Array(amostras.subarray(ini, fim)), 0);
  return buf;
}

function parar(fonte: AudioBufferSourceNode): void {
  try {
    fonte.stop();
  } catch {
    /* já parou */
  }
}

/** Toca `[iniS, fimS)` das amostras num contexto próprio, criado no toque. Devolve a função que para o som. */
export function tocarTrecho({ amostras, taxa }: { amostras: Float32Array; taxa: number }, trecho: Trecho): () => void {
  const ctx = new AudioContext();
  const buf = recortar(ctx, amostras, taxa, trecho);
  if (!buf) {
    void ctx.close().catch(() => {});
    return () => {};
  }
  const fonte = ctx.createBufferSource();
  fonte.buffer = buf;
  fonte.connect(ctx.destination);
  fonte.onended = () => void ctx.close().catch(() => {});
  void ctx.resume().then(() => fonte.start());
  return () => parar(fonte);
}
