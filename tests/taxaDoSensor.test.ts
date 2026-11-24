import { describe, expect, it } from "vitest";
import { MedidorDeTaxa, guardarTaxaDoSensor, intervaloDeclaradoMs, reiniciarTaxaDoSensor, taxaBaixa, ultimaTaxaDoSensor } from "../src/lib/taxaDoSensor";
import { porcentagem } from "../src/lib/trilha";

const alimentar = (m: MedidorDeTaxa, n: number, passoMs: number, t0 = 0, interval?: number) => {
  let r: number | null = null;
  for (let i = 0; i < n; i++) r = m.amostra(t0 + i * passoMs, interval);
  return r;
};

describe("taxa do sensor de movimento", () => {
  it("mede pela diferença de timeStamp", () => {
    expect(alimentar(new MedidorDeTaxa(), 20, 16.67)).toBe(60);
    expect(alimentar(new MedidorDeTaxa(), 20, 20)).toBe(50);
    expect(alimentar(new MedidorDeTaxa(), 20, 100)).toBe(10);
  });
  it("não dá taxa com poucos dados", () => {
    const m = new MedidorDeTaxa();
    expect(alimentar(m, 3, 20)).toBeNull();
  });
  it("usa interval quando existe (ms ou s)", () => {
    expect(intervaloDeclaradoMs(16)).toBe(16);
    expect(intervaloDeclaradoMs(0.016)).toBeCloseTo(16);
    expect(intervaloDeclaradoMs(0)).toBeNull();
    expect(intervaloDeclaradoMs(undefined)).toBeNull();
    expect(intervaloDeclaradoMs(NaN)).toBeNull();
    // timeStamps com jitter, mas o interval do evento manda
    const m = new MedidorDeTaxa();
    let r: number | null = null;
    for (let i = 0; i < 10; i++) r = m.amostra(i * 7, 20);
    expect(r).toBe(50);
  });
  it("a mediana ignora saltos de pausa", () => {
    const m = new MedidorDeTaxa();
    alimentar(m, 15, 20);
    m.amostra(15 * 20 + 5000); // app voltou de segundo plano
    expect(m.taxa()).toBe(50);
    expect(alimentar(m, 10, 20, 15 * 20 + 5000 + 20)).toBe(50);
  });
  it("uma rajada de leituras atrasadas não derruba a taxa", () => {
    const m = new MedidorDeTaxa();
    const r = alimentar(m, 25, 20);
    m.amostra(25 * 20 + 400);
    expect(r).toBe(50);
    expect(m.taxa()).toBe(50);
  });
  it("guarda o último valor e avisa abaixo de 30 Hz", () => {
    reiniciarTaxaDoSensor();
    expect(ultimaTaxaDoSensor()).toBeNull();
    guardarTaxaDoSensor(60);
    guardarTaxaDoSensor(null);
    expect(ultimaTaxaDoSensor()).toBe(60);
    expect(taxaBaixa(29)).toBe(true);
    expect(taxaBaixa(30)).toBe(false);
  });
});

describe("trilha preenchida", () => {
  it("porcentagem do valor entre min e max", () => {
    expect(porcentagem(5, 0, 10)).toBe(50);
    expect(porcentagem(1.5, 1, 2)).toBe(50);
    expect(porcentagem(-3, 0, 10)).toBe(0);
    expect(porcentagem(99, 0, 10)).toBe(100);
    expect(porcentagem(1, 5, 5)).toBe(0);
    expect(porcentagem(NaN, 0, 10)).toBe(0);
  });
});
