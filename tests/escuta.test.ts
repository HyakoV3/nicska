import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Escuta } from "../src/lib/escuta";

// A escuta com o navegador falso: AudioContext, getUserMedia, AudioWorkletNode e MediaRecorder são fakes controláveis. O áudio real fica no e2e.

function adiavel<T>() {
  let ok!: (v: T) => void;
  let falha!: (e: unknown) => void;
  const promessa = new Promise<T>((a, b) => ((ok = a), (falha = b)));
  return { promessa, ok, falha };
}

class Trilha {
  parada = false;
  ouvintes: Record<string, (() => void)[]> = {};
  settings: Record<string, unknown> = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  getSettings() {
    return this.settings;
  }
  addEventListener(n: string, f: () => void) {
    (this.ouvintes[n] ??= []).push(f);
  }
  emitir(n: string) {
    this.ouvintes[n]?.forEach((f) => f());
  }
  stop() {
    this.parada = true;
  }
}
class Fluxo {
  trilha = new Trilha();
  getAudioTracks() {
    return [this.trilha];
  }
  getTracks() {
    return [this.trilha];
  }
}

const contextos: Contexto[] = [];
let modulo = adiavel<void>();
class Contexto {
  state = "suspended";
  sampleRate = 48000;
  currentTime = 1.5;
  onstatechange: (() => void) | null = null;
  destination = {};
  fechado = false;
  audioWorklet = { addModule: vi.fn(() => modulo.promessa) };
  constructor() {
    contextos.push(this);
  }
  resume() {
    if (this.fechado) return Promise.reject(new Error("fechado"));
    this.state = "running";
    return Promise.resolve();
  }
  close() {
    this.fechado = true;
    this.state = "closed";
    return Promise.resolve();
  }
  createGain() {
    return { gain: { value: 1 }, connect: (x: unknown) => x };
  }
  createMediaStreamSource() {
    return { connect: (no: { connect: (x: unknown) => unknown }) => no };
  }
}

const nos: No[] = [];
class No {
  mensagens: unknown[] = [];
  desconectado = false;
  port = { onmessage: null as ((e: { data: unknown }) => void) | null, postMessage: (m: unknown) => this.mensagens.push(m) };
  constructor() {
    nos.push(this);
  }
  connect(x: unknown) {
    return { connect: () => x };
  }
  disconnect() {
    this.desconectado = true;
  }
}

const gravadores: Gravador[] = [];
class Gravador {
  static isTypeSupported = () => true;
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;
  travar = false;
  constructor() {
    gravadores.push(this);
  }
  start() {
    this.state = "recording";
    this.ondataavailable?.({ data: new Blob(["abc"]) });
  }
  stop() {
    this.state = "inactive";
    if (!this.travar) queueMicrotask(() => this.onstop?.());
  }
}

let fluxos: Fluxo[] = [];
let pedido = adiavel<Fluxo>();
const getUserMedia = vi.fn(() => pedido.promessa);

beforeEach(() => {
  contextos.length = 0;
  nos.length = 0;
  gravadores.length = 0;
  fluxos = [];
  modulo = adiavel<void>();
  modulo.ok();
  pedido = adiavel<Fluxo>();
  getUserMedia.mockClear();
  vi.stubGlobal("AudioContext", Contexto);
  vi.stubGlobal("AudioWorkletNode", No);
  vi.stubGlobal("MediaRecorder", Gravador);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
});
afterEach(() => vi.unstubAllGlobals());

const novoFluxo = () => {
  const f = new Fluxo();
  fluxos.push(f);
  return f;
};
const aguardar = () => new Promise((r) => setTimeout(r, 0));

describe("iniciar", () => {
  it("abre o microfone cru, liga o detector e a gravação", async () => {
    const e = new Escuta();
    const p = e.iniciar({ sensibilidade: 0.5 });
    pedido.ok(novoFluxo());
    await p;
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    expect(e.ativa).toBe(true);
    expect(e.taxa).toBe(48000);
    expect(e.contexto).toBe(contextos[0]);
    expect(e.filtrosDesligados).toBe(true);
    expect(gravadores[0].state).toBe("recording");
  });

  it("filtros ligados ou desconhecidos", async () => {
    const e = new Escuta();
    const f = novoFluxo();
    f.trilha.settings = { echoCancellation: true, noiseSuppression: false, autoGainControl: false };
    pedido.ok(f);
    await e.iniciar();
    expect(e.filtrosDesligados).toBe(false);
    e.soltar();
    pedido = adiavel<Fluxo>();
    const g = novoFluxo();
    g.trilha.settings = {};
    pedido.ok(g);
    await e.iniciar();
    expect(e.filtrosDesligados).toBeNull();
  });

  it("entrega eventos e envelope do worklet, com o tempo no relógio do contexto", async () => {
    const e = new Escuta();
    const eventos: unknown[] = [];
    const picos: number[][] = [];
    e.aoEvento = (x) => eventos.push(x);
    e.aoEnvelope = (p) => picos.push(p);
    pedido.ok(novoFluxo());
    await e.iniciar();
    nos[0].port.onmessage!({ data: { t: "evento", tipo: "disparo", quadro: 96000 } });
    nos[0].port.onmessage!({ data: { t: "envelope", picos: [0.1, 0.2] } });
    expect(eventos).toEqual([{ tipo: "disparo", quadro: 96000, tempo: 2 }]);
    expect(picos).toEqual([[0.1, 0.2]]);
  });

  it("só liga o envelope no worklet se alguém o consome (CONS-048)", async () => {
    const e = new Escuta();
    pedido.ok(novoFluxo());
    await e.iniciar();
    expect(nos[0].mensagens).not.toContainEqual(expect.objectContaining({ t: "envelope" }));
    e.aoEnvelope = () => {};
    expect(nos[0].mensagens).toContainEqual({ t: "envelope", ligado: true });
    e.aoEnvelope = null;
    expect(nos[0].mensagens).toContainEqual({ t: "envelope", ligado: false });
  });

  it("aoEnvelope definido antes de iniciar liga o envelope assim que o nó existe", async () => {
    const e = new Escuta();
    e.aoEnvelope = () => {};
    pedido.ok(novoFluxo());
    await e.iniciar();
    expect(nos[0].mensagens).toContainEqual({ t: "envelope", ligado: true });
  });

  it("segunda chamada com a escuta ativa não faz nada", async () => {
    const e = new Escuta();
    pedido.ok(novoFluxo());
    await e.iniciar();
    await e.iniciar();
    expect(contextos).toHaveLength(1);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("sem getUserMedia: NotSupportedError", async () => {
    vi.stubGlobal("navigator", {});
    await expect(new Escuta().iniciar()).rejects.toMatchObject({ name: "NotSupportedError" });
    expect(contextos).toHaveLength(0);
  });

  it("sem MediaRecorder: escuta ativa, sem áudio", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    const e = new Escuta();
    pedido.ok(novoFluxo());
    await e.iniciar();
    expect(e.ativa).toBe(true);
    expect(await e.parar()).toBeNull();
  });
});

describe("erro de permissão", () => {
  it("negada: propaga o erro e deixa tudo solto", async () => {
    const e = new Escuta();
    const p = e.iniciar();
    pedido.falha(new DOMException("negado", "NotAllowedError"));
    await expect(p).rejects.toMatchObject({ name: "NotAllowedError" });
    expect(e.ativa).toBe(false);
    expect(e.contexto).toBeNull();
    expect(contextos[0].fechado).toBe(true);
  });

  it("falha ao carregar o worklet também solta o contexto", async () => {
    modulo = adiavel<void>();
    const e = new Escuta();
    const p = e.iniciar();
    modulo.falha(new Error("sem módulo"));
    await expect(p).rejects.toThrow("sem módulo");
    expect(contextos[0].fechado).toBe(true);
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});

describe("parar", () => {
  it("entrega o áudio da tentativa e devolve o microfone", async () => {
    const e = new Escuta();
    pedido.ok(novoFluxo());
    await e.iniciar();
    const t = await e.parar();
    expect(t).not.toBeNull();
    expect(t!.tipo).toBe("audio/webm");
    expect(t!.blob.size).toBe(3);
    expect(t!.inicioCtx).toBe(1.5);
    expect(t!.segundos).toBeGreaterThanOrEqual(0);
    expect(e.ativa).toBe(false);
    expect(fluxos[0].trilha.parada).toBe(true);
    expect(contextos[0].fechado).toBe(true);
    expect(nos[0].mensagens).toContainEqual({ t: "parar" });
    expect(nos[0].desconectado).toBe(true);
  });

  it("gravador que nunca avisa o fim: sai pelo limite de 4 s", async () => {
    vi.useFakeTimers();
    try {
      const e = new Escuta();
      pedido.ok(novoFluxo());
      await e.iniciar();
      gravadores[0].travar = true;
      const p = e.parar();
      await vi.advanceTimersByTimeAsync(4000);
      expect((await p)?.blob.size).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sem nada gravado devolve nulo", async () => {
    vi.spyOn(Gravador.prototype, "start").mockImplementation(function (this: Gravador) {
      this.state = "recording";
    });
    const e = new Escuta();
    pedido.ok(novoFluxo());
    await e.iniciar();
    expect(await e.parar()).toBeNull();
    vi.restoreAllMocks();
  });

  it("sem escuta iniciada não quebra", async () => {
    expect(await new Escuta().parar()).toBeNull();
  });
});

describe("cancelar (soltar) e interrupção", () => {
  it("soltar depois de iniciar libera tudo e é idempotente", async () => {
    const e = new Escuta();
    pedido.ok(novoFluxo());
    await e.iniciar();
    e.soltar();
    e.soltar();
    expect(e.ativa).toBe(false);
    expect(e.contexto).toBeNull();
    expect(fluxos[0].trilha.parada).toBe(true);
    expect(contextos[0].fechado).toBe(true);
    expect(nos[0].port.onmessage).toBeNull();
  });

  it("depois de soltar, a escuta pode iniciar de novo", async () => {
    const e = new Escuta();
    pedido.ok(novoFluxo());
    await e.iniciar();
    e.soltar();
    pedido = adiavel<Fluxo>();
    pedido.ok(novoFluxo());
    await e.iniciar();
    expect(e.ativa).toBe(true);
    expect(contextos).toHaveLength(2);
  });

  it("trilha que termina ou contexto que sai de running avisam aoInterromper", async () => {
    const e = new Escuta();
    const aviso = vi.fn();
    e.aoInterromper = aviso;
    const f = novoFluxo();
    pedido.ok(f);
    await e.iniciar();
    f.trilha.emitir("ended");
    expect(aviso).toHaveBeenCalledTimes(1);
    contextos[0].state = "interrupted";
    contextos[0].onstatechange!();
    expect(aviso).toHaveBeenCalledTimes(2);
  });

  it("depois de soltar, mudança de estado do contexto antigo não avisa", async () => {
    const e = new Escuta();
    const aviso = vi.fn();
    e.aoInterromper = aviso;
    pedido.ok(novoFluxo());
    await e.iniciar();
    const ctx = contextos[0];
    e.soltar();
    expect(ctx.onstatechange).toBeNull();
    expect(aviso).not.toHaveBeenCalled();
  });

  it("reabrirApito manda a mensagem ao worklet (e é inócuo sem escuta)", async () => {
    const e = new Escuta();
    e.reabrirApito();
    pedido.ok(novoFluxo());
    await e.iniciar();
    e.reabrirApito();
    expect(nos[0].mensagens).toContainEqual({ t: "reabrir-apito" });
  });
});

describe("corrida cancelar durante iniciar", () => {
  it("cancelar com a permissão pendente: o iniciar antigo termina sem ativar a escuta", async () => {
    const e = new Escuta();
    const p = e.iniciar();
    await aguardar();
    e.soltar();
    const f = novoFluxo();
    pedido.ok(f);
    await p.catch(() => {});
    expect(e.ativa).toBe(false);
    expect(e.contexto).toBeNull();
    // o microfone que chegou tarde não pode ficar aberto
    expect(f.trilha.parada).toBe(true);
  });

  // CONS-022 / 07·MOT-001: o iniciar antigo, ao retomar, não pode soltar a escuta NOVA (corrigido com a geração em `Escuta`).
  it("cancelar e iniciar de novo enquanto o primeiro pedido pende: a tentativa nova sobrevive", async () => {
    const e = new Escuta();
    const p1 = e.iniciar();
    p1.catch(() => {});
    await aguardar();
    e.soltar();
    const pedido1 = pedido;
    pedido = adiavel<Fluxo>();
    const p2 = e.iniciar();
    await aguardar();
    const f1 = novoFluxo();
    const f2 = novoFluxo();
    pedido1.ok(f1);
    await aguardar();
    pedido.ok(f2);
    await p1.catch(() => {});
    await p2;
    expect(e.ativa).toBe(true);
    expect(e.contexto).toBe(contextos[1]);
    expect(contextos[1].fechado).toBe(false);
    expect(f2.trilha.parada).toBe(false);
    expect(f1.trilha.parada).toBe(true);
  });
  it("o iniciar cancelado termina com AbortError (e não com um erro espúrio de contexto fechado)", async () => {
    const e = new Escuta();
    const p = e.iniciar();
    await aguardar();
    e.soltar();
    pedido.ok(novoFluxo());
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });

  it("cancelar enquanto o módulo do worklet ainda carrega: o iniciar antigo desiste sem pedir o microfone", async () => {
    modulo = adiavel<void>();
    const e = new Escuta();
    const p = e.iniciar();
    p.catch(() => {});
    await aguardar();
    e.soltar();
    modulo.ok();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(e.ativa).toBe(false);
  });

  it("iniciar de novo sem soltar, com o primeiro ainda esperando: o primeiro é substituído e seu contexto é fechado", async () => {
    const e = new Escuta();
    const p1 = e.iniciar();
    p1.catch(() => {});
    await aguardar();
    const pedido1 = pedido;
    pedido = adiavel<Fluxo>();
    const p2 = e.iniciar();
    await aguardar();
    const f1 = novoFluxo();
    const f2 = novoFluxo();
    pedido1.ok(f1);
    pedido.ok(f2);
    await expect(p1).rejects.toMatchObject({ name: "AbortError" });
    await p2;
    expect(contextos[0].fechado).toBe(true);
    expect(contextos[1].fechado).toBe(false);
    expect(f1.trilha.parada).toBe(true);
    expect(f2.trilha.parada).toBe(false);
    expect(e.ativa).toBe(true);
  });

  it("falha real da tentativa vigente continua chegando como o erro original", async () => {
    const e = new Escuta();
    const p = e.iniciar();
    p.catch(() => {});
    pedido.falha(new DOMException("sem aparelho", "NotFoundError"));
    await expect(p).rejects.toMatchObject({ name: "NotFoundError" });
  });
});

describe("fábricas injetadas", () => {
  it("a Escuta usa as fábricas que recebe, não os globais do navegador", async () => {
    const ctx = new Contexto();
    const f = novoFluxo();
    const no = new No();
    const fab = {
      temMicrofone: () => true,
      contexto: () => ctx as unknown as AudioContext,
      abrirMicrofone: async () => f as unknown as MediaStream,
      no: () => no as unknown as AudioWorkletNode,
      gravador: () => null,
      erro: (m: string, n: string) => Object.assign(new Error(m), { name: n }),
    };
    vi.stubGlobal("AudioContext", undefined);
    const e = new Escuta(fab);
    await e.iniciar();
    expect(e.ativa).toBe(true);
    expect(contextos).toHaveLength(1); // só o criado aqui, pela própria fábrica
    expect(await e.parar()).toBeNull(); // sem gravador
    expect(f.trilha.parada).toBe(true);
  });

  it("sem microfone: o erro vem da fábrica", async () => {
    const fab = { temMicrofone: () => false, erro: (m: string, n: string) => Object.assign(new Error(m), { name: n }) };
    await expect(new Escuta(fab as never).iniciar()).rejects.toMatchObject({ name: "NotSupportedError" });
  });
});

