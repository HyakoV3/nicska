import { describe, expect, it } from "vitest";
import { analisar, Detector } from "../src/lib/detector";
import { FaseDeEscuta } from "../src/lib/timerFase";
import { apagarDisparo, decimarEnvelope, disparoPerto, edicaoDe, envelopeParaTela, foiEditada, inserirDisparo, instanteNaLinha, janelaDaLinha, posicaoNaLinha, reprocessar } from "../src/lib/revisao";
import { resumir } from "../src/lib/tentativa";

const SR = 48000;
function ruidoFixo(semente = 1) {
  let s = semente;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff - 0.5;
  };
}
/** Apito em `apito` s e tiros nos instantes `tiros` (s). */
function sinal(duracao: number, apito: number | null, tiros: number[]) {
  const x = new Float32Array(Math.round(duracao * SR));
  const r = ruidoFixo(5);
  for (let i = 0; i < x.length; i++) x[i] = 0.004 * r();
  if (apito !== null) for (let i = 0; i < SR / 2; i++) x[Math.round(apito * SR) + i] += 0.5 * Math.min(1, i / 96) * Math.sin((2 * Math.PI * 2700 * i) / SR);
  for (const t of tiros) {
    const rr = ruidoFixo(Math.round(t * 1000));
    for (let i = 0; i < SR && Math.round(t * SR) + i < x.length; i++) x[Math.round(t * SR) + i] += (0.7 * Math.exp(-i / SR / 0.015) + 0.084 * Math.exp(-i / SR / 0.25)) * 2 * rr();
  }
  return x;
}

describe("apagar e inserir disparos", () => {
  const base = edicaoDe([1480, 1730, 1975]);

  it("apagar tira o disparo e conta; o resumo recalcula na hora", () => {
    const e = apagarDisparo(base, 1);
    expect(e.disparosMs).toEqual([1480, 1975]);
    expect(e.apagados).toBe(1);
    expect(foiEditada(e)).toBe(true);
    expect(resumir(e.disparosMs).splits).toEqual([495]);
    expect(foiEditada(base)).toBe(false);
  });

  it("índice inválido não muda nada", () => {
    expect(apagarDisparo(base, -1)).toBe(base);
    expect(apagarDisparo(base, 3)).toBe(base);
    expect(apagarDisparo(base, 0.5)).toBe(base);
  });

  it("inserir mantém a ordem e conta", () => {
    const e = inserirDisparo(base, 1850);
    expect(e.disparosMs).toEqual([1480, 1730, 1850, 1975]);
    expect(e.inseridos).toBe(1);
    expect(inserirDisparo(base, 100).disparosMs[0]).toBe(100);
  });

  it("não insere antes do apito, colado a outro disparo (< 20 ms) nem valor inválido", () => {
    expect(inserirDisparo(base, -5)).toBe(base);
    expect(inserirDisparo(base, 1740)).toBe(base);
    expect(inserirDisparo(base, NaN)).toBe(base);
    expect(inserirDisparo(base, 1750).disparosMs).toHaveLength(4);
  });

  it("apagar e inserir somam em `editada`", () => {
    const e = inserirDisparo(apagarDisparo(apagarDisparo(base, 0), 0), 3000);
    expect(e).toMatchObject({ apagados: 2, inseridos: 1 });
  });
});

describe("reprocessar", () => {
  const x = sinal(8, 1.0, [3.0, 3.25, 3.5, 5.0]);

  it("com os mesmos ajustes dá o mesmo resultado da escuta ao vivo (a mesma análise)", () => {
    const ao_vivo = analisar(x, SR);
    const r = reprocessar({ amostras: x, taxa: SR }, { opcoes: {}, zeroEstimadoS: null })!;
    expect(r.inicio).toBe("detectado");
    expect(r.zeroS).toBeCloseTo(ao_vivo.apito! / SR, 6);
    expect(r.disparosMs).toEqual(ao_vivo.disparos.map((a) => Math.round(((a - ao_vivo.apito!) / SR) * 1000)));
    expect(r.disparosMs).toHaveLength(4);
    expect(Math.abs(r.disparosMs[0] - 2000)).toBeLessThanOrEqual(3);
  });

  it("outros ajustes mudam o resultado: sensibilidade baixa perde o tiro fraco", () => {
    const fraco = sinal(6, 1.0, [3.0]);
    for (let i = Math.round(4.0 * SR); i < Math.round(4.0 * SR) + 4800; i++) fraco[i] += 0.12 * 2 * (((i * 2654435761) >>> 0) / 0xffffffff - 0.5);
    expect(reprocessar({ amostras: fraco, taxa: SR }, { opcoes: { sensibilidade: 0.95 }, zeroEstimadoS: null })!.disparosMs.length).toBeGreaterThan(reprocessar({ amostras: fraco, taxa: SR }, { opcoes: { sensibilidade: 0.2 }, zeroEstimadoS: null })!.disparosMs.length);
  });

  it("sem apito no áudio usa o zero estimado (e marca 'estimado'); sem ele, devolve null", () => {
    const sem = sinal(6, null, [3.0]);
    expect(reprocessar({ amostras: sem, taxa: SR }, { opcoes: {}, zeroEstimadoS: null })).toBeNull();
    const r = reprocessar({ amostras: sem, taxa: SR }, { opcoes: {}, zeroEstimadoS: 1.0 })!;
    expect(r.inicio).toBe("estimado");
    expect(Math.abs(r.disparosMs[0] - 2000)).toBeLessThanOrEqual(3);
  });

  it("disparos antes do apito são descartados", () => {
    const x2 = sinal(8, 2.0, [0.8, 4.0]);
    expect(reprocessar({ amostras: x2, taxa: SR }, { opcoes: {}, zeroEstimadoS: null })!.disparosMs).toHaveLength(1);
  });
});

describe("reprocessar repete o ao vivo (CONS-024)", () => {
  /** Um tom de 2700 Hz espúrio em 0,4 s (voz, timer da baia vizinha) antes do apito verdadeiro em 2,0 s. */
  const x = sinal(8, 2.0, [4.0, 4.3]);
  for (let i = 0; i < SR / 2; i++) x[Math.round(0.4 * SR) + i] += 0.5 * Math.min(1, i / 96) * Math.sin((2 * Math.PI * 2700 * i) / SR);

  /** O ao vivo: o detector em blocos de 128 + a fase de escuta do Timer, com o apito agendado para 2,0 s. */
  function aoVivo(fone: boolean) {
    const d = new Detector(SR, { esperarApito: !fone });
    const fase = new FaseDeEscuta();
    fase.definirApito(2.0, 0);
    let zero: number | null = null;
    const bloco = new Float32Array(128);
    for (let i = 0; i + 128 <= x.length; i += 128) {
      bloco.set(x.subarray(i, i + 128));
      for (const e of d.processar(bloco)) {
        const a = fase.classificar({ tipo: e.tipo, tempo: e.amostra / SR }, zero === null ? "atraso" : "escutando");
        if (a?.acao === "reabrir") d.reabrirApito();
        if (a?.acao === "comecar") zero = a.tempo;
      }
    }
    return zero;
  }

  it("o ao vivo descarta o tom espúrio e o reprocesso atual (sem janela) o aceitaria como apito", () => {
    const vivo = aoVivo(false)!;
    expect(vivo).toBeGreaterThan(1.95);
    expect(analisar(x, SR).apito! / SR).toBeLessThan(1);
  });

  it("com `inicioOriginal: detectado` o reprocesso acha o mesmo apito do ao vivo", () => {
    const vivo = aoVivo(false)!;
    const r = reprocessar({ amostras: x, taxa: SR }, { opcoes: {}, zeroEstimadoS: vivo, inicioOriginal: "detectado" })!;
    expect(r.inicio).toBe("detectado");
    expect(r.zeroS).toBeCloseTo(vivo, 6);
    expect(r.disparosMs).toHaveLength(2);
    expect(Math.abs(r.disparosMs[0] - 2000)).toBeLessThanOrEqual(3);
  });

  it("com `inicioOriginal: estimado` (modo fone) não procura apito: o zero é o da escuta", () => {
    expect(aoVivo(true)).toBeNull();
    const r = reprocessar({ amostras: x, taxa: SR }, { opcoes: {}, zeroEstimadoS: 2.0, inicioOriginal: "estimado" })!;
    expect(r.inicio).toBe("estimado");
    expect(r.zeroS).toBe(2.0);
  });

  it("sem `inicioOriginal` é a análise pura de antes", () => {
    const r = reprocessar({ amostras: x, taxa: SR }, { opcoes: {}, zeroEstimadoS: 2.0 })!;
    expect(r.zeroS).toBeLessThan(1);
  });
});

describe("decimarEnvelope (CONS-048)", () => {
  it("com até o máximo de pontos devolve todos, sem mudar", () => {
    const e = Float32Array.from([0.1, 0.5, 0.2]);
    expect(decimarEnvelope(e, 0, 3, 1000)).toEqual([{ indice: 0, pico: Float32Array.from([0.1])[0] }, { indice: 1, pico: 0.5 }, { indice: 2, pico: Float32Array.from([0.2])[0] }]);
  });
  it("decima em no máximo `maximo` pontos, guardando o pico de cada grupo", () => {
    const e = new Float32Array(36000);
    e[12345] = 0.9;
    const d = decimarEnvelope(e, 0, e.length, 1000);
    expect(d.length).toBeLessThanOrEqual(1000);
    expect(Math.max(...d.map((p) => p.pico))).toBeCloseTo(0.9, 6);
  });
  it("limita o intervalo ao envelope e devolve vazio se não há nada", () => {
    expect(decimarEnvelope(new Float32Array(10), -5, 99, 4).length).toBeLessThanOrEqual(4);
    expect(decimarEnvelope(new Float32Array(10), 8, 3)).toEqual([]);
  });
});

describe("linha do tempo", () => {
  it("o envelope é o pico de cada fatia", () => {
    const e = envelopeParaTela({ amostras: Float32Array.from([0.1, -0.5, 0.2, 0.9, -0.1, 0.05]), taxa: 600 }, 200); // fatias de 3 amostras
    expect(Array.from(e)).toEqual([0.5, 0.8999999761581421 as number].map((v) => Math.fround(v)));
  });

  it("a janela vai de 0,5 s antes do apito até 1,5 s depois do último disparo, limitada ao áudio", () => {
    expect(janelaDaLinha([1480, 2700], 60000)).toEqual({ iniMs: -500, fimMs: 4200 });
    expect(janelaDaLinha([], 60000)).toEqual({ iniMs: -500, fimMs: 3000 });
    expect(janelaDaLinha([9000], 5000).fimMs).toBe(5000);
  });

  it("posição e instante são inversos, e o instante fica dentro da janela", () => {
    const j = { iniMs: -500, fimMs: 4500 };
    expect(posicaoNaLinha(0, j)).toBeCloseTo(0.1, 6);
    expect(instanteNaLinha(0.1, j)).toBe(0);
    expect(instanteNaLinha(-2, j)).toBe(-500);
    expect(instanteNaLinha(5, j)).toBe(4500);
  });

  it("acha o disparo mais perto dentro da tolerância", () => {
    expect(disparoPerto([1000, 1250, 1500], { ms: 1240, toleranciaMs: 40 })).toBe(1);
    expect(disparoPerto([1000, 1250, 1500], { ms: 1100, toleranciaMs: 40 })).toBe(-1);
    expect(disparoPerto([], { ms: 10, toleranciaMs: 40 })).toBe(-1);
  });
});

// Equivalência da refatoração (trilha 8B): a implementação de ANTES (assinatura posicional) como referência; o resultado com as mesmas opções tem de ser idêntico.
describe("equivalência com a implementação anterior", () => {
  const antigoReprocessar = (amostras: ArrayLike<number>, taxa: number, opcoes: Parameters<typeof analisar>[2], zeroEstimadoS: number | null) => {
    const r = analisar(amostras, taxa, opcoes);
    const zeroS = r.apito !== null ? r.apito / taxa : zeroEstimadoS;
    if (zeroS === null) return null;
    const disparosMs = r.disparos.map((a) => Math.round((a / taxa - zeroS) * 1000)).filter((ms) => ms >= 0);
    return { inicio: r.apito !== null ? "detectado" : "estimado", zeroS, disparosMs };
  };
  const antigoEnvelope = (amostras: ArrayLike<number>, taxa: number, pps = 200) => {
    const fatia = Math.max(1, Math.round(taxa / pps));
    const out = new Float32Array(Math.ceil(amostras.length / fatia));
    for (let p = 0; p < out.length; p++) {
      let m = 0;
      for (let i = p * fatia; i < Math.min(amostras.length, (p + 1) * fatia); i++) m = Math.max(m, Math.abs(amostras[i]));
      out[p] = m;
    }
    return out;
  };
  const casos: [string, Float32Array, number | null][] = [
    ["com apito e 4 tiros", sinal(8, 1.0, [3.0, 3.25, 3.5, 5.0]), null],
    ["sem apito, zero estimado", sinal(6, null, [3.0]), 1.0],
    ["sem apito e sem zero", sinal(6, null, [3.0]), null],
    ["tiro antes do apito", sinal(8, 2.0, [0.8, 4.0]), null],
  ];
  for (const [nome, x, zero] of casos) {
    for (const opcoes of [{}, { sensibilidade: 0.95 }, { sensibilidade: 0.2, tempoMortoMs: 120 }]) {
      it(`reprocessar: ${nome} ${JSON.stringify(opcoes)}`, () => {
        expect(reprocessar({ amostras: x, taxa: SR }, { opcoes, zeroEstimadoS: zero })).toEqual(antigoReprocessar(x, SR, opcoes, zero));
      });
    }
    it(`envelopeParaTela: ${nome}`, () => {
      expect(Array.from(envelopeParaTela({ amostras: x, taxa: SR }))).toEqual(Array.from(antigoEnvelope(x, SR)));
      expect(Array.from(envelopeParaTela({ amostras: x, taxa: SR }, 50))).toEqual(Array.from(antigoEnvelope(x, SR, 50)));
    });
  }
  it("reprocessar sem `opcoes` é o mesmo que `{}`", () => {
    const x = sinal(8, 1.0, [3.0, 3.25]);
    expect(reprocessar({ amostras: x, taxa: SR }, { zeroEstimadoS: null })).toEqual(reprocessar({ amostras: x, taxa: SR }, { opcoes: {}, zeroEstimadoS: null }));
  });
  it("disparoPerto: em empate vale o último, como antes", () => {
    expect(disparoPerto([1000, 1100, 1200], { ms: 1050, toleranciaMs: 50 })).toBe(1);
    expect(disparoPerto([1000, 1100], { ms: 1050, toleranciaMs: 50 })).toBe(1);
    expect(disparoPerto([1000, 1100], { ms: 1000, toleranciaMs: 0 })).toBe(0);
  });
});
