import { describe, expect, it, vi } from "vitest";
import type { EventoEscuta } from "../src/lib/escuta";
import { ESPERA_DO_APITO_MS, Timer, TEMPO_MAXIMO_MS, sortearAtraso, type Dependencias, type Instantaneo, type VideoLike } from "../src/lib/timer";
import { timerPadrao } from "../src/lib/preferencias";

// Um relógio falso: `avancar(ms)` dispara, em ordem, o que venceu.
function relogio() {
  let agora = 0;
  let id = 0;
  const fila = new Map<number, { quando: number; fn: () => void }>();
  return {
    em: (ms: number, fn: () => void) => {
      const k = ++id;
      fila.set(k, { quando: agora + ms, fn });
      return () => fila.delete(k);
    },
    async avancar(ms: number) {
      const fim = agora + ms;
      for (;;) {
        const prox = [...fila.entries()].filter(([, v]) => v.quando <= fim).sort((a, b) => a[1].quando - b[1].quando)[0];
        if (!prox) break;
        fila.delete(prox[0]);
        agora = prox[1].quando;
        prox[1].fn();
        await Promise.resolve();
      }
      agora = fim;
    },
    get pendentes() {
      return fila.size;
    },
  };
}

const MICROFONE = { microfone: true } as unknown as MediaStream;

function montar(opc: { fone?: boolean; falhaNoMicrofone?: Error; sorteio?: number; aviso?: number; avisoFalha?: boolean; video?: VideoLike } = {}) {
  const r = relogio();
  const escuta = {
    aoEvento: null as ((e: EventoEscuta) => void) | null,
    aoInterromper: null as (() => void) | null,
    iniciar: vi.fn(async (_o: unknown) => {
      if (opc.falhaNoMicrofone) throw opc.falhaNoMicrofone;
    }),
    parar: vi.fn(async () => ({ blob: new Blob(["x"]), tipo: "audio/webm", segundos: 5, inicioCtx: 10 })),
    soltar: vi.fn(),
    reabrirApito: vi.fn(),
    fluxoDoMicrofone: MICROFONE,
  };
  const apito = {
    agendar: vi.fn(async (_s: number) => ({ quando: 10 + _s, atraso: 0.05 })),
    cancelar: vi.fn(),
  };
  const avisar = vi.fn(async (_p: unknown) => {
    if (opc.avisoFalha) throw new Error("sem vibrar");
    return opc.aviso ?? 0;
  });
  const servico = { armar: vi.fn(() => true), desarmar: vi.fn() };
  const d: Dependencias = {
    escuta,
    apito,
    avisar,
    em: r.em,
    sortear: () => opc.sorteio ?? 0.5,
    armarServico: servico.armar,
    desarmarServico: servico.desarmar,
    foneConectado: () => opc.fone ?? false,
    motivoDoErro: (e) => ((e as Error).name === "NotAllowedError" ? "negada" : "falhou"),
    agoraIso: () => "2026-11-22T10:00:00-03:00",
    novoId: () => "t1",
    video: opc.video,
  };
  const t = new Timer(d);
  const mudancas: Instantaneo[] = [];
  t.aoMudar = (i) => mudancas.push(i);
  const evento = (tipo: "apito" | "disparo", tempo: number) => escuta.aoEvento!({ tipo, tempo, quadro: Math.round(tempo * 48000) });
  return { t, r, escuta, apito, servico, mudancas, evento, avisar };
}

const nl = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("sortearAtraso", () => {
  it("entre o mínimo e o máximo; fixo se iguais; extremos do sorteio", () => {
    expect(sortearAtraso({ minMs: 1000, maxMs: 4000 }, 0)).toBe(1000);
    expect(sortearAtraso({ minMs: 1000, maxMs: 4000 }, 0.5)).toBe(2500);
    expect(sortearAtraso({ minMs: 1000, maxMs: 4000 }, 1)).toBeLessThanOrEqual(4000);
    expect(sortearAtraso({ minMs: 2000, maxMs: 2000 }, 0.7)).toBe(2000);
    expect(sortearAtraso({ minMs: 4000, maxMs: 1000 }, 0)).toBe(1000);
  });
});

describe("Timer: uma tentativa completa", () => {
  it("parado → preparando → atraso → apito → escutando → resultado, com o apito detectado no microfone", async () => {
    const { t, r, escuta, apito, servico, evento, mudancas } = montar({ sorteio: 0.5 });
    expect(t.instantaneo.estado).toBe("parado");
    const inicio = t.iniciar(timerPadrao());
    expect(t.instantaneo.estado).toBe("preparando");
    await inicio;
    await nl();
    expect(t.instantaneo.estado).toBe("atraso");
    expect(t.instantaneo.atrasoMs).toBe(2500);
    expect(apito.agendar).toHaveBeenCalledWith(2.5);
    expect(servico.armar).toHaveBeenCalledTimes(1);
    expect(escuta.iniciar).toHaveBeenCalledWith({ sensibilidade: 0.6, tempoMortoMs: 60, esperarApito: true });

    await r.avancar(2500);
    expect(t.instantaneo.estado).toBe("apito");
    evento("apito", 12.52); // o microfone ouve o apito um pouco depois do agendado
    expect(t.instantaneo.estado).toBe("escutando");
    expect(t.instantaneo.inicio).toBe("detectado");
    expect(t.instantaneo.zeroS).toBe(12.52); // o cronômetro ao vivo da tela cheia do vídeo conta deste zero (V2b)

    evento("disparo", 12.52 + 1.48);
    evento("disparo", 12.52 + 1.73);
    expect(t.instantaneo.disparosMs).toEqual([1480, 1730]);
    await t.parar();
    expect(t.instantaneo.estado).toBe("resultado");
    const res = t.instantaneo.resultado!;
    expect(res.inicio).toBe("detectado");
    expect(res.disparosMs).toEqual([1480, 1730]);
    expect(res.resumo.total).toBe(1730);
    expect(res.resumo.splits).toEqual([250]);
    expect(res.atrasoMs).toBe(2500);
    expect(res.data).toBe("2026-11-22T10:00:00-03:00");
    expect(res.audio?.segundos).toBe(5);
    expect(res.zeroNoAudioS).toBeCloseTo(2.52, 6); // o zero (12,52 s no relógio do áudio) menos o começo da gravação (10 s)
    expect(servico.desarmar).toHaveBeenCalled();
    expect(mudancas.map((m) => m.estado)).toEqual(["preparando", "atraso", "apito", "escutando", "escutando", "escutando", "resultado"]);
  });

  it("um tom antes do instante agendado (voz, timer da baia vizinha) não é o apito: segue procurando o verdadeiro", async () => {
    const { t, r, escuta, evento } = montar({ sorteio: 0.5 }); // apito agendado para 12,5 s
    await t.iniciar(timerPadrao());
    r.avancar(1000);
    evento("apito", 11.2); // outro tom, bem antes
    expect(t.instantaneo.estado).toBe("atraso");
    expect(escuta.reabrirApito).toHaveBeenCalledTimes(1);
    r.avancar(1500);
    evento("apito", 12.52); // o nosso
    expect(t.instantaneo.estado).toBe("escutando");
    expect(t.instantaneo.inicio).toBe("detectado");
    evento("disparo", 13.52);
    expect(t.instantaneo.disparosMs).toEqual([1000]); // contado a partir do apito certo, não do tom falso
  });

  it("um tom depois da janela (o apito já passou) também é descartado, e o início vira estimado", async () => {
    const { t, r, escuta, evento } = montar({ sorteio: 0.5 });
    await t.iniciar(timerPadrao());
    r.avancar(2500);
    r.avancar(1500 + 10); // o app desiste e dá o início por estimado
    expect(t.instantaneo.inicio).toBe("estimado");
    evento("apito", 20); // já escutando: ignorado sem reabrir nada
    expect(escuta.reabrirApito).not.toHaveBeenCalled();
    expect(t.instantaneo.inicio).toBe("estimado");
  });

  it("o apito na borda da janela vale (50 ms antes do agendado)", async () => {
    const { t, r, evento } = montar({ sorteio: 0.5 });
    await t.iniciar(timerPadrao());
    r.avancar(2000);
    evento("apito", 12.5 - 0.05 + 0.001);
    expect(t.instantaneo.estado).toBe("escutando");
  });

  it("o aviso do Standby toca no começo do atraso e o atraso sorteado conta depois dele", async () => {
    const { t, r, avisar, apito, mudancas } = montar({ sorteio: 0.5, aviso: 150 });
    await t.iniciar(timerPadrao());
    expect(t.instantaneo.estado).toBe("atraso");
    expect(avisar).toHaveBeenCalledTimes(1);
    expect(apito.agendar).toHaveBeenCalledWith((150 + 2500) / 1000); // o aviso, e só então os 2,5 s sorteados
    expect(t.instantaneo.atrasoMs).toBe(2500); // o atraso mostrado é o sorteado, sem o aviso
    r.avancar(2500); // ainda não: faltam os 150 ms do aviso
    expect(t.instantaneo.estado).toBe("atraso");
    r.avancar(150);
    expect(t.instantaneo.estado).toBe("apito");
    expect(mudancas.map((m) => m.estado)).toContain("atraso");
  });

  it("sem aviso (duração 0) o atraso é o de sempre", async () => {
    const { t, apito } = montar({ sorteio: 0.5 });
    await t.iniciar(timerPadrao());
    expect(apito.agendar).toHaveBeenCalledWith(2.5);
  });

  it("se o aviso falhar (vibração, bipe), a tentativa segue sem ele", async () => {
    const { t, apito } = montar({ sorteio: 0.5, avisoFalha: true });
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    await t.iniciar(timerPadrao());
    expect(t.instantaneo.estado).toBe("atraso");
    expect(apito.agendar).toHaveBeenCalledWith(2.5);
    aviso.mockRestore();
  });

  it("cancelar durante o aviso não agenda apito nenhum", async () => {
    const { t, apito } = montar({ sorteio: 0.5 });
    const p = t.iniciar(timerPadrao());
    t.cancelar();
    await p;
    expect(apito.agendar).not.toHaveBeenCalled();
    expect(t.instantaneo.estado).toBe("parado");
  });

  it("disparos antes do apito no microfone não entram", async () => {
    const { t, r, evento } = montar();
    await t.iniciar(timerPadrao());
    await nl();
    await r.avancar(2500);
    evento("disparo", 5); // vizinho atirando antes do apito
    evento("apito", 12.52);
    evento("disparo", 12.52 + 1);
    expect(t.instantaneo.disparosMs).toEqual([1000]);
  });

  it("o apito não ouvido vira início estimado (instante agendado + latência de saída); disparos que chegaram antes entram", async () => {
    const { t, r, evento } = montar();
    await t.iniciar(timerPadrao());
    await nl();
    await r.avancar(2500);
    evento("disparo", 12.55 + 1); // chega antes de o app desistir do apito
    await r.avancar(ESPERA_DO_APITO_MS);
    expect(t.instantaneo.estado).toBe("escutando");
    expect(t.instantaneo.inicio).toBe("estimado");
    expect(t.instantaneo.disparosMs).toEqual([1000]); // zero estimado: 10 + 2,5 + 0,05 = 12,55 s
  });

  it("com fone: avisa, não espera o apito no microfone e o início é estimado", async () => {
    const { t, r, escuta } = montar({ fone: true });
    await t.iniciar(timerPadrao());
    await nl();
    expect(t.instantaneo.avisoDeFone).toBe(true);
    expect(escuta.iniciar).toHaveBeenCalledWith(expect.objectContaining({ esperarApito: false }));
    await r.avancar(2500 + 500);
    expect(t.instantaneo.estado).toBe("escutando");
    expect(t.instantaneo.inicio).toBe("estimado");
  });

  it("para sozinho depois de X s sem disparo, contados do último", async () => {
    const { t, r, evento } = montar();
    await t.iniciar({ ...timerPadrao(), silencioMs: 5000 });
    await nl();
    await r.avancar(2500);
    evento("apito", 12.52);
    await r.avancar(4000);
    evento("disparo", 12.52 + 4);
    await r.avancar(4900);
    expect(t.instantaneo.estado).toBe("escutando"); // o silêncio recomeçou no disparo
    await r.avancar(200);
    await nl();
    expect(t.instantaneo.estado).toBe("resultado");
    expect(t.instantaneo.resultado!.disparosMs).toEqual([4000]);
  });

  it("para sozinho no tempo máximo", async () => {
    const { t, r, evento } = montar();
    await t.iniciar({ ...timerPadrao(), silencioMs: 30000 });
    await nl();
    await r.avancar(2500);
    evento("apito", 12.52);
    for (let i = 0; i < 6; i++) await r.avancar(30000 - 1);
    await r.avancar(TEMPO_MAXIMO_MS);
    await nl();
    expect(t.instantaneo.estado).toBe("resultado");
  });

  it("depois do resultado, descartar volta ao início e uma nova tentativa começa", async () => {
    const { t, r, evento } = montar();
    await t.iniciar(timerPadrao());
    await nl();
    await r.avancar(2500);
    evento("apito", 12.52);
    await t.parar();
    expect(t.instantaneo.estado).toBe("resultado");
    t.descartar();
    expect(t.instantaneo.estado).toBe("parado");
    await t.iniciar(timerPadrao());
    expect(t.instantaneo.estado).not.toBe("parado");
  });
});

describe("Timer: cancelar em cada estado", () => {
  it("preparando (esperando o microfone): nada fica ligado quando o microfone chega", async () => {
    const { t, escuta } = montar();
    const p = t.iniciar(timerPadrao());
    t.cancelar();
    await p;
    await nl();
    expect(t.instantaneo.estado).toBe("parado");
    expect(escuta.soltar).toHaveBeenCalled();
  });

  it("atraso: cancela o apito agendado, solta tudo e não toca depois", async () => {
    const { t, r, apito, escuta, servico } = montar();
    await t.iniciar(timerPadrao());
    await nl();
    t.cancelar();
    expect(t.instantaneo.estado).toBe("parado");
    expect(apito.cancelar).toHaveBeenCalled();
    expect(escuta.soltar).toHaveBeenCalled();
    expect(servico.desarmar).toHaveBeenCalled();
    expect(r.pendentes).toBe(0);
  });

  it("apito: o botão Parar é o mesmo que cancelar", async () => {
    const { t, r } = montar();
    await t.iniciar(timerPadrao());
    await nl();
    await r.avancar(2500);
    expect(t.instantaneo.estado).toBe("apito");
    await t.parar();
    expect(t.instantaneo.estado).toBe("parado");
    expect(t.instantaneo.resultado).toBeNull();
  });

  it("escutando: cancelar descarta tudo, sem resultado", async () => {
    const { t, r, evento, escuta } = montar();
    await t.iniciar(timerPadrao());
    await nl();
    await r.avancar(2500);
    evento("apito", 12.52);
    evento("disparo", 13.5);
    t.cancelar();
    expect(t.instantaneo.estado).toBe("parado");
    expect(t.instantaneo.disparosMs).toEqual([]);
    expect(escuta.parar).not.toHaveBeenCalled();
    evento("disparo", 14); // eventos atrasados não ressuscitam a tentativa
    expect(t.instantaneo.disparosMs).toEqual([]);
  });

  it("depois do resultado: descartar", async () => {
    const { t, r, evento } = montar();
    await t.iniciar(timerPadrao());
    await nl();
    await r.avancar(2500);
    evento("apito", 12.52);
    await t.parar();
    t.cancelar();
    expect(t.instantaneo.estado).toBe("parado");
  });
});

describe("Timer: erros", () => {
  it("permissão negada: erro 'negada', nada armado, e dá para tentar de novo", async () => {
    const e = new Error("x");
    e.name = "NotAllowedError";
    const { t, servico, escuta } = montar({ falhaNoMicrofone: e });
    await t.iniciar(timerPadrao());
    expect(t.instantaneo.estado).toBe("erro");
    expect(t.instantaneo.erro).toBe("negada");
    expect(servico.armar).not.toHaveBeenCalled();
    expect(escuta.soltar).toHaveBeenCalled();
    t.descartar();
    expect(t.instantaneo.estado).toBe("parado");
  });

  it("áudio perdido (ligação, outro app): cancela e avisa na tela", async () => {
    const { t, r, escuta, apito } = montar();
    await t.iniciar(timerPadrao());
    await nl();
    await r.avancar(1000);
    escuta.aoInterromper!();
    expect(t.instantaneo.estado).toBe("erro");
    expect(t.instantaneo.erro).toBe("audio_perdido");
    expect(apito.cancelar).toHaveBeenCalled();
    expect(r.pendentes).toBe(0);
  });

  it("interrupção sem tentativa em andamento é ignorada", () => {
    const { t, escuta } = montar();
    escuta.aoInterromper!();
    expect(t.instantaneo.estado).toBe("parado");
  });

  it("tocar de novo no botão durante uma tentativa não começa outra", async () => {
    const { t, escuta } = montar();
    await t.iniciar(timerPadrao());
    await nl();
    await t.iniciar(timerPadrao());
    expect(escuta.iniciar).toHaveBeenCalledTimes(1);
  });

  // CONS-022 (07·TMR-002): o worklet já roda enquanto o microfone ainda abre (`preparando`); um tom nesse intervalo não é o apito, e o detector só diz "apito"
  // uma vez, então precisa ser reaberto, senão o apito verdadeiro passa sem ser ouvido.
  it("um tom de apito em preparando não é o apito: reabre o detector e a tentativa segue", async () => {
    const { t, escuta, evento } = montar({ sorteio: 0.5 });
    let abrir!: () => void;
    escuta.iniciar.mockImplementationOnce(() => new Promise<void>((ok) => (abrir = ok)));
    const p = t.iniciar(timerPadrao());
    expect(t.instantaneo.estado).toBe("preparando");
    evento("apito", 10.1);
    expect(escuta.reabrirApito).toHaveBeenCalledTimes(1);
    expect(t.instantaneo.estado).toBe("preparando");
    abrir();
    await p;
    await nl();
    expect(t.instantaneo.estado).toBe("atraso"); // o tom espúrio não virou zero nem estragou a tentativa
    evento("apito", 12.52);
    expect(t.instantaneo.estado).toBe("escutando");
    expect(t.instantaneo.inicio).toBe("detectado");
  });

  it("um tom de apito com a tentativa parada ou já cancelada é ignorado (não reabre nada)", async () => {
    const { t, escuta, evento } = montar();
    evento("apito", 1);
    await t.iniciar(timerPadrao());
    t.cancelar();
    evento("apito", 2);
    expect(escuta.reabrirApito).not.toHaveBeenCalled();
  });

  // CONS-023 (07·TMR-001), decidido: a interrupção durante a escuta, com tiros já feitos, entrega o que foi detectado marcado como incompleto.
  it("áudio perdido durante a escuta, com disparos já feitos, entrega o parcial marcado como incompleto", async () => {
    const { t, r, escuta, evento } = montar({ sorteio: 0.5 });
    await t.iniciar(timerPadrao());
    await nl();
    await r.avancar(2500);
    evento("apito", 12.52);
    evento("disparo", 13.5);
    evento("disparo", 14.0);
    expect(t.instantaneo.disparosMs).toHaveLength(2);
    escuta.aoInterromper!();
    await nl();
    expect(t.instantaneo.estado).toBe("resultado");
    expect(t.instantaneo.erro).toBeNull();
    expect(t.instantaneo.resultado?.incompleta).toBe(true);
    expect(t.instantaneo.resultado?.disparosMs).toHaveLength(2);
    expect(escuta.parar).toHaveBeenCalledTimes(1); // pede o áudio parcial
  });

  it("áudio perdido durante a escuta SEM disparos continua sendo erro (não há o que guardar)", async () => {
    const { t, r, escuta, evento } = montar({ sorteio: 0.5 });
    await t.iniciar(timerPadrao());
    await nl();
    await r.avancar(2500);
    evento("apito", 12.52);
    escuta.aoInterromper!();
    expect(t.instantaneo.estado).toBe("erro");
    expect(t.instantaneo.erro).toBe("audio_perdido");
    expect(t.instantaneo.resultado).toBeNull();
  });

  it("uma tentativa que termina normalmente não vem marcada como incompleta", async () => {
    const { t, r, evento } = montar({ sorteio: 0.5 });
    await t.iniciar(timerPadrao());
    await nl();
    await r.avancar(2500);
    evento("apito", 12.52);
    evento("disparo", 13.5);
    await t.parar();
    expect(t.instantaneo.resultado?.incompleta).toBeUndefined();
  });
});

describe("Timer: modo vídeo (V1b)", () => {
  const VIDEO = { camera: "traseira" as const, qualidade: { altura: 720 as const, fps: 30 as const } };
  const falso = (motivo: Awaited<ReturnType<VideoLike["iniciar"]>> = null) => ({
    iniciar: vi.fn(async (_p: Parameters<VideoLike["iniciar"]>[0]) => motivo),
    parar: vi.fn(async () => {}),
    cancelar: vi.fn(async () => {}),
  });

  it("o vídeo nasce com o id da tentativa e o áudio do microfone, depois do microfone; para junto no fim; o resultado leva o id", async () => {
    const video = falso();
    const { t, r, escuta, evento } = montar({ sorteio: 0, video });
    await t.iniciar(timerPadrao(), VIDEO);
    await nl();
    expect(video.iniciar).toHaveBeenCalledWith({ id: "t1", audio: MICROFONE, ...VIDEO });
    expect(escuta.iniciar.mock.invocationCallOrder[0]).toBeLessThan(video.iniciar.mock.invocationCallOrder[0]);
    expect(t.instantaneo.estado).toBe("atraso");
    expect(t.instantaneo.semVideo).toBeUndefined();
    await r.avancar(1000);
    evento("apito", 11.02);
    evento("disparo", 12);
    await t.parar();
    expect(video.parar).toHaveBeenCalledTimes(1);
    expect(t.instantaneo.resultado!.id).toBe("t1");
    expect(t.instantaneo.resultado!.disparosMs).toEqual([980]); // o zero e as medições seguem só pelo áudio
  });

  it("câmera negada: a tentativa segue só com áudio e o instantâneo diz por quê", async () => {
    const video = falso("negada");
    const { t, apito } = montar({ video });
    await t.iniciar(timerPadrao(), VIDEO);
    await nl();
    expect(t.instantaneo.semVideo).toBe("negada");
    expect(t.instantaneo.estado).toBe("atraso");
    expect(apito.agendar).toHaveBeenCalled();
  });

  it("sem opções de vídeo (modo só áudio) a câmera não abre, mas um vídeo anterior não salvo é descartado", async () => {
    const video = falso();
    const { t } = montar({ video });
    await t.iniciar(timerPadrao());
    expect(video.iniciar).not.toHaveBeenCalled();
    expect(video.cancelar).toHaveBeenCalled();
  });

  it("cancelar, erro ou descartar o resultado chamam o cancelar do vídeo (que apaga o não salvo)", async () => {
    const video = falso();
    const { t } = montar({ video });
    await t.iniciar(timerPadrao(), VIDEO);
    video.cancelar.mockClear();
    t.cancelar();
    expect(video.cancelar).toHaveBeenCalledTimes(1);
  });

  it("cancelada enquanto a câmera abria: não arma o apito", async () => {
    let abrir!: (m: null) => void;
    const video = { ...falso(), iniciar: vi.fn(() => new Promise<null>((ok) => (abrir = ok))) };
    const { t, apito } = montar({ video });
    const p = t.iniciar(timerPadrao(), VIDEO);
    await nl();
    t.cancelar();
    abrir(null);
    await p;
    await nl();
    expect(apito.agendar).not.toHaveBeenCalled();
    expect(t.instantaneo.estado).toBe("parado");
  });
});

describe("Timer: modo vídeo (V1c)", () => {
  it("passa ao vídeo quando o áudio começou a gravar (para o alinhamento) e o fluxo da prévia", async () => {
    const video = { iniciar: vi.fn(async (_p: Parameters<VideoLike["iniciar"]>[0]) => null), parar: vi.fn(async () => {}), cancelar: vi.fn(async () => {}) };
    const { t, escuta } = montar({ sorteio: 0, video });
    Object.assign(escuta, { inicioDaGravacaoMs: 1234.5 });
    const previa = { previa: true } as unknown as MediaStream;
    await t.iniciar(timerPadrao(), { camera: "frontal", qualidade: { altura: 720, fps: 30 }, fluxoDaCamera: previa });
    await nl();
    expect(video.iniciar).toHaveBeenCalledWith(expect.objectContaining({ id: "t1", inicioDoAudioMs: 1234.5, fluxoDaCamera: previa, camera: "frontal" }));
  });
});
