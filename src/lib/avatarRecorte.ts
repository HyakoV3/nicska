// A geometria do recorte do avatar, pura: dado o tamanho da imagem, o zoom e o deslocamento, qual quadrado da imagem original vai para o <canvas> quadrado.

export type Recorte = { largura: number; altura: number; zoom: number; deslocX: number; deslocY: number };
export type Retangulo = { x: number; y: number; lado: number };

export const ZOOM_MAXIMO = 4;

const entre = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** O zoom dentro de 1 (o quadrado maior que cabe na imagem) e `ZOOM_MAXIMO`; valor inválido vira 1. */
export const limitarZoom = (z: number): number => (Number.isFinite(z) ? entre(z, 1, ZOOM_MAXIMO) : 1);

/** O lado do quadrado de origem, em pixels da imagem: o lado menor dividido pelo zoom. */
export const ladoDeOrigem = (largura: number, altura: number, zoom: number): number => Math.min(largura, altura) / limitarZoom(zoom);

/**
 * O quadrado de origem. `deslocX` e `deslocY` são pixels da IMAGEM, a partir do centro (positivo = o quadrado vai para a direita/baixo). O resultado nunca sai
 * da imagem: o deslocamento é limitado à folga que sobra de cada lado.
 */
export function retanguloDeOrigem(r: Recorte): Retangulo {
  const lado = ladoDeOrigem(r.largura, r.altura, r.zoom);
  const x = entre((r.largura - lado) / 2 + (r.deslocX || 0), 0, r.largura - lado);
  const y = entre((r.altura - lado) / 2 + (r.deslocY || 0), 0, r.altura - lado);
  return { x, y, lado };
}

/** Quantos pixels da imagem vale cada pixel de tela da janela de recorte de `janelaPx` de lado (para arrastar: o dedo anda `d` na tela, o recorte anda `d * isto`). */
export const pixelsDaImagemPorPixelDeTela = (r: Recorte, janelaPx: number): number => (janelaPx > 0 ? ladoDeOrigem(r.largura, r.altura, r.zoom) / janelaPx : 0);

/** Soma `dx`, `dy` (em pixels de tela) ao deslocamento, no sentido do arrasto (arrastar para a direita mostra o que está à esquerda), já limitado pela imagem. */
export function arrastar(r: Recorte, mov: { dx: number; dy: number; janelaPx: number }): Recorte {
  const k = pixelsDaImagemPorPixelDeTela(r, mov.janelaPx);
  const alvo = { ...r, deslocX: r.deslocX - mov.dx * k, deslocY: r.deslocY - mov.dy * k };
  const ret = retanguloDeOrigem(alvo);
  return { ...alvo, deslocX: ret.x + ret.lado / 2 - r.largura / 2, deslocY: ret.y + ret.lado / 2 - r.altura / 2 };
}
