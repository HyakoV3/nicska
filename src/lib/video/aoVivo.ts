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

/** Os centésimos de segundo MOSTRADOS no cronômetro (o texto tem 2 casas): -1 no STAND BY. Dois tempos com o mesmo valor aqui desenham o mesmo cronômetro. */
export function centesimosDe(tempoS: number): number {
  return tempoS < 0 || !Number.isFinite(tempoS) ? -1 : Math.round(tempoS * 100);
}

/** Que fração do intervalo da taxa já basta (a tela chega a ~16,7 ms por quadro: pedir 33,3 ms cheios perderia o quadro seguinte por 1 ms de folga e cairia para 20 Hz). */
const FOLGA_DO_QUADRO = 0.85;

/**
 * O overlay ao vivo precisa redesenhar agora? Só se o valor MOSTRADO mudou (`novoCs` ≠ `ultimoMostradoCs`, em centésimos) E já passou o intervalo da taxa
 * (`taxaHz`) desde a última atualização (`ultimoTs`, `agoraTs`: ms do relógio de alta resolução). Nada de trabalho por quadro quando nada mudou.
 * `ultimoMostradoCs` NaN ou `ultimoTs` -Infinity (nada mostrado ainda) deixam passar. Taxa inválida vale sem limite de taxa (só a troca de valor).
 */
export function deveAtualizar(ultimoMostradoCs: number, novoCs: number, ultimoTs: number, agoraTs: number, taxaHz: number): boolean {
  if (novoCs === ultimoMostradoCs) return false;
  if (!(taxaHz > 0) || !Number.isFinite(taxaHz)) return true;
  return agoraTs - ultimoTs >= (1000 / taxaHz) * FOLGA_DO_QUADRO;
}
