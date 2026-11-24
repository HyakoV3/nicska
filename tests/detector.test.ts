import { describe, expect, it } from "vitest";
import { Detector, analisar, detectarApito, detectarDisparos, fracaoDeTom, pisoDeNivel, temposEmMs } from "../src/lib/detector";

const SR = 48000;
const amostras = (s: number) => Math.round(s * SR);

// Gerador pseudoaleatório fixo (os testes não podem variar entre execuções).
function ruidoFixo(semente = 1) {
  let s = semente;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff - 0.5;
  };
}

type Som = { t: number; tipo: "tiro" | "apito"; nivel?: number };

/** Sinal sintético: ruído de fundo, tiros (estouro de ruído que sobe de uma vez e decai com cauda) e apito (tom). */
function sinal(duracao: number, sons: Som[], fundo = 0.002, hz = 2700) {
  const x = new Float32Array(amostras(duracao));
  const r = ruidoFixo(7);
  for (let i = 0; i < x.length; i++) x[i] = fundo * 2 * r();
  for (const s of sons) {
    const ini = amostras(s.t);
    const nivel = s.nivel ?? 0.7;
    if (s.tipo === "tiro") {
      const rr = ruidoFixo(Math.round(s.t * 1000) + 3);
      for (let i = 0; i < amostras(1.0) && ini + i < x.length; i++) {
        const t = i / SR;
        // estouro (decai em ~15 ms) + cauda de eco (decai em ~250 ms, bem mais baixa)
        const env = nivel * Math.exp(-t / 0.015) + 0.12 * nivel * Math.exp(-t / 0.25);
        x[ini + i] += env * 2 * rr();
      }
    } else {
      for (let i = 0; i < amostras(0.5) && ini + i < x.length; i++) {
        const rampa = Math.min(1, i / amostras(0.002));
        x[ini + i] += nivel * rampa * Math.sin((2 * Math.PI * hz * i) / SR);
      }
    }
  }
  return x;
}

const emSeg = (a: number) => a / SR;

describe("fracaoDeTom", () => {
  it("tom puro dá perto de 1; ruído, perto de 0", () => {
    const n = amostras(0.02);
    const tom = Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 2700 * i) / SR));
    expect(fracaoDeTom(tom, 0, n, 2700, SR)).toBeGreaterThan(0.8);
    const r = ruidoFixo(3);
    const ruido = Float32Array.from({ length: n }, () => r());
    expect(fracaoDeTom(ruido, 0, n, 2700, SR)).toBeLessThan(0.1);
    expect(fracaoDeTom(new Float32Array(n), 0, n, 2700, SR)).toBe(0);
  });
});

describe("detectarDisparos", () => {
  it("cada disparo a ±1 ms do instante real", () => {
    const reais = [1.0, 1.5, 2.1, 3.0];
    const x = sinal(5, reais.map((t) => ({ t, tipo: "tiro" })));
    const d = detectarDisparos(x, SR);
    expect(d).toHaveLength(reais.length);
    d.forEach((a, k) => expect(Math.abs(emSeg(a) - reais[k])).toBeLessThanOrEqual(0.001));
  });

  it("dois disparos a 100 ms contam como dois", () => {
    const x = sinal(3, [{ t: 1.0, tipo: "tiro" }, { t: 1.1, tipo: "tiro" }]);
    expect(detectarDisparos(x, SR)).toHaveLength(2);
  });

  it("splits rápidos de 120 ms sobre a cauda do tiro anterior contam todos", () => {
    const reais = [1.0, 1.12, 1.24, 1.36, 1.48, 1.6];
    const x = sinal(4, reais.map((t) => ({ t, tipo: "tiro" })));
    expect(detectarDisparos(x, SR)).toHaveLength(6);
  });

  it("o eco 30 ms depois (mais baixo) não conta", () => {
    const x = sinal(3, [{ t: 1.0, tipo: "tiro" }, { t: 1.03, tipo: "tiro", nivel: 0.25 }]);
    expect(detectarDisparos(x, SR)).toHaveLength(1);
  });

  it("a cauda longa e o ruído dentro dela não viram disparos", () => {
    const x = sinal(4, [{ t: 1.0, tipo: "tiro", nivel: 0.9 }]);
    expect(detectarDisparos(x, SR)).toHaveLength(1);
  });

  it("ruído de fundo constante sem tiros: nenhum disparo", () => {
    const x = sinal(5, [], 0.02);
    expect(detectarDisparos(x, SR)).toEqual([]);
  });

  it("tiro com ruído de fundo forte (0,03) ainda é achado", () => {
    const x = sinal(4, [{ t: 1.0, tipo: "tiro" }, { t: 2.0, tipo: "tiro" }], 0.03);
    expect(detectarDisparos(x, SR)).toHaveLength(2);
  });

  it("a sensibilidade muda o piso: tiro fraco só conta com sensibilidade alta", () => {
    const x = sinal(3, [{ t: 1.0, tipo: "tiro", nivel: 0.06 }]);
    expect(detectarDisparos(x, SR, { sensibilidade: 0.2 })).toHaveLength(0);
    expect(detectarDisparos(x, SR, { sensibilidade: 0.95 })).toHaveLength(1);
    expect(pisoDeNivel(0.6)).toBeCloseTo(0.05, 5);
    expect(pisoDeNivel(NaN)).toBeCloseTo(0.05, 5);
  });
});

describe("detectarApito", () => {
  it("acha o início do apito a ±2 ms, com e sem ruído", () => {
    for (const fundo of [0.002, 0.03]) {
      const x = sinal(3, [{ t: 1.0, tipo: "apito", nivel: 0.5 }], fundo);
      const a = detectarApito(x, SR);
      expect(a, `fundo ${fundo}`).not.toBeNull();
      expect(Math.abs(emSeg(a!) - 1.0)).toBeLessThanOrEqual(0.002);
    }
  });

  it("apito fraco, que sobe devagar, é achado pelo tom", () => {
    const x = sinal(3, [{ t: 1.0, tipo: "apito", nivel: 0.03 }]);
    const a = detectarApito(x, SR, { sensibilidade: 0.1 });
    expect(a).not.toBeNull();
    expect(Math.abs(emSeg(a!) - 1.0)).toBeLessThanOrEqual(0.01);
  });

  it("o apito não conta como disparo, e o tiro não conta como apito", () => {
    const x = sinal(5, [{ t: 1.0, tipo: "apito", nivel: 0.5 }, { t: 2.5, tipo: "tiro" }, { t: 3.2, tipo: "tiro" }]);
    const r = analisar(x, SR);
    expect(r.apito).not.toBeNull();
    expect(r.disparos).toHaveLength(2);
    expect(Math.abs(emSeg(r.disparos[0]) - 2.5)).toBeLessThanOrEqual(0.001);
  });

  it("apito ausente: devolve null", () => {
    const x = sinal(3, [{ t: 1.0, tipo: "tiro" }]);
    expect(detectarApito(x, SR)).toBeNull();
  });

  it("outro tom (1000 Hz) não é o apito", () => {
    const x = sinal(3, [{ t: 1.0, tipo: "apito", nivel: 0.5 }], 0.002, 1000);
    expect(detectarApito(x, SR)).toBeNull();
  });
});

describe("Detector incremental e tempos", () => {
  it("em blocos de qualquer tamanho dá o mesmo que de uma vez", () => {
    const x = sinal(5, [{ t: 1.0, tipo: "apito", nivel: 0.5 }, { t: 2.2, tipo: "tiro" }, { t: 2.5, tipo: "tiro" }]);
    const inteiro = analisar(x, SR);
    const d = new Detector(SR);
    const ev = [];
    for (let i = 0; i < x.length; ) {
      const t = 1 + ((i * 7) % 300);
      ev.push(...d.processar(x.subarray(i, i + t)));
      i += t;
    }
    expect(ev.filter((e) => e.tipo === "disparo").map((e) => e.amostra)).toEqual(inteiro.disparos);
    expect(ev.find((e) => e.tipo === "apito")?.amostra).toBe(inteiro.apito);
    expect(d.amostrasVistas).toBe(x.length);
  });

  it("temposEmMs: ms desde o apito, com início detectado", () => {
    const x = sinal(5, [{ t: 1.0, tipo: "apito", nivel: 0.5 }, { t: 2.5, tipo: "tiro" }, { t: 2.75, tipo: "tiro" }]);
    const t = temposEmMs(analisar(x, SR), SR)!;
    expect(t.inicio).toBe("detectado");
    expect(Math.abs(t.disparos_ms[0] - 1500)).toBeLessThanOrEqual(3);
    expect(Math.abs(t.disparos_ms[1] - 1750)).toBeLessThanOrEqual(3);
  });

  it("sem apito usa o instante estimado e marca 'estimado'; sem nada, null", () => {
    const x = sinal(4, [{ t: 2.0, tipo: "tiro" }]);
    const r = analisar(x, SR);
    expect(temposEmMs(r, SR)).toBeNull();
    const t = temposEmMs(r, SR, amostras(1.0))!;
    expect(t.inicio).toBe("estimado");
    expect(Math.abs(t.disparos_ms[0] - 1000)).toBeLessThanOrEqual(2);
  });
});

describe("reabrirApito", () => {
  const SR = 48000;
  const tom = (inicioS: number, durS: number, total: number) => {
    const x = new Float32Array(total);
    for (let i = Math.round(inicioS * SR); i < Math.round((inicioS + durS) * SR); i++) x[i] = 0.5 * Math.sin((2 * Math.PI * 2700 * i) / SR);
    return x;
  };
  const apitos = (d: Detector, x: Float32Array) => {
    const achados: number[] = [];
    for (let i = 0; i < x.length; i += 128) for (const e of d.processar(x.subarray(i, i + 128))) if (e.tipo === "apito") achados.push(e.amostra);
    return achados;
  };

  it("sem reabrir, o detector só diz apito uma vez; reabrindo, acha o seguinte", () => {
    const x = new Float32Array(SR * 4);
    x.set(tom(0.5, 0.5, x.length).subarray(0, x.length));
    const segundo = tom(2.5, 0.5, x.length);
    for (let i = 0; i < x.length; i++) x[i] += segundo[i];

    const sem = new Detector(SR);
    expect(apitos(sem, x)).toHaveLength(1);

    const com = new Detector(SR);
    const achados: number[] = [];
    for (let i = 0; i < x.length; i += 128) {
      for (const e of com.processar(x.subarray(i, i + 128))) if (e.tipo === "apito") {
        achados.push(e.amostra);
        if (e.amostra / SR < 2) com.reabrirApito(); // como o timer: o que está fora da janela é descartado e a procura recomeça
      }
    }
    expect(achados.length).toBeGreaterThanOrEqual(2);
    expect(achados.length).toBeLessThanOrEqual(2); // o tom que já tocava não é reportado de novo a cada janela
    expect(Math.abs(achados.at(-1)! / SR - 2.5)).toBeLessThan(0.02); // o segundo tom, achado no lugar certo
  });
});
