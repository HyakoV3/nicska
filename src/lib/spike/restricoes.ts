// SPIKE S1 (EXPERIMENTAL, descartável): as restrições do `getUserMedia` do spike. Lógica pura.

/** Os três modos de gravação comparados: só áudio, áudio + vídeo 720p30 e áudio + vídeo 720p60. */
export type Modo = "audio" | "720p30" | "720p60";
export const MODOS: readonly Modo[] = ["audio", "720p30", "720p60"];
/** A taxa pedida em cada modo (nula: sem câmera). */
export const FPS_DO_MODO: Record<Modo, number | null> = { audio: null, "720p30": 30, "720p60": 60 };

export type Lado = "environment" | "user";
export type PedidoDeVideo = { lado: Lado; fps: number };

/** `video` do `getUserMedia`: 1280×720 ideal, `fps` ideal (pedir 60 não obriga o aparelho a entregar). */
export function restricoesDeVideo({ lado, fps }: PedidoDeVideo): MediaTrackConstraints {
  return { facingMode: lado, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: fps } };
}

/** O áudio cru do app (a mesma configuração de `fabricasDoNavegador.abrirMicrofone`), para o relatório mostrar o que se pediu. */
export const RESTRICOES_DE_AUDIO = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } as const;

/** A outra câmera. */
export const outroLado = (lado: Lado): Lado => (lado === "environment" ? "user" : "environment");

/** O aparelho entregou a taxa pedida? Tolera 10%: `frameRate` real costuma vir como 29,97 ou 59,94. */
export const entregouTaxa = (pedida: number, real: number | undefined): boolean => real !== undefined && real >= pedida * 0.9;
