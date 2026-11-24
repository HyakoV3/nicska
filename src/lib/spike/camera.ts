// SPIKE S1, passo 2 (EXPERIMENTAL, descartável): abrir a câmera e medir o tempo até o 1º quadro, os `getSettings()`/`getCapabilities()` e a taxa real.
import { resumirFps, type ResumoFps } from "./estatisticas";
import { restricoesDeVideo, type PedidoDeVideo } from "./restricoes";
import { simples } from "./util";

type ComQuadros = HTMLVideoElement & { requestVideoFrameCallback?: (f: (agora: number) => void) => number };

/** Liga o fluxo ao `<video>` mudo da pré-visualização. */
export function ligarPrevia(video: HTMLVideoElement, fluxo: MediaStream): void {
  video.muted = true;
  video.playsInline = true;
  video.srcObject = fluxo;
  void video.play().catch(() => {});
}

export type PrimeiroQuadro = { metadadosMs: number | null; primeiroQuadroMs: number; via: "requestVideoFrameCallback" | "playing" | "limite" };

/** Espera o 1º quadro do `<video>`; os tempos são contados a partir de `t0` (`performance.now()`). Desiste em 10 s. */
export function aguardarPrimeiroQuadro(video: HTMLVideoElement, t0: number): Promise<PrimeiroQuadro> {
  return new Promise((ok) => {
    let metadadosMs: number | null = null;
    const fim = (via: PrimeiroQuadro["via"]) => {
      clearTimeout(limite);
      ok({ metadadosMs, primeiroQuadroMs: Math.round(performance.now() - t0), via });
    };
    const limite = setTimeout(() => fim("limite"), 10_000);
    video.addEventListener("loadedmetadata", () => (metadadosMs = Math.round(performance.now() - t0)), { once: true });
    video.addEventListener("playing", () => fim("playing"), { once: true });
    (video as ComQuadros).requestVideoFrameCallback?.(() => fim("requestVideoFrameCallback"));
  });
}

/** Conta os quadros apresentados em `ms` milissegundos de pré-visualização e resume o fps. */
export function contarQuadros(video: HTMLVideoElement, ms: number): Promise<ResumoFps | null> {
  const v = video as ComQuadros;
  if (!v.requestVideoFrameCallback) return Promise.resolve(null);
  return new Promise((ok) => {
    const instantes: number[] = [];
    const fim = Date.now() + ms;
    const passo = (agora: number) => {
      instantes.push(agora);
      if (Date.now() < fim) v.requestVideoFrameCallback!(passo);
      else ok(resumirFps(instantes));
    };
    v.requestVideoFrameCallback(passo);
    setTimeout(() => ok(resumirFps(instantes)), ms + 1500); // câmera parada: entrega o que houver
  });
}

/** Os dispositivos de entrada de vídeo e áudio (tipo e nome; sem identificadores). */
export async function listarDispositivos(): Promise<Array<{ kind: string; label: string }>> {
  const lista = await navigator.mediaDevices.enumerateDevices();
  return lista.map((d) => ({ kind: d.kind, label: d.label }));
}

/** `getSettings()` e `getCapabilities()` da trilha de vídeo, como dados simples. */
export function descreverTrilhaDeVideo(fluxo: MediaStream): { settings: MediaTrackSettings; capabilities: unknown } {
  const t = fluxo.getVideoTracks()[0];
  return { settings: simples(t?.getSettings() ?? {}), capabilities: simples(t?.getCapabilities?.() ?? null) };
}

/** Abre a câmera com as restrições do spike. */
export const abrirCamera = (pedido: PedidoDeVideo): Promise<MediaStream> => navigator.mediaDevices.getUserMedia({ video: restricoesDeVideo(pedido) });

export const pararFluxo = (fluxo: MediaStream | null): void => fluxo?.getTracks().forEach((t) => t.stop());
