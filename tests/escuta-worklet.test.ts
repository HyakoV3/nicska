import { beforeEach, describe, expect, it, vi } from "vitest";

// O worklet roda no fio de áudio, com globais próprios (sampleRate, currentFrame, registerProcessor): aqui eles são falsos e o módulo é importado de novo a cada teste.
const TAXA = 48000;
const BLOCO = 128;

type Processador = { process(e: Float32Array[][]): boolean; port: { onmessage: ((e: { data: unknown }) => void) | null } };
let Classe: new (o?: unknown) => Processador;
let postadas: { t: string; tipo?: string; quadro?: number; picos?: number[] }[];
let quadroAtual: number;

beforeEach(async () => {
  vi.resetModules();
  postadas = [];
  quadroAtual = 0;
  vi.stubGlobal("sampleRate", TAXA);
  Object.defineProperty(globalThis, "currentFrame", { configurable: true, get: () => quadroAtual });
  vi.stubGlobal(
    "AudioWorkletProcessor",
    class {
      port = { onmessage: null as ((e: { data: unknown }) => void) | null, postMessage: (m: never) => postadas.push(m) };
    },
  );
  vi.stubGlobal("registerProcessor", (_nome: string, c: typeof Classe) => (Classe = c));
  await import("../src/lib/escuta.worklet");
});

/** Um bloco de `BLOCO` amostras: silêncio, ou um tom de 2700 Hz (o apito) começando na amostra `a`. */
const silencio = () => new Float32Array(BLOCO);
function tom(deAmostra: number): Float32Array {
  const b = new Float32Array(BLOCO);
  for (let i = 0; i < BLOCO; i++) b[i] = 0.9 * Math.sin((2 * Math.PI * 2700 * (deAmostra + i)) / TAXA);
  return b;
}
function rodar(p: Processador, blocos: (Float32Array | null)[]): void {
  for (const b of blocos) {
    p.process(b ? [[b]] : [[]]);
    quadroAtual += BLOCO;
  }
}
const apitos = () => postadas.filter((m) => m.t === "evento" && m.tipo === "apito");

describe("worklet da escuta", () => {
  it("registra o processador com o nome que a Escuta usa", () => {
    expect(Classe).toBeDefined();
  });

  it("sem entrada ainda: segue esperando e não posta nada", () => {
    const p = new Classe();
    expect(p.process([[]])).toBe(true);
    expect(p.process([])).toBe(true);
    expect(postadas).toEqual([]);
  });

  it("depois de { t: 'parar' } o process devolve false (o nó é descartado)", () => {
    const p = new Classe();
    p.port.onmessage!({ data: { t: "parar" } });
    expect(p.process([[silencio()]])).toBe(false);
  });

  it("por padrão não calcula nem posta o envelope (ninguém o consome)", () => {
    const p = new Classe();
    rodar(p, Array.from({ length: 80 }, silencio));
    expect(postadas.filter((m) => m.t === "envelope")).toEqual([]);
  });

  it("desligar o envelope de novo para de postar", () => {
    const p = new Classe();
    p.port.onmessage!({ data: { t: "envelope", ligado: true } });
    rodar(p, Array.from({ length: 40 }, silencio));
    p.port.onmessage!({ data: { t: "envelope", ligado: false } });
    const antes = postadas.length;
    rodar(p, Array.from({ length: 80 }, silencio));
    expect(postadas).toHaveLength(antes);
  });

  it("posta o envelope em lotes de 10 picos (~5 ms cada) quando ligado", () => {
    const p = new Classe();
    p.port.onmessage!({ data: { t: "envelope", ligado: true } });
    rodar(p, Array.from({ length: 40 }, silencio)); // 40 blocos = 5120 amostras = ~21 picos de 240 amostras
    const lotes = postadas.filter((m) => m.t === "envelope");
    expect(lotes).toHaveLength(2);
    expect(lotes[0].picos).toHaveLength(10);
  });

  it("o quadro do evento é o do relógio do contexto (quadro inicial + amostra do detector)", () => {
    quadroAtual = 10_000; // o contexto já andou antes de o microfone ligar
    const p = new Classe();
    const blocos: Float32Array[] = [];
    for (let i = 0; i < 100; i++) blocos.push(silencio());
    for (let i = 0; i < 120; i++) blocos.push(tom(i * BLOCO));
    rodar(p, blocos);
    expect(apitos()).toHaveLength(1);
    const q = apitos()[0].quadro!;
    // o tom começa na amostra 100*128 do detector, 10 000 depois do zero do contexto
    expect(q).toBeGreaterThanOrEqual(10_000 + 100 * BLOCO - BLOCO);
    expect(q).toBeLessThanOrEqual(10_000 + 100 * BLOCO + 600);
  });

  // 07·REL-003: um furo no microfone não pode deslocar os eventos seguintes em relação ao relógio do contexto.
  it("um furo (blocos sem entrada) não desloca o quadro dos eventos seguintes", () => {
    const comFuro = new Classe();
    const blocos: (Float32Array | null)[] = [];
    for (let i = 0; i < 50; i++) blocos.push(silencio());
    for (let i = 0; i < 30; i++) blocos.push(null); // furo
    for (let i = 0; i < 20; i++) blocos.push(silencio());
    const inicioDoTom = blocos.length * BLOCO;
    for (let i = 0; i < 120; i++) blocos.push(tom(inicioDoTom + i * BLOCO));
    rodar(comFuro, blocos);
    const q = apitos()[0].quadro!;
    expect(q).toBeGreaterThanOrEqual(inicioDoTom - BLOCO);
    expect(q).toBeLessThanOrEqual(inicioDoTom + 600);
  });
});
