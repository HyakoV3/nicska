import { describe, expect, it } from "vitest";
import { deslocamentoDoVideoMs, disparoNoVideoS, instanteNoVideoS } from "../src/lib/video/alinhamento";

// A conversão entre a linha do tempo do áudio (onde o detector acha o apito e os disparos) e a do vídeo, que começa depois (a câmera abre depois do microfone).

describe("alinhamento áudio → vídeo", () => {
  it("o vídeo que começou 400 ms depois do áudio: 2,0 s no áudio é 1,6 s no vídeo", () => {
    expect(instanteNoVideoS(2, 400)).toBeCloseTo(1.6, 9);
  });
  it("sem deslocamento (metas antigas) os instantes coincidem", () => {
    expect(instanteNoVideoS(3.25)).toBe(3.25);
    expect(instanteNoVideoS(3.25, 0)).toBe(3.25);
  });
  it("um instante de antes do vídeo começar fica no começo dele; valores inválidos também", () => {
    expect(instanteNoVideoS(0.1, 400)).toBe(0);
    expect(instanteNoVideoS(Number.NaN, 400)).toBe(0);
  });
  it("disparo (ms desde o apito) → instante no vídeo: zero no áudio + disparo − deslocamento", () => {
    const e = { zeroNoAudioS: 4.5, inicioDoVideoMs: 1200 };
    expect(disparoNoVideoS(e, 0)).toBeCloseTo(3.3, 9); // o próprio apito
    expect(disparoNoVideoS(e, 1850)).toBeCloseTo(5.15, 9);
  });
  it("o deslocamento guardado: arredondado, nunca negativo, 0 sem o início do áudio", () => {
    expect(deslocamentoDoVideoMs(1000, 1350.6)).toBe(351);
    expect(deslocamentoDoVideoMs(1000, 900)).toBe(0);
    expect(deslocamentoDoVideoMs(undefined, 1350)).toBe(0);
    expect(deslocamentoDoVideoMs(Number.NaN, 1350)).toBe(0);
  });
});
