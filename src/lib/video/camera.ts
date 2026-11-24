// Abrir a câmera pedindo uma qualidade, com recuo: o 4K (2160p) é opção avançada e nem todo aparelho o entrega. `ideal` no getUserMedia não falha por falta de 4K (a câmera
// entrega o que tem), então o recuo tem dois casos: (1) o pedido de 4K FALHA por limite do aparelho (não por permissão) e tenta de novo em 1080p30; (2) abriu, mas com
// menos que 4K: segue com o que veio e `entregue` diz a qualidade real (o bitrate segue ela). `recuou` é o que a tela avisa; nunca falha por causa disso.
import { motivoDaCamera } from "./fabricasDeVideo";
import { ladoMenorDoFluxo, qualidadeEntregue, restricoesDaCamera, type Camera, type Qualidade } from "./formato";

export type CameraAberta = { fluxo: MediaStream; pedida: Qualidade; entregue: Qualidade; recuou: boolean };

/** A qualidade para onde o 4K recua. */
export const QUALIDADE_DO_RECUO: Qualidade = { altura: 1080, fps: 30 };

/** Falha do aparelho (câmera ocupada, limite, restrição não atendida) recua; permissão negada ou sem câmera, não. */
const podeRecuar = (e: unknown): boolean => (motivoDaCamera(e) === "falhou" && (e as { name?: unknown } | null)?.name !== "TimeoutError") || (typeof e === "object" && e !== null && (e as { name?: unknown }).name === "OverconstrainedError");

export async function abrirCameraComRecuo(abrir: (r: MediaStreamConstraints) => Promise<MediaStream>, camera: Camera, pedida: Qualidade): Promise<CameraAberta> {
  let fluxo: MediaStream;
  let usada = pedida;
  try {
    fluxo = await abrir(restricoesDaCamera(camera, pedida));
  } catch (e) {
    // Só o 4K recua, e só por falha do aparelho: permissão negada ou câmera inexistente valem como estão.
    if (pedida.altura !== 2160 || !podeRecuar(e)) throw e;
    usada = QUALIDADE_DO_RECUO;
    fluxo = await abrir(restricoesDaCamera(camera, usada));
  }
  const entregue = qualidadeEntregue(usada, ladoMenorDoFluxo(fluxo));
  return { fluxo, pedida, entregue, recuou: entregue.altura < pedida.altura };
}
