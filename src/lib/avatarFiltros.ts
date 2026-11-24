// Os filtros do avatar: operações de pixel PURAS sobre RGBA (`Uint8ClampedArray`, 4 bytes por pixel), sem DOM, para testar e para rodar no <canvas>. Cada uma altera
// o array e o devolve. Rodam sobre a imagem já recortada em 256 x 256 (ou nas miniaturas da fileira de filtros), então são baratas.

export type Rgb = readonly [number, number, number];
export type FiltroId = "original" | "pb" | "sepia" | "contraste" | "duotone" | "quadrinho" | "pixel";
export type Contexto = { largura: number; altura: number; tema: Rgb };

/** A luminância (0 a 255) de um pixel, pelos pesos do Rec. 601. */
export const luminancia = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;

/** Aplica `f` a cada pixel (r, g, b) e grava o trio devolvido; o alfa não muda. */
function porPixel(d: Uint8ClampedArray, f: (r: number, g: number, b: number) => Rgb): Uint8ClampedArray {
  for (let i = 0; i + 3 < d.length; i += 4) {
    const [r, g, b] = f(d[i], d[i + 1], d[i + 2]);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  return d;
}

export const pretoEBranco = (d: Uint8ClampedArray): Uint8ClampedArray =>
  porPixel(d, (r, g, b) => {
    const y = luminancia(r, g, b);
    return [y, y, y];
  });

export const sepia = (d: Uint8ClampedArray): Uint8ClampedArray =>
  porPixel(d, (r, g, b) => [0.393 * r + 0.769 * g + 0.189 * b, 0.349 * r + 0.686 * g + 0.168 * b, 0.272 * r + 0.534 * g + 0.131 * b]);

/** Estica o contraste em torno do cinza médio (128): `fator` 1 não muda nada; acima de 1 afasta os tons do meio. */
export const altoContraste = (d: Uint8ClampedArray, fator = 1.8): Uint8ClampedArray => porPixel(d, (r, g, b) => [(r - 128) * fator + 128, (g - 128) * fator + 128, (b - 128) * fator + 128]);

const misturar = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Duas cores: as sombras vão para `escuro` e as luzes para `claro`, com a luminância decidindo a mistura. */
export const duotone = (d: Uint8ClampedArray, cores: { escuro: Rgb; claro: Rgb }): Uint8ClampedArray =>
  porPixel(d, (r, g, b) => {
    const t = luminancia(r, g, b) / 255;
    return [misturar(cores.escuro[0], cores.claro[0], t), misturar(cores.escuro[1], cores.claro[1], t), misturar(cores.escuro[2], cores.claro[2], t)];
  });

/** O par do duotone a partir da cor do tema: sombras bem escuras da cor e luzes quase brancas dela. */
export function coresDoDuotone(tema: Rgb): { escuro: Rgb; claro: Rgb } {
  const [r, g, b] = tema;
  return { escuro: [r * 0.2, g * 0.2, b * 0.2], claro: [misturar(r, 255, 0.85), misturar(g, 255, 0.85), misturar(b, 255, 0.85)] };
}

/** "Quadrinho": reduz cada canal a `niveis` valores (2 a 256), o que dá faixas chapadas de cor. */
export function posterizar(d: Uint8ClampedArray, niveis = 4): Uint8ClampedArray {
  const n = Math.min(256, Math.max(2, Math.round(niveis)));
  const passo = 255 / (n - 1);
  const q = (v: number) => Math.round(Math.round(v / passo) * passo);
  return porPixel(d, (r, g, b) => [q(r), q(g), q(b)]);
}

/** A média (r, g, b, a) do bloco que começa em (x0, y0), cortado nas bordas da imagem. */
function mediaDoBloco(d: Uint8ClampedArray, bloco: { x0: number; y0: number; lado: number }, imagem: { largura: number; altura: number }): number[] {
  const soma = [0, 0, 0, 0];
  let n = 0;
  for (let y = bloco.y0; y < Math.min(bloco.y0 + bloco.lado, imagem.altura); y++) {
    for (let x = bloco.x0; x < Math.min(bloco.x0 + bloco.lado, imagem.largura); x++) {
      const i = (y * imagem.largura + x) * 4;
      for (let c = 0; c < 4; c++) soma[c] += d[i + c];
      n++;
    }
  }
  return soma.map((s) => s / n);
}

function pintarBloco(d: Uint8ClampedArray, bloco: { x0: number; y0: number; lado: number }, ctx: { imagem: { largura: number; altura: number }; cor: number[] }): void {
  for (let y = bloco.y0; y < Math.min(bloco.y0 + bloco.lado, ctx.imagem.altura); y++) {
    for (let x = bloco.x0; x < Math.min(bloco.x0 + bloco.lado, ctx.imagem.largura); x++) d.set(ctx.cor, (y * ctx.imagem.largura + x) * 4);
  }
}

/** "Pixel": a imagem vira uma grade de `celulas` x `celulas` blocos, cada um com a cor média da sua área. */
export function pixelar(d: Uint8ClampedArray, imagem: { largura: number; altura: number }, celulas = 16): Uint8ClampedArray {
  const lado = Math.max(1, Math.ceil(Math.max(imagem.largura, imagem.altura) / Math.max(1, celulas)));
  for (let y0 = 0; y0 < imagem.altura; y0 += lado) {
    for (let x0 = 0; x0 < imagem.largura; x0 += lado) {
      const bloco = { x0, y0, lado };
      pintarBloco(d, bloco, { imagem, cor: mediaDoBloco(d, bloco, imagem) });
    }
  }
  return d;
}

type Aplicar = (d: Uint8ClampedArray, c: Contexto) => Uint8ClampedArray;
const APLICAR: Record<FiltroId, Aplicar> = {
  original: (d) => d,
  pb: (d) => pretoEBranco(d),
  sepia: (d) => sepia(d),
  contraste: (d) => altoContraste(pretoEBranco(d), 2),
  duotone: (d, c) => duotone(d, coresDoDuotone(c.tema)),
  quadrinho: (d) => posterizar(d, 4),
  pixel: (d, c) => pixelar(d, c, 16),
};

/** Os filtros na ordem da fileira de miniaturas. */
export const FILTROS: readonly FiltroId[] = ["original", "pb", "sepia", "contraste", "duotone", "quadrinho", "pixel"];

/** Aplica o filtro `id` aos pixels `d` (largura x altura) e devolve o mesmo array. */
export const aplicarFiltro = (id: FiltroId, d: Uint8ClampedArray, c: Contexto): Uint8ClampedArray => APLICAR[id](d, c);
