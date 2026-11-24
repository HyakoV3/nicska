import { describe, expect, it, vi } from "vitest";
import { Apito, DURACAO_AVISO, FOLGA_DEPOIS_DA_VOZ_MS, FREQUENCIA_AVISO, SATURACAO, atrasoDeSaida, curvaDeSaturacao } from "../src/lib/apito";
import { analisar, fracaoDeTom } from "../src/lib/detector";

describe("atrasoDeSaida", () => {
  it("só conta com o contexto rodando e uma latência válida", () => {
    expect(atrasoDeSaida({ state: "running", outputLatency: 0.12 })).toBe(0.12);
    expect(atrasoDeSaida({ state: "suspended", outputLatency: 0.12 })).toBe(0);
    expect(atrasoDeSaida({ state: "running", outputLatency: NaN })).toBe(0);
    expect(atrasoDeSaida({ state: "running", outputLatency: -1 })).toBe(0);
    expect(atrasoDeSaida({ state: "running", outputLatency: undefined as unknown as number })).toBe(0);
  });
});

// Um AudioContext falso, só com o que o Apito usa.
function contextoFalso() {
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
  const fontes: { buffer: unknown; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  const oscs: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; frequency: { value: number }; onended: null | (() => void) }[] = [];
  const ctx = {
    state: "suspended" as string,
    currentTime: 10,
    outputLatency: 0.05,
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
    close: vi.fn(async () => {
      ctx.state = "closed";
    }),
    createOscillator: () => {
      const o = { type: "", frequency: { value: 0 }, start: vi.fn(), stop: vi.fn(), connect: (n: unknown) => n, disconnect: vi.fn(), onended: null as null | (() => void) };
      oscs.push(o);
      return o;
    },
    createGain: () => ({ gain: param(), connect: (n: unknown) => n }),
    decodeAudioData: vi.fn(async (_b: ArrayBuffer) => ({ duration: 0.69 })),
    createBufferSource: () => {
      const f = { buffer: null as unknown, start: vi.fn(), stop: vi.fn(), connect: (n: unknown) => n, disconnect: vi.fn(), onended: null as null | (() => void) };
      fontes.push(f);
      return f;
    },
    createWaveShaper: () => ({ curve: null as Float32Array | null, oversample: "none", connect: (n: unknown) => n }),
  };
  return { ctx: ctx as unknown as AudioContext, oscs, fontes, decodificacoes: ctx.decodeAudioData };
}

describe("Apito", () => {
  it("agenda no relógio do áudio, na frequência pedida, e devolve o instante e a latência de saída", async () => {
    const { ctx, oscs } = contextoFalso();
    const apito = new Apito({ contexto: () => ctx });
    const r = await apito.agendar(2.5, 2800, 0.3);
    expect(r).toEqual({ quando: 12.5, atraso: 0.05 });
    expect(oscs).toHaveLength(1);
    expect(oscs[0].frequency.value).toBe(2800);
    expect(oscs[0].start).toHaveBeenCalledWith(12.5);
    expect(apito.ativo).toBe(true);
  });

  it("cancelar enquanto o áudio ainda iniciava descarta o apito (guarda de geração)", async () => {
    const { ctx, oscs } = contextoFalso();
    const apito = new Apito({ contexto: () => ctx });
    const pendente = apito.agendar(1);
    apito.cancelar();
    expect(await pendente).toBeNull();
    expect(oscs).toHaveLength(0);
  });

  it("cancelar para o apito agendado; fechar devolve o áudio ao aparelho", async () => {
    const { ctx, oscs } = contextoFalso();
    const apito = new Apito({ contexto: () => ctx });
    await apito.agendar(1);
    apito.cancelar();
    expect(oscs[0].stop).toHaveBeenCalled();
    expect(apito.ativo).toBe(false);
    apito.fechar();
    expect((ctx as unknown as { close: ReturnType<typeof vi.fn> }).close).toHaveBeenCalled();
  });

  it("um novo agendamento substitui o anterior", async () => {
    const { ctx, oscs } = contextoFalso();
    const apito = new Apito({ contexto: () => ctx });
    await apito.agendar(1);
    await apito.agendar(2);
    expect(oscs).toHaveLength(2);
    expect(oscs[0].stop).toHaveBeenCalled();
    expect(apito.ativo).toBe(true);
  });
});

describe("voz do Standby", () => {
  const bytes = async () => new ArrayBuffer(8);

  it("fala agora e devolve a duração da voz mais a folga de 300 ms", async () => {
    const { ctx, fontes } = contextoFalso();
    const a = new Apito({ contexto: () => ctx, voz: bytes });
    const ms = await a.falar();
    expect(ms).toBe(690 + FOLGA_DEPOIS_DA_VOZ_MS);
    expect(fontes).toHaveLength(1);
    expect(fontes[0].start).toHaveBeenCalled();
    expect(a.ativo).toBe(false); // a voz não conta como o apito agendado
  });

  it("decodifica uma vez só e reusa nas vezes seguintes", async () => {
    const { ctx, fontes, decodificacoes } = contextoFalso();
    const a = new Apito({ contexto: () => ctx, voz: bytes });
    await a.falar();
    await a.falar();
    expect(decodificacoes).toHaveBeenCalledTimes(1);
    expect(fontes).toHaveLength(2);
  });

  it("se não carregar, devolve 0 e o Standby segue sem voz", async () => {
    const { ctx, fontes } = contextoFalso();
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = new Apito({ contexto: () => ctx, voz: async () => { throw new Error("sem arquivo"); } });
    expect(await a.falar()).toBe(0);
    expect(fontes).toHaveLength(0);
    aviso.mockRestore();
  });

  it("cancelar cala a voz que ainda fala", async () => {
    const { ctx, fontes } = contextoFalso();
    const a = new Apito({ contexto: () => ctx, voz: bytes });
    await a.falar();
    a.cancelar();
    expect(fontes[0].stop).toHaveBeenCalled();
  });
});

describe("bipe de aviso do Standby", () => {
  it("toca já, em 1000 Hz e 0,15 s (longe do apito de 2700 Hz), e devolve a duração em ms", async () => {
    const { ctx, oscs } = contextoFalso();
    const a = new Apito({ contexto: () => ctx });
    const ms = await a.avisar();
    expect(ms).toBe(150);
    expect(FREQUENCIA_AVISO).toBe(1000);
    expect(DURACAO_AVISO).toBe(0.15);
    expect(Math.abs(FREQUENCIA_AVISO - 2700)).toBeGreaterThan(1000);
    expect(oscs).toHaveLength(1);
    expect(oscs[0].frequency.value).toBe(1000);
    expect(oscs[0].start).toHaveBeenCalledWith(10); // agora, não agendado
    expect(a.ativo).toBe(false); // não conta como o apito agendado
  });

  it("o detector não toma o bipe de 1000 Hz pelo apito de 2700 Hz", () => {
    const SR = 48000;
    const x = new Float32Array(SR * 2).map(() => 0.003 * (Math.random() - 0.5));
    for (let i = 0; i < 0.15 * SR; i++) x[SR / 2 + i] += 0.5 * Math.min(1, i / 240) * Math.sin((2 * Math.PI * FREQUENCIA_AVISO * i) / SR);
    expect(analisar(x, SR).apito).toBeNull();
    expect(fracaoDeTom(x, SR / 2, SR / 2 + 0.15 * SR, 2700, SR)).toBeLessThan(0.3);
  });

  it("o bipe de aviso, tocado antes, não atrapalha agendar nem cancelar o apito", async () => {
    const { ctx, oscs } = contextoFalso();
    const a = new Apito({ contexto: () => ctx });
    await a.avisar();
    const r = await a.agendar(1);
    expect(r?.quando).toBe(11);
    expect(oscs).toHaveLength(2);
    a.cancelar();
    expect(oscs[1].stop).toHaveBeenCalled();
  });
});

describe("saturação do apito (mais alto, mesma frequência)", () => {
  const SR = 48000;
  const senoide = (n: number) => Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 2700 * i) / SR));
  const aplicar = (x: Float32Array) => {
    const curva = curvaDeSaturacao();
    return x.map((v) => {
      const pos = ((v + 1) / 2) * (curva.length - 1);
      const i = Math.min(curva.length - 2, Math.max(0, Math.floor(pos)));
      return curva[i] + (curva[i + 1] - curva[i]) * (pos - i);
    });
  };
  const rms = (x: Float32Array) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);

  it("o pico não passa de 1 e o RMS sobe bem acima do da senoide de 0,8 de antes", () => {
    const y = aplicar(senoide(4800));
    expect(Math.max(...y)).toBeLessThanOrEqual(1);
    expect(Math.min(...y)).toBeGreaterThanOrEqual(-1);
    expect(rms(y)).toBeGreaterThan(rms(senoide(4800).map((v) => 0.8 * v)) * 1.5);
    expect(SATURACAO).toBeGreaterThan(1);
  });

  it("a curva é simétrica e passa pela origem", () => {
    const c = curvaDeSaturacao(1025);
    expect(c[512]).toBeCloseTo(0, 6);
    expect(c[0]).toBeCloseTo(-c[1024], 6);
    expect(c[1024]).toBeCloseTo(1, 6);
  });

  it("o detector ainda acha o tom de 2700 Hz saturado (a fundamental segue lá)", () => {
    const y = aplicar(senoide(SR / 50)); // 20 ms
    expect(fracaoDeTom(y, 0, y.length, 2700, SR)).toBeGreaterThan(0.5);
  });

  it("o apito saturado inteiro (0,5 s) é achado como apito, não como disparo, a ±2 ms", () => {
    const x = new Float32Array(SR * 3).map(() => 0.003 * (Math.random() - 0.5));
    const tom = aplicar(senoide(SR / 2));
    for (let i = 0; i < tom.length; i++) x[SR + i] += tom[i] * Math.min(1, i / 96);
    const r = analisar(x, SR);
    expect(r.apito).not.toBeNull();
    expect(Math.abs(r.apito! / SR - 1.0)).toBeLessThanOrEqual(0.002);
    expect(r.disparos).toEqual([]);
  });
});
