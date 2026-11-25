import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIMITES_TIMER, apagarRelatoriosDeDesempenho, guardarRelatorioDeDesempenho, laboratorioPadrao, lerLaboratorio, lerRelatoriosDeDesempenho, salvarLaboratorio, lerAvisoVideoVisto, lerOverlay, lerRegistro, registroPadrao, salvarAvisoVideoVisto, salvarRegistro, overlayPadrao, salvarOverlay, ajustesPadrao, lerAjustes, lerAvisoVozVisto, lerTimer, salvarAjustes, salvarAvisoVozVisto, salvarTimer, timerPadrao } from "../src/lib/preferencias";

// localStorage simples, em memória.
let mem: Record<string, string>;
beforeEach(() => {
  mem = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => {
      mem[k] = String(v);
    },
  });
});

describe("aviso do Standby nas preferências", () => {
  it("vibrar vem ligado e o bipe desligado; só booleanos valem", () => {
    expect(timerPadrao()).toMatchObject({ standbyVibrar: true, standbyBipe: false, standbyVoz: true });
    mem["prefs.timer"] = JSON.stringify({ standbyVibrar: false, standbyBipe: true, standbyVoz: false });
    expect(lerTimer()).toMatchObject({ standbyVibrar: false, standbyBipe: true, standbyVoz: false });
    mem["prefs.timer"] = JSON.stringify({ standbyVibrar: "não", standbyBipe: 1, standbyVoz: 0 });
    expect(lerTimer()).toMatchObject({ standbyVibrar: true, standbyBipe: false, standbyVoz: true });
  });
});

describe("silêncio para parar (CONS-010)", () => {
  it("o padrão é 15 s e o teto, 60 s (mínimo e passo iguais)", () => {
    expect(timerPadrao().silencioMs).toBe(15000);
    expect(lerTimer().silencioMs).toBe(15000); // quem nunca mexeu
    expect(LIMITES_TIMER.silencioMs).toEqual({ min: 2000, max: 60000, passo: 1000 });
  });

  it("o valor salvo pela pessoa não muda, inclusive o antigo de 5 s e um acima de 30 s", () => {
    for (const v of [5000, 30000, 45000, 60000]) {
      mem["prefs.timer"] = JSON.stringify({ silencioMs: v });
      expect(lerTimer().silencioMs, String(v)).toBe(v);
    }
  });

  it("acima do teto ou abaixo do mínimo é limitado; lixo volta ao padrão", () => {
    mem["prefs.timer"] = JSON.stringify({ silencioMs: 90000 });
    expect(lerTimer().silencioMs).toBe(60000);
    mem["prefs.timer"] = JSON.stringify({ silencioMs: 100 });
    expect(lerTimer().silencioMs).toBe(2000);
    mem["prefs.timer"] = JSON.stringify({ silencioMs: "5000" });
    expect(lerTimer().silencioMs).toBe(15000);
  });
});

describe("aviso único da voz do Standby (CONS-012)", () => {
  it("começa não visto; depois de salvo, fica visto", () => {
    expect(lerAvisoVozVisto()).toBe(false);
    salvarAvisoVozVisto();
    expect(lerAvisoVozVisto()).toBe(true);
    mem["prefs.avisoVozVisto"] = "{ quebrado";
    expect(lerAvisoVozVisto()).toBe(false);
  });
});

describe("batidas nas preferências", () => {
  it("só 2 ou 3 valem; qualquer outro valor é desligado", () => {
    for (const [v, esperado] of [[2, 2], [3, 3], [0, 0], [1, 0], [4, 0], ["2", 0], [null, 0]] as const) {
      localStorage.setItem("prefs.timer", JSON.stringify({ batidas: v }));
      expect(lerTimer().batidas, String(v)).toBe(esperado);
    }
    expect(timerPadrao().batidas).toBe(0);
  });
});

describe("cartões abertos de Ajustes", () => {
  it("padrão: todos fechados", () => {
    expect(ajustesPadrao()).toEqual({ aparencia: false, idioma: false });
    expect(lerAjustes()).toEqual(ajustesPadrao());
  });

  it("salvar e ler; JSON inválido ou valor que não é booleano volta ao padrão", () => {
    salvarAjustes({ aparencia: true, idioma: false });
    expect(lerAjustes()).toEqual({ aparencia: true, idioma: false });
    mem["prefs.ajustes"] = "{ quebrado";
    expect(lerAjustes()).toEqual(ajustesPadrao());
    mem["prefs.ajustes"] = '{"aparencia":"sim","idioma":true}';
    expect(lerAjustes()).toEqual({ aparencia: false, idioma: true });
  });

  it("sem armazenamento, nada quebra", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("sem armazenamento");
      },
      setItem: () => {
        throw new Error("sem armazenamento");
      },
    });
    expect(lerAjustes()).toEqual(ajustesPadrao());
    expect(() => salvarAjustes(ajustesPadrao())).not.toThrow();
  });
});

describe("ajustes do timer", () => {
  it("padrão: atraso de 1 a 4 s", () => {
    expect(lerTimer()).toEqual(timerPadrao());
    expect(timerPadrao().atrasoMinMs).toBe(1000);
    expect(timerPadrao().atrasoMaxMs).toBe(4000);
  });

  it("salvar e ler", () => {
    const p = { atrasoMinMs: 2000, atrasoMaxMs: 3000, sensibilidade: 0.8, tempoMortoMs: 80, silencioMs: 8000, batidas: 3 as const, standbyVibrar: false, standbyBipe: true, standbyVoz: false, vibracao321: true };
    salvarTimer(p);
    expect(lerTimer()).toEqual(p);
  });

  it("valores fora da faixa são limitados e o que não é número volta ao padrão", () => {
    mem["prefs.timer"] = JSON.stringify({ atrasoMinMs: -5, atrasoMaxMs: 99999, sensibilidade: 7, tempoMortoMs: "x" });
    const p = lerTimer();
    expect(p.atrasoMinMs).toBe(LIMITES_TIMER.atrasoMs.min);
    expect(p.atrasoMaxMs).toBe(LIMITES_TIMER.atrasoMs.max);
    expect(p.sensibilidade).toBe(LIMITES_TIMER.sensibilidade.max);
    expect(p.tempoMortoMs).toBe(timerPadrao().tempoMortoMs);
  });

  it("o máximo nunca fica abaixo do mínimo", () => {
    mem["prefs.timer"] = JSON.stringify({ atrasoMinMs: 5000, atrasoMaxMs: 1000 });
    const p = lerTimer();
    expect(p.atrasoMaxMs).toBe(p.atrasoMinMs);
  });

  it("JSON inválido volta ao padrão", () => {
    mem["prefs.timer"] = "[1,2]";
    expect(lerTimer()).toEqual(timerPadrao());
  });
});

describe("overlay do vídeo (V2)", () => {
  it("tudo ligado por padrão, inclusive para quem nunca mexeu", () => {
    expect(overlayPadrao()).toEqual({ ligado: true, avatar: true, nome: true, cabecalho: true, splits: true, marca: true });
    expect(lerOverlay()).toEqual(overlayPadrao());
  });
  it("lembra o que a pessoa desligou (sem rosto e sem nome)", () => {
    salvarOverlay({ ...overlayPadrao(), avatar: false, nome: false, marca: false });
    expect(lerOverlay()).toEqual({ ligado: true, avatar: false, nome: false, cabecalho: true, splits: true, marca: false });
  });
  it("só booleanos valem; lixo e JSON quebrado voltam ao padrão", () => {
    mem["prefs.videoOverlay"] = JSON.stringify({ ligado: "não", avatar: 0, splits: null, cabecalho: false, extra: true });
    expect(lerOverlay()).toEqual({ ...overlayPadrao(), cabecalho: false });
    mem["prefs.videoOverlay"] = "{quebrado";
    expect(lerOverlay()).toEqual(overlayPadrao());
    mem["prefs.videoOverlay"] = "[false]";
    expect(lerOverlay()).toEqual(overlayPadrao());
  });
});

describe("registro (Ajustes → Registro, V2b)", () => {
  it("padrão só áudio com a traseira; lembra o modo e a câmera escolhidos em Ajustes", () => {
    expect(lerRegistro()).toEqual(registroPadrao());
    expect(registroPadrao()).toEqual({ modo: "audio", camera: "traseira" });
    salvarRegistro({ modo: "video", camera: "frontal" });
    expect(lerRegistro()).toEqual({ modo: "video", camera: "frontal" });
  });
  it("lixo vale o padrão", () => {
    mem["prefs.registro"] = JSON.stringify({ modo: "filme", camera: 2 });
    expect(lerRegistro()).toEqual(registroPadrao());
    mem["prefs.registro"] = "{quebrado";
    expect(lerRegistro()).toEqual(registroPadrao());
  });
  it("o aviso de privacidade do vídeo (enquadrar ou Ajustes) aparece uma vez só", () => {
    expect(lerAvisoVideoVisto()).toBe(false);
    salvarAvisoVideoVisto();
    expect(lerAvisoVideoVisto()).toBe(true);
  });
});

describe("laboratório de desempenho", () => {
  it("o padrão é overlay ligado, 30 Hz, medir ligado e gravar o vídeo", () => {
    expect(laboratorioPadrao()).toEqual({ overlayAoVivo: true, taxaHz: 30, medirDesempenho: true, gravarVideo: true });
    expect(lerLaboratorio()).toEqual(laboratorioPadrao());
  });
  it("guarda e lê de volta", () => {
    salvarLaboratorio({ overlayAoVivo: false, taxaHz: 10, medirDesempenho: false, gravarVideo: false });
    expect(lerLaboratorio()).toEqual({ overlayAoVivo: false, taxaHz: 10, medirDesempenho: false, gravarVideo: false });
  });
  it("lixo vale o padrão, campo a campo", () => {
    mem["prefs.laboratorio"] = JSON.stringify({ overlayAoVivo: "não", taxaHz: 45, medirDesempenho: 1, gravarVideo: false });
    expect(lerLaboratorio()).toEqual({ ...laboratorioPadrao(), gravarVideo: false });
    mem["prefs.laboratorio"] = JSON.stringify({ taxaHz: "60" });
    expect(lerLaboratorio().taxaHz).toBe(30);
    mem["prefs.laboratorio"] = JSON.stringify({ taxaHz: 60 });
    expect(lerLaboratorio().taxaHz).toBe(60);
    for (const ruim of ["{x", "[1]", "null", "7"]) {
      mem["prefs.laboratorio"] = ruim;
      expect(lerLaboratorio()).toEqual(laboratorioPadrao());
    }
  });
});

describe("relatórios de desempenho guardados (diag.desempenho)", () => {
  const rel = (quando: string) => ({ versao: 1, quando, duracaoMs: 1, app: "a", qualidadePedida: { altura: 720, fps: 30 }, fases: { standby: { n: 1 }, correndo: { n: 2 } } }) as never;
  it("guarda do mais novo ao mais velho, no máximo 10, e apaga", () => {
    for (let i = 0; i < 12; i++) guardarRelatorioDeDesempenho(rel(`2026-11-24T10:${String(i).padStart(2, "0")}:00Z`));
    const l = lerRelatoriosDeDesempenho();
    expect(l).toHaveLength(10);
    expect(l[0].quando).toBe("2026-11-24T10:11:00Z");
    apagarRelatoriosDeDesempenho();
    expect(lerRelatoriosDeDesempenho()).toEqual([]);
  });
  it("lixo guardado vale lista vazia e não impede de guardar", () => {
    mem["diag.desempenho"] = "###";
    expect(lerRelatoriosDeDesempenho()).toEqual([]);
    expect(guardarRelatorioDeDesempenho(rel("2026-11-24T10:00:00Z"))).toHaveLength(1);
  });
});
