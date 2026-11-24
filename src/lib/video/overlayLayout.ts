// O layout do overlay para o CANVAS (V3): a MESMA composição do OverlayDoVideo.svelte, agora em pixels do vídeo, para desenhar nos quadros exportados.
// Função pura: recebe o tamanho do quadro, o estado do instante (estadoDoOverlay), os dados e as opções, e devolve a lista de peças (overlayPrimitivas.ts).
// A medida é a da tela: u = 1% do lado MENOR do quadro, então 9:16 e 16:9 saem com o mesmo desenho. O cabeçalho fica no alto à esquerda e a marca no alto à
// direita; o STAND BY no centro antes do apito; o resultado no alto, no fim; a faixa de baixo (avatar, nome, splits e cronômetro) vem de overlayLayoutPe.ts.
// Os limites em rem da tela (clamp) não se aplicam: no arquivo não há fonte do sistema, só a proporção do quadro. Sem clarão do apito: é só da reprodução.
import type { PrefsOverlay } from "../preferencias";
import type { DadosDoOverlay, EstadoDoOverlay, ResultadoDoOverlay } from "./overlay";
import { layoutDoPe } from "./overlayLayoutPe";
import { alturaDaLinha, caixa, cortar, deslocar, linhaDeBase, textoEmCaixa, type Fonte, type Medir, type Pincel, type Primitiva } from "./overlayPrimitivas";

/** Os textos já no idioma da tela e os formatos de número (o layout não conhece o i18n). */
export type TextosDoOverlay = {
  marca: string;
  standby: string;
  apito: string;
  total: string;
  primeiro: string;
  nDisparos: string;
  incompleta: string;
  /** Segundos no formato da tela ("12,34"), sem o " s". */
  seg: (ms: number) => string;
  pontos: (n: number) => string;
  hf: (hf: number) => string;
  /** A data do cabeçalho (dataDoCabecalho no idioma da tela). */
  data: (iso: string | undefined) => string;
};
/** As chaves de Ajustes (o que mostrar), os textos, o medidor de texto e o alto contraste. */
export type OpcoesDoLayout = { prefs: PrefsOverlay; textos: TextosDoOverlay; medir: Medir; altoContraste?: boolean };

/** A marca no canto de cima à direita: o ícone do Nicska e, embaixo, o nome, numa caixa só (a mesma da tela: `.marca` do OverlayDoVideo). */
function layoutDaMarca(p: Pincel, nome: string, largura: number): { pecas: Primitiva[]; w: number } {
  const { u } = p;
  const pad: [number, number] = [u * 1.4, u * 0.8];
  const fonte: Fonte = { px: u * 2.6, peso: 700 };
  const lado = u * 8;
  const w = Math.max(lado, p.medir(nome, fonte)) + 2 * pad[0];
  const h = pad[1] + lado + u * 0.4 + alturaDaLinha(fonte) + pad[1];
  const x = largura - 3 * u - w;
  const texto: Primitiva = { tipo: "texto", parte: "marca", x: x + w / 2, y: linhaDeBase(3 * u + pad[1] + lado + u * 0.4, fonte), texto: nome, fonte, cor: "texto", alinhar: "center", opacidade: 1 };
  const logo: Primitiva = { tipo: "logo", parte: "marca", x: x + (w - lado) / 2, y: 3 * u + pad[1], w: lado, h: lado };
  return { pecas: [caixa(p, "marca", { x, y: 3 * u, w, h }), logo, texto], w };
}

/** O cabeçalho (percurso · divisão · data) à esquerda e a marca à direita, no alto; o cabeçalho corta com "…" para não passar por baixo da marca. */
function layoutDoAlto(p: Pincel, largura: number, dados: DadosDoOverlay, o: OpcoesDoLayout): Primitiva[] {
  const { u } = p;
  const pad: [number, number] = [u * 1.8, u * 0.6];
  const pecas: Primitiva[] = [];
  let livre = largura - 6 * u;
  if (o.prefs.marca) {
    const m = layoutDaMarca(p, o.textos.marca, largura);
    pecas.push(...m.pecas);
    livre -= m.w + 2 * u;
  }
  const texto = [dados.percurso, dados.divisao, o.textos.data(dados.data)].filter(Boolean).join(" · ");
  const fonte: Fonte = { px: u * 3.6, peso: 600 };
  const cabe = o.prefs.cabecalho && texto ? cortar(p, texto, fonte, livre - 2 * pad[0]) : "";
  if (cabe) pecas.push(...textoEmCaixa(p, { parte: "cabecalho", texto: cabe, fonte, cor: "texto", pad }, { x: 3 * u, y: 3 * u }).pecas);
  return pecas;
}

/** O STAND BY grande e "Aguardando o apito" embaixo, numa caixa no centro do quadro. */
function layoutDoStandby(p: Pincel, largura: number, altura: number, o: OpcoesDoLayout): Primitiva[] {
  const { u } = p;
  const grande: Fonte = { px: u * 11, peso: 800, display: true };
  const apito: Fonte = { px: u * 3.6, peso: 400 };
  const w = Math.max(p.medir(o.textos.standby, grande), p.medir(o.textos.apito, apito)) + 8 * u;
  const h = alturaDaLinha(grande) + 0.8 * u + alturaDaLinha(apito) + 4 * u;
  const x = (largura - w) / 2;
  const y = (altura - h) / 2;
  const cx = largura / 2;
  const base = { tipo: "texto" as const, parte: "standby" as const, x: cx, alinhar: "center" as const, cor: "texto" as const, opacidade: 1 };
  return [
    caixa(p, "standby", { x, y, w, h }),
    { ...base, y: linhaDeBase(y + 2 * u, grande), texto: o.textos.standby, fonte: grande },
    { ...base, y: linhaDeBase(y + 2 * u + alturaDaLinha(grande) + 0.8 * u, apito), texto: o.textos.apito, fonte: apito },
  ];
}

/** Um bloco montado na origem: as peças e o tamanho. */
type Bloco = { pecas: Primitiva[]; w: number; h: number };

/** Um par rótulo/valor do resultado ("Total" sobre "12,34"), os dois centrados. */
function parDoResultado(p: Pincel, rotulo: string, valor: string): Bloco {
  const dt: Fonte = { px: p.u * 3.4, peso: 400 };
  const dd: Fonte = { px: p.u * 3.4 * 1.4, peso: 700, display: true };
  const w = Math.max(p.medir(rotulo, dt), p.medir(valor, dd));
  const base = { tipo: "texto" as const, parte: "resultado" as const, x: w / 2, alinhar: "center" as const, opacidade: 1 };
  return {
    pecas: [{ ...base, y: linhaDeBase(0, dt), texto: rotulo, fonte: dt, cor: "suave" }, { ...base, y: linhaDeBase(alturaDaLinha(dt), dd), texto: valor, fonte: dd, cor: "texto" }],
    w,
    h: alturaDaLinha(dt) + alturaDaLinha(dd),
  };
}

/** O selo "⚠ INCOMPLETA": só a borda (cor do texto), dentro da caixa do resultado. */
function seloDeIncompleta(p: Pincel, texto: string): Bloco {
  const { u } = p;
  const fonte: Fonte = { px: u * 3.4, peso: 800 };
  const t = textoEmCaixa(p, { parte: "resultado", texto: `⚠ ${texto.toLocaleUpperCase()}`, fonte, cor: "texto", pad: [u * 1.4, u * 0.4] }, { x: 0, y: 0 });
  const [moldura, rotulo] = t.pecas;
  const borda = { ...(moldura as Extract<Primitiva, { tipo: "caixa" }>), alfa: 0, raio: u, borda: { cor: "texto" as const, largura: u * 0.3 } };
  return { pecas: [borda, rotulo], w: t.w, h: t.h };
}

/** Reparte os blocos em linhas de até `max` de largura (um bloco sozinho mais largo que `max` fica numa linha só dele). */
function emLinhas(blocos: Bloco[], max: number, gap: number): Bloco[][] {
  const linhas: Bloco[][] = [];
  let usado = 0;
  for (const b of blocos) {
    const atual = linhas.at(-1);
    if (atual && usado + gap + b.w <= max) {
      atual.push(b);
      usado += gap + b.w;
    } else {
      linhas.push([b]);
      usado = b.w;
    }
  }
  return linhas;
}

/** Os blocos em linhas que quebram (como o flex-wrap centrado da tela): cada linha centrada; cada bloco centrado na altura da linha. */
function fluir(blocos: Bloco[], max: number, gap: [number, number]): Bloco {
  const linhas = emLinhas(blocos, max, gap[0]);
  const larguraDe = (l: Bloco[]) => l.reduce((s, b) => s + b.w, 0) + gap[0] * (l.length - 1);
  const w = Math.max(...linhas.map(larguraDe));
  const pecas: Primitiva[] = [];
  let y = 0;
  for (const l of linhas) {
    const h = Math.max(...l.map((b) => b.h));
    let x = (w - larguraDe(l)) / 2;
    for (const b of l) {
      pecas.push(...deslocar(b.pecas, x, y + (h - b.h) / 2));
      x += b.w + gap[0];
    }
    y += h + gap[1];
  }
  return { pecas, w, h: y - gap[1] };
}

/** O resultado final (total, 1º disparo, disparos, pontos e HF, selo de incompleta), numa caixa centrada a 12u do alto. */
function layoutDoResultado(p: Pincel, largura: number, r: ResultadoDoOverlay, t: TextosDoOverlay): Primitiva[] {
  const { u } = p;
  const pares = [parDoResultado(p, t.total, t.seg(r.totalMs)), parDoResultado(p, t.primeiro, t.seg(r.primeiroMs)), parDoResultado(p, t.nDisparos, String(r.n))];
  if (r.pontos !== null) pares.push(parDoResultado(p, t.pontos(r.pontos), r.hf === null ? "—" : t.hf(r.hf)));
  if (r.incompleta) pares.push(seloDeIncompleta(p, t.incompleta));
  const pad: [number, number] = [u * 2.4, u * 1.2];
  const dentro = fluir(pares, largura * 0.92 - 2 * pad[0], [u * 3, u * 0.6]);
  const w = dentro.w + 2 * pad[0];
  const x = (largura - w) / 2;
  return [caixa(p, "resultado", { x, y: 19 * u, w, h: dentro.h + 2 * pad[1] }), ...deslocar(dentro.pecas, x + pad[0], 19 * u + pad[1])];
}

/** As peças do overlay no quadro `largura` × `altura` (px), no instante descrito por `estado`; a ordem é a de pintar (o de trás primeiro). */
export function layoutDoOverlay(largura: number, altura: number, estado: EstadoDoOverlay, dados: DadosDoOverlay, opcoes: OpcoesDoLayout): Primitiva[] {
  const p: Pincel = { u: Math.min(largura, altura) / 100, medir: opcoes.medir, altoContraste: opcoes.altoContraste === true };
  const meio = estado.fase === "antes" ? layoutDoStandby(p, largura, altura, opcoes) : estado.resultado ? layoutDoResultado(p, largura, estado.resultado, opcoes.textos) : [];
  return [...layoutDoAlto(p, largura, dados, opcoes), ...meio, ...layoutDoPe(p, { largura, altura }, { estado, dados, opcoes })];
}
