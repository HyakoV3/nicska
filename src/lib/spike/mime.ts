// SPIKE S1 (EXPERIMENTAL, descartável): a lista fixa de formatos que se testa e a escolha do formato do gravador de vídeo. Lógica pura.

/** Os formatos que o relatório testa com `MediaRecorder.isTypeSupported`, sempre os mesmos, para comparar aparelhos. */
export const MIMES_TESTADOS = [
  "video/webm",
  "video/webm;codecs=vp8",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=h264",
  "video/webm;codecs=h264,opus",
  "video/webm;codecs=avc1.42E01E",
  "video/mp4",
  "video/mp4;codecs=avc1",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4;codecs=avc1,opus",
  "audio/webm;codecs=opus",
  "audio/mp4",
] as const;

/** Preferência do gravador de vídeo: MP4 com avc1 + AAC se houver; senão WebM com VP9 ou VP8 e Opus; no fim, o que o aparelho aceitar. */
export const MIMES_VIDEO_PREFERIDOS = [
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4;codecs=avc1,opus",
  "video/mp4;codecs=avc1",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=h264,opus",
  "video/webm",
] as const;

/** A primeira entrada da preferência que o aparelho grava; nulo se nenhuma. `aceita` é o `MediaRecorder.isTypeSupported`. */
export function escolherMimeVideo(aceita: (tipo: string) => boolean): string | null {
  for (const tipo of MIMES_VIDEO_PREFERIDOS) if (aceita(tipo)) return tipo;
  return null;
}

/** O resultado de `isTypeSupported` para cada formato da lista fixa. */
export function tabelaDeSuporte(aceita: (tipo: string) => boolean): Record<string, boolean> {
  return Object.fromEntries(MIMES_TESTADOS.map((t) => [t, aceita(t)]));
}

/** "video/mp4;codecs=avc1" → "video/mp4". */
export const tipoSemCodec = (tipo: string): string => tipo.split(";")[0]!.trim().toLowerCase();

/** A extensão do arquivo para o tipo (vídeo, JSON); "bin" se não se sabe. */
export function extensaoDoMime(tipo: string): "mp4" | "webm" | "json" | "bin" {
  const t = tipoSemCodec(tipo);
  if (t.includes("mp4")) return "mp4";
  if (t.includes("webm")) return "webm";
  return t === "application/json" ? "json" : "bin";
}
