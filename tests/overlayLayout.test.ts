import { describe, expect, it } from "vitest";
import { overlayPadrao, type PrefsOverlay } from "../src/lib/preferencias";
import { estadoDoOverlay, opacidadeDoSplit, type DadosDoOverlay } from "../src/lib/video/overlay";
import { layoutDoOverlay, type OpcoesDoLayout, type TextosDoOverlay } from "../src/lib/video/overlayLayout";
import { PALETA_DE_RECUO, paletaDoTema, pintarOverlay } from "../src/lib/video/overlayCanvas";
import type { Parte, Primitiva } from "../src/lib/video/overlayPrimitivas";

// O layout do overlay no canvas (V3) é função pura: as mesmas partes do OverlayDoVideo, nas mesmas regiões do quadro, sem sobreposição entre as caixas
// principais em pé e deitado, os últimos 5 splits esmaecendo, STAND BY só antes do apito e o resultado só no fim, e cada chave de Ajustes respeitada.

const textos: TextosDoOverlay = {
  marca: "Nicska",
  standby: "STAND BY",
  apito: "Aguardando o apito",
  total: "Total",
  primeiro: "1º disparo",
  nDisparos: "Disparos",
  incompleta: "Incompleta",
  seg: (ms) => (ms / 1000).toFixed(2).replace(".", ","),
  pontos: (n) => `${n} pontos`,
  hf: (v) => `HF ${v.toFixed(4)}`,
  data: (iso) => (iso ? "23/11/2026" : ""),
};
/** Medidor falso: 0,6 em por letra. */
const medir = (t: string, f: { px: number }) => Array.from(t).length * f.px * 0.6;
const opcoes = (prefs: Partial<PrefsOverlay> = {}): OpcoesDoLayout => ({ prefs: { ...overlayPadrao(), ...prefs }, textos, medir });
const dados: DadosDoOverlay = {
  zeroNoVideoS: 2,
  disparosMs: [1200, 1500, 1800, 2100, 2400, 2700, 3000],
  pontos: { A: 10, C: 2, D: 0, M: 0, NS: 0, procedimentais: 0, fator: "minor" },
  incompleta: true,
  atirador: { id: "a1", nome: "Maria Atiradora" },
  percurso: "El Presidente",
  divisao: "Production",
  data: "2026-11-23T12:00:00Z",
};
const QUADROS = { deitado: [1280, 720], emPe: [720, 1280] } as const;
const noInstante = (s: number, l = 1280, a = 720, o = opcoes()) => layoutDoOverlay(l, a, estadoDoOverlay(s, dados), dados, o);
const partes = (ps: Primitiva[]) => new Set(ps.map((p) => p.parte));

type Retangulo = { x: number; y: number; w: number; h: number };
/** O retângulo que envolve todas as peças de uma parte. */
function caixaDe(ps: Primitiva[], parte: Parte): Retangulo | null {
  const rs = ps.filter((p) => p.parte === parte).map((p) => (p.tipo === "avatar" ? { x: p.cx - p.r - p.borda, y: p.cy - p.r - p.borda, w: 2 * (p.r + p.borda), h: 2 * (p.r + p.borda) } : p.tipo === "caixa" ? p : null));
  const so = rs.filter((r): r is Retangulo => r !== null);
  if (!so.length) return null;
  const x = Math.min(...so.map((r) => r.x));
  const y = Math.min(...so.map((r) => r.y));
  return { x, y, w: Math.max(...so.map((r) => r.x + r.w)) - x, h: Math.max(...so.map((r) => r.y + r.h)) - y };
}
const cruza = (a: Retangulo, b: Retangulo) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const dentro = (r: Retangulo, l: number, a: number) => r.x >= 0 && r.y >= 0 && r.x + r.w <= l && r.y + r.h <= a;

describe("layout do overlay no canvas", () => {
  it("antes do apito: STAND BY no centro, sem resultado, cronômetro em zero", () => {
    const ps = noInstante(1);
    const sb = caixaDe(ps, "standby")!;
    expect(sb.x + sb.w / 2).toBeCloseTo(640);
    expect(sb.y + sb.h / 2).toBeCloseTo(360);
    expect(partes(ps).has("resultado")).toBe(false);
    expect(ps.some((p) => p.tipo === "texto" && p.parte === "cronometro" && p.texto === "0,00")).toBe(true);
  });

  it("correndo: nem STAND BY nem resultado; no fim, o resultado no alto e o STAND BY não volta", () => {
    expect(partes(noInstante(3.6)).has("standby")).toBe(false);
    expect(partes(noInstante(3.6)).has("resultado")).toBe(false);
    const fim = noInstante(6);
    expect(partes(fim).has("standby")).toBe(false);
    const r = caixaDe(fim, "resultado")!;
    expect(r.y).toBeCloseTo(19 * 7.2);
    expect(r.x + r.w / 2).toBeCloseTo(640);
    expect(fim.some((p) => p.tipo === "texto" && p.texto.includes("INCOMPLETA"))).toBe(true);
    expect(fim.some((p) => p.tipo === "texto" && p.texto === "56 pontos")).toBe(true); // 10 A + 2 C (minor) = 56
  });

  it("cabeçalho no alto à esquerda, marca no alto à direita, avatar e nome embaixo à esquerda, tempos embaixo à direita", () => {
    const [l, a] = QUADROS.deitado;
    const ps = noInstante(4.5);
    const u = 7.2;
    expect(caixaDe(ps, "cabecalho")).toMatchObject({ x: 3 * u, y: 3 * u });
    const marca = caixaDe(ps, "marca")!;
    expect(marca.x + marca.w).toBeCloseTo(l - 3 * u);
    const crono = caixaDe(ps, "cronometro")!;
    expect(crono.x + crono.w).toBeCloseTo(l - 3 * u);
    expect(crono.y + crono.h).toBeCloseTo(a - 3 * u);
    const avatar = caixaDe(ps, "avatar")!;
    expect(avatar.x).toBeCloseTo(3 * u);
    expect(caixaDe(ps, "nome")!.x).toBeGreaterThan(avatar.x + avatar.w);
  });

  for (const [nome, [l, a]] of Object.entries(QUADROS)) {
    it(`sem sobreposição entre as caixas principais e tudo dentro do quadro (${nome})`, () => {
      for (const s of [1, 4.5, 6]) {
        const ps = noInstante(s, l, a);
        const principais = (["cabecalho", "marca", "standby", "resultado", "avatar", "nome", "split", "cronometro"] as Parte[]).filter((p) => p !== "split");
        const rs = principais.map((p) => caixaDe(ps, p)).filter((r): r is Retangulo => r !== null);
        for (const r of rs) expect(dentro(r, l, a), `${nome} ${s}s`).toBe(true);
        for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) expect(cruza(rs[i], rs[j]), `${nome} ${s}s ${principais[i]}×${principais[j]}`).toBe(false);
        const splits = caixaDe(ps, "split");
        if (splits) for (const r of rs) expect(cruza(splits, r)).toBe(false);
      }
    });
  }

  it("só os últimos 5 splits, do mais antigo (em cima, mais apagado) ao mais recente (embaixo, em destaque)", () => {
    const ps = noInstante(2 + 3.05); // os 7 disparos já ocorreram e o último foi há 50 ms: ainda em destaque
    const caixas = ps.filter((p): p is Extract<Primitiva, { tipo: "caixa" }> => p.tipo === "caixa" && p.parte === "split");
    expect(caixas).toHaveLength(5);
    const ys = caixas.map((c) => c.y);
    expect([...ys].sort((x, y) => x - y)).toEqual(ys);
    expect(caixas.map((c) => c.opacidade)).toEqual([4, 3, 2, 1, 0].map(opacidadeDoSplit));
    const numeros = ps.filter((p) => p.tipo === "texto" && p.parte === "split" && /^▸?\d+$/.test(p.texto)).map((p) => (p as { texto: string }).texto);
    expect(numeros).toEqual(["3", "4", "5", "6", "▸7"]);
    expect(caixas.at(-1)).toMatchObject({ cor: "tempo-fundo", alfa: 1 });
  });

  it("respeita as chaves desligadas: avatar, nome, cabeçalho, splits e marca", () => {
    const tudoDesligado = opcoes({ avatar: false, nome: false, cabecalho: false, splits: false, marca: false });
    const ps = layoutDoOverlay(1280, 720, estadoDoOverlay(4.5, dados), dados, tudoDesligado);
    expect([...partes(ps)]).toEqual(["cronometro"]);
    const soSemAvatar = noInstante(4.5, 1280, 720, opcoes({ avatar: false }));
    expect(partes(soSemAvatar).has("avatar")).toBe(false);
    expect(caixaDe(soSemAvatar, "nome")!.x).toBeCloseTo(3 * 7.2);
  });

  it("sem atirador, sem avatar nem nome; avatar sem foto leva as iniciais", () => {
    const semQuem = { ...dados, atirador: null };
    expect(partes(layoutDoOverlay(1280, 720, estadoDoOverlay(4.5, semQuem), semQuem, opcoes())).has("avatar")).toBe(false);
    const av = noInstante(4.5).find((p) => p.tipo === "avatar");
    expect(av).toMatchObject({ iniciais: "MA" });
  });

  it("o cabeçalho corta com reticências para não passar por baixo da marca", () => {
    const longo = { ...dados, percurso: "Um percurso com um nome enorme que não cabe de jeito nenhum na largura" };
    const ps = layoutDoOverlay(720, 1280, estadoDoOverlay(4.5, longo), longo, opcoes());
    const cab = ps.find((p) => p.tipo === "texto" && p.parte === "cabecalho") as { texto: string };
    expect(cab.texto.endsWith("…")).toBe(true);
    expect(cruza(caixaDe(ps, "cabecalho")!, caixaDe(ps, "marca")!)).toBe(false);
  });

  it("alto contraste: caixas sólidas com borda", () => {
    const ps = layoutDoOverlay(1280, 720, estadoDoOverlay(4.5, dados), dados, { ...opcoes(), altoContraste: true });
    const c = ps.find((p) => p.tipo === "caixa" && p.parte === "cronometro");
    expect(c).toMatchObject({ alfa: 1, borda: { cor: "borda-controle" } });
  });
});

describe("pintura e paleta", () => {
  it("a paleta lê os tokens do tema e recua para os fixos no que vier vazio", () => {
    const p = paletaDoTema((n) => (n === "--texto" ? " #000000 " : ""));
    expect(p.texto).toBe("#000000");
    expect(p.fundo).toBe(PALETA_DE_RECUO.fundo);
  });

  it("pinta cada peça (contexto falso) e deixa a opacidade em 1", () => {
    const chamadas: string[] = [];
    const ctx = new Proxy({ globalAlpha: 1 } as Record<string, unknown>, {
      get: (alvo, k) => (k in alvo ? alvo[k as string] : (...a: unknown[]) => void chamadas.push(`${String(k)}:${a.length}`)),
      set: (alvo, k, v) => ((alvo[k as string] = v), true),
    });
    pintarOverlay(ctx as never, noInstante(6), { paleta: PALETA_DE_RECUO, avatar: null, familia: "sans-serif", familiaDisplay: "sans-serif" });
    expect(chamadas.some((c) => c.startsWith("fillText"))).toBe(true);
    expect(chamadas.some((c) => c.startsWith("arc"))).toBe(true);
    expect(ctx.globalAlpha).toBe(1);
  });
});
