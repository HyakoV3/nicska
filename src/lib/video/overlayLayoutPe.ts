// A faixa de baixo do overlay no canvas (V3), como a `.pe` do OverlayDoVideo.svelte: à esquerda o avatar e o nome (o nome corta com "…"), à direita os
// splits (os últimos 5, os mais antigos esmaecendo pela `opacidadeDoSplit`, o recém-ocorrido em destaque com "▸", negrito e o bloco de cor de tempo) e o
// cronômetro grande embaixo deles. Os dois lados ficam alinhados pela base, a 3u da borda de baixo; o lado dos tempos não encolhe, o do nome sim.
import { corDasIniciais, iniciais } from "../avatar";
import { SPLITS_VISIVEIS, opacidadeDoSplit, type AtiradorDoOverlay, type DadosDoOverlay, type EstadoDoOverlay, type SplitDoOverlay } from "./overlay";
import type { OpcoesDoLayout } from "./overlayLayout";
import { alturaDaLinha, caixa, cortar, deslocar, linhaDeBase, textoEmCaixa, type Cor, type Fonte, type Pincel, type Primitiva, type TextoDesenhado } from "./overlayPrimitivas";

type Bloco = { pecas: Primitiva[]; w: number; h: number };
/** O instante a desenhar: o estado (fase, splits, cronômetro), os dados (quem atira) e as opções. */
export type CenaDoPe = { estado: EstadoDoOverlay; dados: DadosDoOverlay; opcoes: OpcoesDoLayout };

const texto = (t: Omit<TextoDesenhado, "tipo" | "opacidade">, opacidade = 1): TextoDesenhado => ({ tipo: "texto", ...t, opacidade });

/** O cronômetro: o número grande na cor do tempo e o " s" pequeno e suave, na mesma linha de base. */
function cronometro(p: Pincel, ms: number, seg: (ms: number) => string): Bloco {
  const { u } = p;
  const num: Fonte = { px: u * 11, peso: 700, display: true };
  const unid: Fonte = { px: u * 11 * 0.35, peso: 400, display: true };
  const valor = seg(ms);
  const wNum = p.medir(valor, num);
  const wUnid = p.medir(" s", unid);
  const w = wNum + wUnid + 4 * u;
  const h = alturaDaLinha(num) + 0.8 * u;
  const base = linhaDeBase(0.4 * u, num);
  return {
    pecas: [
      caixa(p, "cronometro", { x: 0, y: 0, w, h }),
      texto({ parte: "cronometro", x: 2 * u, y: base, texto: valor, fonte: num, cor: "tempo-ativo", alinhar: "left" }),
      texto({ parte: "cronometro", x: 2 * u + wNum, y: base, texto: " s", fonte: unid, cor: "suave", alinhar: "left" }),
    ],
    w,
    h,
  };
}

/** Um split: o número (coluna de 2,2 em, com "▸" no recém-ocorrido) e o tempo; o recente tem o bloco de cor de tempo e negrito. */
function split(p: Pincel, s: SplitDoOverlay, c: { recente: boolean; opacidade: number; seg: (ms: number) => string }): Bloco {
  const { u } = p;
  const peso = c.recente ? 800 : 400;
  const fn: Fonte = { px: u * 4, peso };
  const ft: Fonte = { px: u * 4, peso, display: true };
  const n = `${c.recente ? "▸" : ""}${s.n}`;
  const coluna = Math.max(u * 4 * 2.2, p.medir(n, fn)) + p.medir(" ", fn);
  const valor = c.seg(s.splitMs);
  const w = coluna + p.medir(valor, ft) + 3.6 * u;
  const h = alturaDaLinha(fn) + 1.2 * u;
  const fundo = caixa(p, "split", { x: 0, y: 0, w, h }, c.opacidade);
  const corDoTexto: Cor = c.recente ? "tempo-sobre" : "texto";
  const base = linhaDeBase(0.6 * u, fn);
  return {
    pecas: [
      c.recente ? { ...fundo, cor: "tempo-fundo", alfa: 1 } : fundo,
      texto({ parte: "split", x: 1.8 * u, y: base, texto: n, fonte: fn, cor: c.recente ? corDoTexto : "suave", alinhar: "left" }, c.opacidade),
      texto({ parte: "split", x: 1.8 * u + coluna, y: base, texto: valor, fonte: ft, cor: corDoTexto, alinhar: "left" }, c.opacidade),
    ],
    w,
    h,
  };
}

/** Os splits empilhados (o mais antigo em cima) sobre o cronômetro, todos encostados à direita do bloco. */
function blocoDosTempos(p: Pincel, estado: EstadoDoOverlay, o: OpcoesDoLayout): Bloco {
  const visiveis = o.prefs.splits ? estado.splits.slice(-SPLITS_VISIVEIS) : [];
  const itens = visiveis.map((s, i) => split(p, s, { recente: estado.recente === s.n, opacidade: opacidadeDoSplit(visiveis.length - 1 - i), seg: o.textos.seg }));
  const crono = cronometro(p, estado.decorridoMs, o.textos.seg);
  const pilha = itens.length ? [...itens, crono] : [crono];
  const w = Math.max(...pilha.map((b) => b.w));
  const pecas: Primitiva[] = [];
  let y = 0;
  pilha.forEach((b, i) => {
    pecas.push(...deslocar(b.pecas, w - b.w, y));
    y += b.h + (i === pilha.length - 2 ? 0.8 * p.u : 0.5 * p.u);
  });
  return { pecas, w, h: y - 0.5 * p.u };
}

/** O token da cor das iniciais ("var(--grafico-b)" → "grafico-b"). */
const corDoToken = (css: string): Cor => css.replace(/^var\(--|\)$/g, "") as Cor;

/** Avatar (moldura de 0,6u em volta de um círculo de 13u) e nome ao lado, centrados na altura um do outro; o nome cabe em `livre`. */
function blocoDeQuem(p: Pincel, quem: AtiradorDoOverlay | null, o: OpcoesDoLayout, livre: number): Bloco {
  const { u } = p;
  const comAvatar = o.prefs.avatar && !!quem;
  const lado = comAvatar ? 14.2 * u : 0;
  const fonte: Fonte = { px: u * 4, peso: 700 };
  const pad: [number, number] = [u * 1.8, u * 0.6];
  const espaco = livre - lado - (comAvatar ? 1.6 * u : 0) - 2 * pad[0];
  const nome = o.prefs.nome && quem ? cortar(p, quem.nome, fonte, espaco) : "";
  const hNome = nome ? alturaDaLinha(fonte) + 2 * pad[1] : 0;
  const h = Math.max(lado, hNome);
  const pecas: Primitiva[] = [];
  if (comAvatar && quem) {
    const avatar = { tipo: "avatar" as const, parte: "avatar" as const, cx: lado / 2, cy: h / 2, r: 6.5 * u, borda: 0.6 * u };
    pecas.push({ ...avatar, iniciais: iniciais(quem.nome), corFundo: corDoToken(corDasIniciais(quem.id)), fonte: { px: 13 * u * 0.4, peso: 700 } });
  }
  const x = comAvatar ? lado + 1.6 * u : 0;
  if (nome) pecas.push(...textoEmCaixa(p, { parte: "nome", texto: nome, fonte, cor: "texto", pad }, { x, y: (h - hNome) / 2 }).pecas);
  return { pecas, w: x + (nome ? p.medir(nome, fonte) + 2 * pad[0] : 0), h };
}

/** A faixa de baixo no quadro: os tempos à direita e quem atira à esquerda, com 2u de folga entre os dois. */
export function layoutDoPe(p: Pincel, quadro: { largura: number; altura: number }, c: CenaDoPe): Primitiva[] {
  const { u } = p;
  const fundo = quadro.altura - 3 * u;
  const tempos = blocoDosTempos(p, c.estado, c.opcoes);
  const quem = blocoDeQuem(p, c.dados.atirador ?? null, c.opcoes, quadro.largura - 6 * u - tempos.w - 2 * u);
  return [...deslocar(quem.pecas, 3 * u, fundo - quem.h), ...deslocar(tempos.pecas, quadro.largura - 3 * u - tempos.w, fundo - tempos.h)];
}
