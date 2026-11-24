// SPIKE S1, passo 2 (EXPERIMENTAL, descartável): uma medição completa da câmera (abrir, 1º quadro, taxa contada, dispositivos). O fluxo fica aberto para a pré-visualização.
import { abrirCamera, aguardarPrimeiroQuadro, contarQuadros, descreverTrilhaDeVideo, listarDispositivos, ligarPrevia } from "./camera";
import { entregouTaxa, type PedidoDeVideo } from "./restricoes";
import type { Entrada } from "./relatorio";

/** Abre a câmera no `pedido`, mostra na `previa` e mede. Joga o erro do `getUserMedia` (permissão negada etc.). */
export async function medirCamera(pedido: PedidoDeVideo, previa: HTMLVideoElement): Promise<{ fluxo: MediaStream; entrada: Entrada }> {
  const t0 = performance.now();
  const fluxo = await abrirCamera(pedido);
  const abrirMs = Math.round(performance.now() - t0);
  ligarPrevia(previa, fluxo);
  const quadro = await aguardarPrimeiroQuadro(previa, t0);
  const { settings, capabilities } = descreverTrilhaDeVideo(fluxo);
  const fps = await contarQuadros(previa, 2000);
  const entrada: Entrada = {
    passo: "camera",
    pedido,
    abrirMs,
    ...quadro,
    settings,
    capabilities,
    fpsContadoEm2s: fps,
    entregouTaxaPedida: entregouTaxa(pedido.fps, settings.frameRate),
    dispositivos: await listarDispositivos().catch(() => []),
  };
  return { fluxo, entrada };
}
