// A ligação do medidor de desempenho (desempenho.ts) com o navegador: requestAnimationFrame, PerformanceObserver("longtask"), o <video> da prévia e a câmera.
// Fino de propósito: a conta está no módulo puro.
import { ambienteDoAparelho, type AmbienteDoAparelho, type ConfigDaCamera, type DepsDoMedidor } from "./desempenho";

/** As dependências reais. `video` e `fluxo` dizem onde olhar (a prévia e a câmera); podem devolver nulo. */
export function depsDoNavegador(onde: { video: () => HTMLVideoElement | null; fluxo: () => MediaStream | null }): DepsDoMedidor {
  return {
    pedirQuadro: (cb) => requestAnimationFrame(cb),
    cancelarQuadro: (id) => cancelAnimationFrame(id),
    agora: () => performance.now(),
    agoraIso: () => new Date().toISOString(),
    observarTarefasLongas: (cb) => {
      try {
        if (typeof PerformanceObserver === "undefined" || !PerformanceObserver.supportedEntryTypes?.includes("longtask")) return null;
        const o = new PerformanceObserver((lista) => lista.getEntries().forEach((e) => cb(e.duration)));
        o.observe({ type: "longtask" });
        return () => o.disconnect();
      } catch {
        return null;
      }
    },
    qualidadeDoVideo: () => {
      const q = onde.video()?.getVideoPlaybackQuality?.();
      return q ? { descartados: q.droppedVideoFrames, total: q.totalVideoFrames } : null;
    },
    cameraReal: (): ConfigDaCamera | null => {
      const s = onde.fluxo()?.getVideoTracks()[0]?.getSettings?.();
      return s ? { largura: s.width ?? null, altura: s.height ?? null, fps: s.frameRate ?? null } : null;
    },
  };
}

/** O aparelho agora, dos globais da janela. */
export const ambienteDoNavegador = (): AmbienteDoAparelho => ambienteDoAparelho({ navigator: navigator as unknown as Record<string, unknown>, devicePixelRatio: window.devicePixelRatio, screen: window.screen });
