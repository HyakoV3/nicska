import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ouvirBatidas } from "../src/lib/ouvirBatidas";

// Ambiente falso: window/document (eventos), navigator.wakeLock. Cobre CONS-019: a trava é solta ao esgotar e pedida de novo ao voltar.
class Alvo extends EventTarget {
  hidden = false;
}
class Trava extends EventTarget {
  liberada = false;
  release() {
    this.liberada = true;
    this.dispatchEvent(new Event("release"));
    return Promise.resolve();
  }
}
let doc: Alvo;
let janela: Alvo;
let travas: Trava[];
let request: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  doc = new Alvo();
  janela = new Alvo();
  travas = [];
  request = vi.fn(() => {
    const t = new Trava();
    travas.push(t);
    return Promise.resolve(t);
  });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", janela);
  vi.stubGlobal("navigator", { wakeLock: { request } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const visibilidade = (escondido: boolean) => {
  doc.hidden = escondido;
  doc.dispatchEvent(new Event("visibilitychange"));
};

describe("trava de tela das batidas", () => {
  it("pede a trava ao ligar e solta ao desligar", async () => {
    const desligar = ouvirBatidas(2, () => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(1);
    desligar();
    expect(travas[0].liberada).toBe(true);
  });

  it("ao esgotar o tempo solta a trava e chama aoEsgotar", async () => {
    const aoEsgotar = vi.fn();
    ouvirBatidas(2, () => {}, { esgotarEm: 1000, aoEsgotar });
    await vi.advanceTimersByTimeAsync(0);
    expect(travas[0].liberada).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(aoEsgotar).toHaveBeenCalledTimes(1);
    expect(travas[0].liberada).toBe(true);
    visibilidade(false); // depois de esgotar, voltar à aba não pede a trava de novo
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("ao voltar ao primeiro plano pede a trava de novo (o sistema a derrubou)", async () => {
    const desligar = ouvirBatidas(2, () => {});
    await vi.advanceTimersByTimeAsync(0);
    visibilidade(true);
    travas[0].release(); // o sistema derruba a trava ao esconder
    visibilidade(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(2);
    desligar();
    expect(travas[1].liberada).toBe(true);
  });

  it("trava que chega depois do desligar é solta na hora", async () => {
    let entrega!: (t: Trava) => void;
    request.mockImplementationOnce(() => new Promise<Trava>((r) => (entrega = r)));
    const desligar = ouvirBatidas(2, () => {});
    desligar();
    const t = new Trava();
    entrega(t);
    await vi.advanceTimersByTimeAsync(0);
    expect(t.liberada).toBe(true);
  });

  it("sem wakeLock no aparelho não quebra", () => {
    vi.stubGlobal("navigator", {});
    expect(() => ouvirBatidas(2, () => {})()).not.toThrow();
  });

  it("avisa que não há sensor depois de 2 s sem dados", async () => {
    const aoSensor = vi.fn();
    const desligar = ouvirBatidas(2, () => {}, { aoSensor });
    await vi.advanceTimersByTimeAsync(2000);
    expect(aoSensor).toHaveBeenCalledWith("sem");
    desligar();
  });
});

describe("taxa do sensor na escuta", () => {
  it("mede a taxa dos eventos devicemotion e a entrega a aoTaxa", () => {
    const aoTaxa = vi.fn();
    const desligar = ouvirBatidas(2, () => {}, { aoTaxa });
    for (let i = 0; i < 10; i++) {
      const e = new Event("devicemotion");
      Object.defineProperties(e, { timeStamp: { value: i * 20 }, accelerationIncludingGravity: { value: { x: 0, y: 0, z: 9.8 } } });
      janela.dispatchEvent(e);
    }
    expect(aoTaxa).toHaveBeenLastCalledWith(50);
    desligar();
  });
});
