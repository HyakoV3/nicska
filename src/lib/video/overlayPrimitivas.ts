// As peças do overlay desenhado no CANVAS (V3, o vídeo exportado com os tempos): caixas, textos e o círculo do avatar, em pixels do vídeo. O layout
// (overlayLayout.ts) as calcula sem tocar em canvas nenhum, e o desenhista (overlayCanvas.ts) só as pinta. As cores são NOMES de tokens do tema: quem pinta
// resolve no tema atual. Aqui ficam também as contas pequenas que as duas partes do layout repartem (caixa com texto, cortar com reticências).

/** Os tokens do tema que o overlay usa (sem o "--"). */
export type Cor = "fundo" | "texto" | "suave" | "acento" | "tempo-ativo" | "tempo-fundo" | "tempo-sobre" | "borda-controle" | "grafico-a" | "grafico-b" | "grafico-c" | "grafico-d";
/** `display`: a fonte dos números grandes (Sora), como o `.digitos` da tela; sem ela, a da interface. */
export type Fonte = { px: number; peso: number; display?: boolean };
/** De que parte do overlay é a peça (os testes conferem posições e sobreposição por parte). */
export type Parte = "cabecalho" | "marca" | "standby" | "resultado" | "avatar" | "nome" | "split" | "cronometro";

export type Borda = { cor: Cor; largura: number };
export type CaixaDesenhada = { tipo: "caixa"; parte: Parte; x: number; y: number; w: number; h: number; raio: number; cor: Cor; alfa: number; borda: Borda | null; opacidade: number };
/** `y` é a linha de base do texto; `x` é a borda esquerda, o centro ou a borda direita, conforme `alinhar`. */
export type TextoDesenhado = { tipo: "texto"; parte: Parte; x: number; y: number; texto: string; fonte: Fonte; cor: Cor; alinhar: "left" | "center" | "right"; opacidade: number };
/** O avatar: a foto (quem pinta a tem) ou, sem ela, as iniciais sobre `corFundo`; borda de acento como a moldura da tela. */
export type AvatarDesenhado = { tipo: "avatar"; parte: "avatar"; cx: number; cy: number; r: number; borda: number; iniciais: string; corFundo: Cor; fonte: Fonte };
/** O ícone do Nicska (a marca): o desenhista o pinta se tem a imagem. */
export type LogoDesenhado = { tipo: "logo"; parte: "marca"; x: number; y: number; w: number; h: number };
export type Primitiva = CaixaDesenhada | TextoDesenhado | AvatarDesenhado | LogoDesenhado;

/** Mede a largura de um texto numa fonte (o `measureText` do canvas, ou uma conta falsa nos testes). */
export type Medir = (texto: string, fonte: Fonte) => number;

/** O mesmo `line-height: 1.15` do overlay da tela. */
export const ALTURA_DA_LINHA = 1.15;
/** Onde cai a linha de base numa linha de 1,15 em: meia sobra (0,075 em) mais o ascendente típico (~0,8 em). */
const BASE_NA_LINHA = 0.875;

/** O que toda conta do layout precisa: a medida `u` (1% do lado menor), o medidor e o modo alto contraste (caixa sólida com borda). */
export type Pincel = { u: number; medir: Medir; altoContraste: boolean };

export const alturaDaLinha = (f: Fonte): number => f.px * ALTURA_DA_LINHA;
export const linhaDeBase = (topo: number, f: Fonte): number => topo + f.px * BASE_NA_LINHA;

/** O texto cabe em `max`? Se não, corta e põe "…" (como o `text-overflow: ellipsis` da tela). */
export function cortar(p: Pincel, texto: string, fonte: Fonte, max: number): string {
  if (p.medir(texto, fonte) <= max) return texto;
  const letras = Array.from(texto);
  while (letras.length > 0 && p.medir(letras.join("") + "…", fonte) > max) letras.pop();
  return letras.length ? letras.join("").trimEnd() + "…" : "";
}

/** A caixa de fundo de um texto: o fundo do tema quase sólido (85%) ou, no alto contraste, sólido com borda; raio de 1,2u. */
export function caixa(p: Pincel, parte: Parte, r: { x: number; y: number; w: number; h: number }, opacidade = 1): CaixaDesenhada {
  const borda = p.altoContraste ? { cor: "borda-controle" as const, largura: p.u * 0.25 } : null;
  return { tipo: "caixa", parte, ...r, raio: p.u * 1.2, cor: "fundo", alfa: p.altoContraste ? 1 : 0.85, borda, opacidade };
}

/** Um texto de uma linha dentro de uma caixa com folga `pad` ([horizontal, vertical]); `x` é a borda esquerda ou direita da caixa. */
export type TextoEmCaixa = { parte: Parte; texto: string; fonte: Fonte; cor: Cor; pad: [number, number] };

/** Monta a caixa e o texto; a caixa começa em `x` (ou termina nele, com `daDireita`) e no topo `y`. Devolve também o tamanho. */
export function textoEmCaixa(p: Pincel, t: TextoEmCaixa, onde: { x: number; y: number; daDireita?: boolean }): { pecas: Primitiva[]; w: number; h: number } {
  const w = p.medir(t.texto, t.fonte) + 2 * t.pad[0];
  const h = alturaDaLinha(t.fonte) + 2 * t.pad[1];
  const x = onde.daDireita ? onde.x - w : onde.x;
  const texto: TextoDesenhado = { tipo: "texto", parte: t.parte, x: x + t.pad[0], y: linhaDeBase(onde.y + t.pad[1], t.fonte), texto: t.texto, fonte: t.fonte, cor: t.cor, alinhar: "left", opacidade: 1 };
  return { pecas: [caixa(p, t.parte, { x, y: onde.y, w, h }), texto], w, h };
}

/** Desloca peças já montadas (o layout monta um bloco na origem e só depois sabe onde ele cai). */
export function deslocar(pecas: Primitiva[], dx: number, dy: number): Primitiva[] {
  return pecas.map((q) => (q.tipo === "avatar" ? { ...q, cx: q.cx + dx, cy: q.cy + dy } : { ...q, x: q.x + dx, y: q.y + dy }));
}
