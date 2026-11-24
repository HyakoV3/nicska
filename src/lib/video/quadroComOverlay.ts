// Um quadro do vídeo exportado (V3): a imagem do vídeo no tamanho dele e, por cima, o overlay do instante. O instante é o TEMPO DO VÍDEO do quadro (s desde o
// começo do vídeo), levado ao overlay pela mesma `estadoDoOverlay` do player, com os mesmos `dados` (zeroNoVideoS de alinhamento.ts): o arquivo mostra o que a
// Revisão mostra. Serve aos dois motores: o WebCodecs pinta num OffscreenCanvas (quando há) e o de tempo real num <canvas> (o `captureStream` é só dele).
import type { PrefsOverlay } from "../preferencias";
import { estadoDoOverlay, type DadosDoOverlay } from "./overlay";
import { FAMILIA, FAMILIA_DISPLAY, medidorDe, pintarOverlay, type Paleta, type Recursos } from "./overlayCanvas";
import { layoutDoOverlay, type TextosDoOverlay } from "./overlayLayout";

/** Tudo o que o desenho do overlay precisa, pronto antes do primeiro quadro (a foto do avatar já decodificada). */
export type DesenhoDoOverlay = { dados: DadosDoOverlay; prefs: PrefsOverlay; textos: TextosDoOverlay; paleta: Paleta; avatar: CanvasImageSource | null; logo?: CanvasImageSource | null; altoContraste: boolean };
type Contexto = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Tela = { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: Contexto; largura: number; altura: number };

/** Um canvas do tamanho do vídeo: OffscreenCanvas se `fora` e o aparelho tem; senão um <canvas> fora da página. Joga se não há contexto 2D. */
export function criarTela(largura: number, altura: number, fora: boolean): Tela {
  const canvas = fora && typeof OffscreenCanvas === "function" ? new OffscreenCanvas(largura, altura) : Object.assign(document.createElement("canvas"), { width: largura, height: altura });
  const ctx = canvas.getContext("2d", { alpha: false }) as Contexto | null;
  if (!ctx) throw new Error("exportar: sem contexto 2D");
  return { canvas, ctx, largura, altura };
}

/** O desenhista de quadros: pinta `fonte` (o <video> no quadro atual) e o overlay do instante `tempoS`. O medidor de texto é um só por exportação. */
export function criarDesenhista(tela: Tela, d: DesenhoDoOverlay): (fonte: CanvasImageSource, tempoS: number) => void {
  const recursos: Recursos = { paleta: d.paleta, avatar: d.avatar, logo: d.logo, familia: FAMILIA, familiaDisplay: FAMILIA_DISPLAY };
  const opcoes = { prefs: d.prefs, textos: d.textos, medir: medidorDe(tela.ctx, recursos), altoContraste: d.altoContraste };
  // Sem clarão e sem "ao vivo": o arquivo é uma reprodução, mas o clarão é só da tela (CONS-033), e quem pinta ignora o `clarao` do estado.
  const dados = { ...d.dados, aoVivo: false };
  return (fonte, tempoS) => {
    const { ctx, largura, altura } = tela;
    ctx.globalAlpha = 1;
    ctx.drawImage(fonte, 0, 0, largura, altura);
    pintarOverlay(ctx, layoutDoOverlay(largura, altura, estadoDoOverlay(tempoS, dados), dados, opcoes), recursos);
  };
}
