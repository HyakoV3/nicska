// As partes do avatar que precisam do navegador (<canvas>, decodificação e codificação da imagem). A conta fica em `avatarRecorte.ts` e `avatarFiltros.ts`.
import { LADO_DO_AVATAR, paraRgb } from "./avatar";
import { aplicarFiltro, type FiltroId, type Rgb } from "./avatarFiltros";
import { retanguloDeOrigem, type Recorte } from "./avatarRecorte";

/** Decodifica a imagem respeitando a orientação do EXIF (foto de câmera em pé); se o WebView não entende a opção, decodifica do jeito simples. */
export async function decodificar(arquivo: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(arquivo);
  }
}

/** A cor de ação do tema atual (`--acento`), para o duotone. */
export function corDoTema(): Rgb {
  return paraRgb(getComputedStyle(document.documentElement).getPropertyValue("--acento"));
}

export type Pedido = { bitmap: ImageBitmap; recorte: Omit<Recorte, "largura" | "altura">; filtro: FiltroId; lado?: number };

/** Desenha o recorte (quadrado de origem -> `lado` x `lado`) e aplica o filtro, num <canvas> novo. */
export function renderizar({ bitmap, recorte, filtro, lado = LADO_DO_AVATAR }: Pedido): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = lado;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const o = retanguloDeOrigem({ ...recorte, largura: bitmap.width, altura: bitmap.height });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, o.x, o.y, o.lado, o.lado, 0, 0, lado, lado);
  if (filtro === "original") return canvas;
  const dados = ctx.getImageData(0, 0, lado, lado);
  aplicarFiltro(filtro, dados.data, { largura: lado, altura: lado, tema: corDoTema() });
  ctx.putImageData(dados, 0, 0);
  return canvas;
}

const paraBlob = (c: HTMLCanvasElement, tipo: string, qualidade?: number): Promise<Blob | null> => new Promise((ok) => c.toBlob(ok, tipo, qualidade));

/** O arquivo do avatar: WebP a 0,8; se o WebView não gera WebP (devolve outro tipo ou nada), recua para JPEG e, por fim, PNG. */
export async function codificar(c: HTMLCanvasElement): Promise<Blob> {
  for (const [tipo, q] of [["image/webp", 0.8], ["image/jpeg", 0.85]] as const) {
    const b = await paraBlob(c, tipo, q);
    if (b && b.type === tipo) return b;
  }
  const png = await paraBlob(c, "image/png");
  if (!png) throw new Error("não foi possível gerar a imagem");
  return png;
}
