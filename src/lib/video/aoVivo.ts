// O overlay AO VIVO da tela cheia do modo vídeo (V2b): o mesmo OverlayDoVideo da reprodução (estadoDoOverlay), alimentado pelo Timer em vez do <video>.
// É só para ver na hora: o vídeo continua gravado cru e o overlay da Revisão é redesenhado com os disparos revisados. Aqui o "vídeo" começa no apito
// (`zeroNoVideoS` 0) e o tempo é o relógio do áudio da escuta, o mesmo dos disparos: o cronômetro e os splits batem com o que o Timer mede.
import type { PrefsOverlay } from "../preferencias";
import type { EstadoDoTimer, Instantaneo } from "../timerTipos";
import type { DadosDoOverlay } from "./overlay";

/** O que vai no overlay além dos disparos (avatar, nome e cabeçalho). */
export type ExtrasDoOverlay = Pick<DadosDoOverlay, "atirador" | "percurso" | "divisao" | "data">;

/**
 * O tempo do overlay ao vivo (s desde o apito). Antes da escuta, ou sem relógio ou sem zero, vale -1: o overlay mostra STAND BY. Nunca negativo depois do
 * zero (o relógio do áudio pode estar uma fração atrás do evento que acabou de chegar).
 */
export function tempoAoVivoS(estado: EstadoDoTimer, zeroS: number | null | undefined, agoraS: number | null): number {
  if (estado !== "escutando" || zeroS == null || agoraS === null || !Number.isFinite(agoraS - zeroS)) return -1;
  return Math.max(0, agoraS - zeroS);
}

/** Os dados do overlay ao vivo: os disparos de agora, o zero no começo e a marca de ao vivo (sem fim, sem clarão). */
export function dadosAoVivo(snap: Pick<Instantaneo, "disparosMs">, extras: ExtrasDoOverlay): DadosDoOverlay {
  return { zeroNoVideoS: 0, disparosMs: snap.disparosMs, aoVivo: true, ...extras };
}

/** As partes do overlay ao vivo: as de Ajustes; com o overlay desligado lá, só o essencial (STAND BY e cronômetro), sem foto, nome nem cabeçalho. */
export function opcoesAoVivo(p: PrefsOverlay): PrefsOverlay {
  return p.ligado ? p : { ligado: true, avatar: false, nome: false, cabecalho: false, splits: false, marca: false };
}
