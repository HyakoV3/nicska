// Utilitários de áudio usados por mais de um módulo do app (escuta, Timer).

/** Formatos que se tenta, do preferido ao último recurso: Opus é compacto e o que o responsável pediu; MP4 e WebM são o que o navegador sabe gravar. */
export const FORMATOS_PREFERIDOS = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/mp4", "audio/webm"] as const;

/** O primeiro formato preferido que o navegador grava; nulo se nenhum (o `MediaRecorder` então escolhe o seu). `aceita` é o `MediaRecorder.isTypeSupported`. */
export function escolherFormato(aceita: (tipo: string) => boolean): string | null {
  for (const tipo of FORMATOS_PREFERIDOS) if (aceita(tipo)) return tipo;
  return null;
}

/** Por que a gravação não começou: a pessoa negou a permissão, não há microfone, ou o aparelho/navegador não grava. */
export type MotivoDoErro = "negada" | "sem_microfone" | "indisponivel" | "falhou";

/** Traduz o erro do navegador no motivo que a tela explica. */
export function motivoDoErro(e: unknown): MotivoDoErro {
  const nome = e instanceof Error || (typeof e === "object" && e !== null && "name" in e) ? String((e as { name: unknown }).name) : "";
  if (nome === "NotAllowedError" || nome === "SecurityError" || nome === "PermissionDeniedError") return "negada";
  if (nome === "NotFoundError" || nome === "DevicesNotFoundError" || nome === "OverconstrainedError") return "sem_microfone";
  if (nome === "NotSupportedError" || nome === "TypeError") return "indisponivel";
  return "falhou";
}

/** 64 kbps: bom para voz e instrumento e compacto (o padrão do navegador gravava a cerca de 135 kbps, o dobro, sem ganho que se ouça). */
export const BITS_POR_SEGUNDO = 64000;

/** Um rastro leve do que o gravador faz (console.debug): quando algo trava só no CI, é isto que mostra em que passo. */
export const rastro = (mensagem: string) => console.debug(`gravador: ${mensagem}`);

