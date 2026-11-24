// O desenhista fino do overlay exportado (V3): pinta as peças do layout (overlayLayout.ts) num contexto 2D de canvas (o da página ou um OffscreenCanvas).
// Não decide nada de posição: só cor, fonte e forma. As cores são os tokens do tema ATUAL, lidos uma vez por exportação (`paletaDoTema`), com recuo para
// valores fixos legíveis (os do tema escuro) se o CSS não responder. O avatar é a foto do atirador (já decodificada) ou as iniciais no círculo de cor.
import type { AvatarDesenhado, CaixaDesenhada, Cor, Fonte, LogoDesenhado, Medir, Primitiva, TextoDesenhado } from "./overlayPrimitivas";

export type Paleta = Record<Cor, string>;
type Contexto = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/** O que a pintura usa além das peças: as cores, a foto do avatar (ou nada) e as famílias de fonte (a da interface e a dos números). */
export type Recursos = { paleta: Paleta; avatar: CanvasImageSource | null; logo?: CanvasImageSource | null; familia: string; familiaDisplay: string };

/** O tema escuro do estilo normal (tema.css): contraste alto sobre qualquer imagem. */
export const PALETA_DE_RECUO: Paleta = {
  fundo: "#14181f",
  texto: "#f2f2f2",
  suave: "#bac6d5",
  acento: "#ff746d",
  "tempo-ativo": "#ff746d",
  "tempo-fundo": "#f85149",
  "tempo-sobre": "#14181f",
  "borda-controle": "#93a1b0",
  "grafico-a": "#ff746d",
  "grafico-b": "#7bbcff",
  "grafico-c": "#75db98",
  "grafico-d": "#b99bf9",
};
export const FAMILIA = "system-ui, sans-serif";
export const FAMILIA_DISPLAY = '"Sora", system-ui, sans-serif';

/** As cores do tema atual pelos custom properties (`ler` devolve o valor de "--nome", ou vazio); o que vier vazio fica com o recuo. */
export function paletaDoTema(ler: (nome: string) => string): Paleta {
  const paleta = { ...PALETA_DE_RECUO };
  for (const cor of Object.keys(paleta) as Cor[]) {
    const v = ler(`--${cor}`).trim();
    if (v) paleta[cor] = v;
  }
  return paleta;
}

/** A fonte CSS de uma peça ("700 42.5px system-ui, sans-serif"). */
export const fonteCss = (f: Fonte, r: Pick<Recursos, "familia" | "familiaDisplay">): string => `${f.peso} ${f.px.toFixed(1)}px ${f.display ? r.familiaDisplay : r.familia}`;

/** Um medidor de texto pelo `measureText` do contexto, com cache (o layout mede os mesmos textos a cada quadro). */
export function medidorDe(ctx: Contexto, r: Pick<Recursos, "familia" | "familiaDisplay">): Medir {
  const cache = new Map<string, number>();
  return (texto, fonte) => {
    const css = fonteCss(fonte, r);
    const chave = `${css}|${texto}`;
    let w = cache.get(chave);
    if (w === undefined) {
      ctx.font = css;
      w = ctx.measureText(texto).width;
      if (cache.size > 2000) cache.clear(); // o cronômetro muda a cada quadro: sem limite o cache só cresceria
      cache.set(chave, w);
    }
    return w;
  };
}

/** Um retângulo de cantos redondos; `roundRect` quando o aparelho tem, senão quatro arcos. */
function caminhoRedondo(ctx: Contexto, c: Pick<CaixaDesenhada, "x" | "y" | "w" | "h" | "raio">): void {
  ctx.beginPath();
  const r = Math.min(c.raio, c.w / 2, c.h / 2);
  if (typeof ctx.roundRect === "function") return void ctx.roundRect(c.x, c.y, c.w, c.h, r);
  ctx.moveTo(c.x + r, c.y);
  ctx.arcTo(c.x + c.w, c.y, c.x + c.w, c.y + c.h, r);
  ctx.arcTo(c.x + c.w, c.y + c.h, c.x, c.y + c.h, r);
  ctx.arcTo(c.x, c.y + c.h, c.x, c.y, r);
  ctx.arcTo(c.x, c.y, c.x + c.w, c.y, r);
  ctx.closePath();
}

function pintarCaixa(ctx: Contexto, c: CaixaDesenhada, r: Recursos): void {
  caminhoRedondo(ctx, c);
  if (c.alfa > 0) {
    ctx.globalAlpha = c.opacidade * c.alfa;
    ctx.fillStyle = r.paleta[c.cor];
    ctx.fill();
  }
  if (!c.borda) return;
  ctx.globalAlpha = c.opacidade;
  ctx.strokeStyle = r.paleta[c.borda.cor];
  ctx.lineWidth = c.borda.largura;
  ctx.stroke();
}

function pintarTexto(ctx: Contexto, t: TextoDesenhado, r: Recursos): void {
  ctx.globalAlpha = t.opacidade;
  ctx.font = fonteCss(t.fonte, r);
  ctx.fillStyle = r.paleta[t.cor];
  ctx.textAlign = t.alinhar;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(t.texto, t.x, t.y);
}

/** O círculo do avatar: a moldura de acento, e dentro a foto (cortada no círculo) ou as iniciais em cor de fundo sobre a cor do atirador. */
function pintarAvatar(ctx: Contexto, a: AvatarDesenhado, r: Recursos): void {
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(a.cx, a.cy, a.r + a.borda, 0, Math.PI * 2);
  ctx.fillStyle = r.paleta.acento;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(a.cx, a.cy, a.r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = r.paleta[r.avatar ? "fundo" : a.corFundo];
  ctx.fillRect(a.cx - a.r, a.cy - a.r, 2 * a.r, 2 * a.r);
  if (r.avatar) ctx.drawImage(r.avatar, a.cx - a.r, a.cy - a.r, 2 * a.r, 2 * a.r);
  else pintarTexto(ctx, { tipo: "texto", parte: "avatar", x: a.cx, y: a.cy + a.fonte.px * 0.36, texto: a.iniciais, fonte: a.fonte, cor: "fundo", alinhar: "center", opacidade: 1 }, r);
  ctx.restore();
}

/** O ícone da marca, inteiro (sem cortar); sem a imagem, não pinta nada (a caixa e o nome continuam). */
function pintarLogo(ctx: Contexto, l: LogoDesenhado, r: Recursos): void {
  if (!r.logo) return;
  ctx.globalAlpha = 1;
  // Sem esticar (como o `object-fit: contain` da tela): a imagem inteira, centrada na caixa da marca.
  const { width, height } = r.logo as { width?: number; height?: number };
  const k = width && height ? Math.min(l.w / width, l.h / height) : 1;
  const w = width ? width * k : l.w;
  const h = height ? height * k : l.h;
  ctx.drawImage(r.logo, l.x + (l.w - w) / 2, l.y + (l.h - h) / 2, w, h);
}

/** Pinta as peças na ordem (o de trás primeiro) e devolve o contexto como estava (opacidade 1). */
export function pintarOverlay(ctx: Contexto, pecas: readonly Primitiva[], r: Recursos): void {
  for (const q of pecas) {
    if (q.tipo === "caixa") pintarCaixa(ctx, q, r);
    else if (q.tipo === "texto") pintarTexto(ctx, q, r);
    else if (q.tipo === "logo") pintarLogo(ctx, q, r);
    else pintarAvatar(ctx, q, r);
  }
  ctx.globalAlpha = 1;
}
