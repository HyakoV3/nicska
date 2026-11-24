import { describe, expect, it } from "vitest";
import { BATIDAS, DetectorDeBatidas, magnitude } from "../src/lib/batidas";

const G = 9.81;
/** Amostras a 60 Hz de uma parada com ruído pequeno e batidas (picos de 1 amostra) nos instantes dados. Devolve em que instante o detector disparou (ou null). */
function rodar(alvo: 1 | 2 | 3, batidasEm: number[], opcoes: { ate?: number; ruido?: number; pico?: number } = {}): number | null {
  const d = new DetectorDeBatidas(alvo);
  const ate = opcoes.ate ?? Math.max(0, ...batidasEm) + 1500;
  const passo = 1000 / 60;
  let disparou: number | null = null;
  for (let t = 0; t <= ate; t += passo) {
    const bate = batidasEm.some((b) => t >= b && t < b + passo);
    const ruido = (opcoes.ruido ?? 0.15) * Math.sin(t / 37);
    if (d.amostra(t, G + ruido + (bate ? (opcoes.pico ?? 15) : 0)) && disparou === null) disparou = t;
  }
  return disparou;
}

describe("batidas: o padrão certo dispara", () => {
  it("2 batidas a 250 ms: dispara depois do silêncio", () => {
    const t = rodar(2, [1000, 1250]);
    expect(t).not.toBeNull();
    expect(t!).toBeGreaterThanOrEqual(1250 + BATIDAS.silencioMs);
    expect(t!).toBeLessThan(1250 + BATIDAS.silencioMs + 60);
  });
  it("3 batidas a 200 ms", () => {
    expect(rodar(3, [1000, 1200, 1400])).not.toBeNull();
  });
  it("uma batida mais fraca, mas acima do limiar, ainda conta", () => {
    expect(rodar(2, [500, 800], { pico: BATIDAS.limiar + 2 })).not.toBeNull();
  });
});

describe("batidas: uma só (cancelar)", () => {
  it("uma batida dispara depois do silêncio; duas não", () => {
    expect(rodar(1, [1000])).not.toBeNull();
    expect(rodar(1, [1000, 1250])).toBeNull();
  });
});

describe("batidas: o que não deve disparar", () => {
  it("uma batida só", () => expect(rodar(2, [1000])).toBeNull());
  it("2 batidas quando o padrão é 3, e 3 quando o padrão é 2", () => {
    expect(rodar(3, [1000, 1250])).toBeNull();
    expect(rodar(2, [1000, 1250, 1500])).toBeNull();
  });
  it("mais batidas do que o padrão não dispara nem depois, no meio da sequência errada", () => {
    expect(rodar(2, [1000, 1250, 1500, 1750, 2000])).toBeNull();
  });
  it("batidas muito espaçadas (mais de 1 s) não formam o padrão", () => expect(rodar(2, [1000, 2100])).toBeNull());
  it("duas batidas coladas (eco, menos de 90 ms) contam como uma", () => expect(rodar(2, [1000, 1050])).toBeNull());
  it("ruído de caminhada (picos de 4 m/s²) não conta", () => {
    expect(rodar(2, [1000, 1500, 2000, 2500], { pico: 4 })).toBeNull();
  });
  it("aparelho parado, com ou sem ruído, nunca dispara", () => {
    expect(rodar(2, [], { ate: 5000 })).toBeNull();
    expect(rodar(3, [], { ate: 5000, ruido: 0.8 })).toBeNull();
  });
  it("virar o aparelho (a gravidade muda de eixo, a magnitude não) não é batida", () => {
    const d = new DetectorDeBatidas(2);
    for (let t = 0; t < 3000; t += 16) expect(d.amostra(t, Math.hypot(G * Math.cos(t / 400), G * Math.sin(t / 400), 0))).toBe(false);
  });
});

describe("batidas: recomeçar e depois de disparar", () => {
  it("uma batida perdida no começo e depois o padrão certo ainda dispara", () => {
    expect(rodar(2, [500, 1800, 2050])).not.toBeNull();
  });
  it("depois de disparar, outro padrão dispara de novo", () => {
    const d = new DetectorDeBatidas(2);
    let disparos = 0;
    for (let t = 0; t < 6000; t += 1000 / 60) {
      const bate = [1000, 1250, 4000, 4250].some((b) => t >= b && t < b + 16.7);
      if (d.amostra(t, G + (bate ? 15 : 0))) disparos++;
    }
    expect(disparos).toBe(2);
  });
  it("o silêncio também confirma pelo temporizador, sem amostra nova", () => {
    const d = new DetectorDeBatidas(2);
    for (let t = 0; t < 1400; t += 16.7) d.amostra(t, G + ([1000, 1250].some((b) => t >= b && t < b + 16.7) ? 15 : 0));
    expect(d.contadas).toBe(2);
    expect(d.tempo(1300)).toBe(false);
    expect(d.tempo(1250 + BATIDAS.silencioMs + 20)).toBe(true);
  });
  it("amostras inválidas ou fora de ordem são ignoradas", () => {
    const d = new DetectorDeBatidas(2);
    expect(d.amostra(100, NaN)).toBe(false);
    expect(d.amostra(NaN, 9)).toBe(false);
    expect(d.amostra(200, 9.8)).toBe(false);
    expect(d.amostra(100, 30)).toBe(false);
    expect(d.contadas).toBe(0);
  });
});

describe("magnitude", () => {
  it("é a norma do vetor; sem os três eixos não há valor", () => {
    expect(magnitude({ x: 3, y: 4, z: 0 })).toBe(5);
    expect(magnitude({ x: 1, y: null, z: 0 })).toBeNull();
    expect(magnitude(null)).toBeNull();
  });
});
