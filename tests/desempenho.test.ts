import { describe, expect, it } from "vitest";
import {
  AcumuladorDeIntervalos, MedidorDeDesempenho, acrescentarRelatorio, ambienteDoAparelho, arquivoDeRelatorios, fpsConfigurado, fpsReal, fpsRealDaFase, percentil, relatoriosDoTexto, resumirIntervalos, resumoDaFase,
  type ContextoDoRelatorio, type DepsDoMedidor, type RelatorioDeDesempenho,
} from "../src/lib/video/desempenho";
import { laboratorioPadrao, overlayPadrao } from "../src/lib/preferencias";

describe("percentis e resumo de intervalos", () => {
  it("posto mais próximo sobre 1..100", () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentil(v, 100, 50)).toBe(50);
    expect(percentil(v, 100, 95)).toBe(95);
    expect(percentil(v, 100, 99)).toBe(99);
    expect(percentil(v, 100, 100)).toBe(100);
    expect(percentil([], 0, 95)).toBe(0);
  });
  it("média, máximo e contagens acima de 33, 50 e 100 ms (estritamente acima)", () => {
    const r = resumirIntervalos([16, 17, 33, 34, 50, 51, 100, 101, 250]);
    expect(r.n).toBe(9);
    expect(r.maxMs).toBe(250);
    expect(r.mediaMs).toBe(72.44);
    expect(r.acima).toEqual({ "33": 6, "50": 4, "100": 2 });
    expect(r.p50Ms).toBe(50);
  });
  it("sem amostras: tudo zero", () => {
    expect(resumirIntervalos([])).toMatchObject({ n: 0, mediaMs: 0, p95Ms: 0, maxMs: 0, acima: { "33": 0, "50": 0, "100": 0 } });
  });
  it("passou da capacidade: os contadores seguem exatos, os percentis usam as amostras guardadas", () => {
    const a = new AcumuladorDeIntervalos([50], 3);
    [10, 20, 30, 60, 70].forEach((x) => a.registrar(x));
    const r = a.resumo();
    expect(r.n).toBe(5);
    expect(r.maxMs).toBe(70);
    expect(r.acima["50"]).toBe(2);
    expect(r.p50Ms).toBe(20); // só 10, 20 e 30 ficaram
  });
});

// Relógio, rAF e observadores falsos.
function montar(extra: Partial<DepsDoMedidor> = {}) {
  let agora = 1000;
  const quadros: ((ts: number) => void)[] = [];
  const cancelados: number[] = [];
  const deps: DepsDoMedidor = {
    pedirQuadro: (cb) => (quadros.push(cb), quadros.length),
    cancelarQuadro: (id) => void cancelados.push(id),
    agora: () => agora,
    agoraIso: () => "2026-11-24T10:00:00.000Z",
    ...extra,
  };
  const m = new MedidorDeDesempenho(deps);
  /** Entrega um quadro com carimbo `ts` ao último callback pedido. */
  const quadro = (ts: number) => quadros[quadros.length - 1](ts);
  return { m, quadro, avancar: (ms: number) => (agora += ms), cancelados, quadros };
}
const contexto = (): ContextoDoRelatorio => ({
  app: "0.1.4 (teste)",
  ambiente: ambienteDoAparelho({ navigator: { userAgent: "UA", hardwareConcurrency: 8, deviceMemory: 4 }, devicePixelRatio: 2.5, screen: { width: 1080, height: 2400 } }),
  qualidadePedida: { altura: 1080, fps: 60 },
  cameraPedida: "traseira",
  overlay: overlayPadrao(),
  laboratorio: laboratorioPadrao(),
});

describe("MedidorDeDesempenho", () => {
  it("separa os quadros por fase e o intervalo que cruza a troca vai para a fase nova", () => {
    const { m, quadro } = montar();
    m.iniciar(contexto());
    [0, 16, 32, 100].forEach(quadro); // standby: 16, 16, 68
    m.marcarFase("correndo");
    [117, 133].forEach(quadro); // correndo: 17, 16
    const r = m.parar()!;
    expect(r.fases.standby.n).toBe(3);
    expect(r.fases.standby.maxMs).toBe(68);
    expect(r.fases.standby.acima).toEqual({ "33": 1, "50": 1, "100": 0 });
    expect(r.fases.correndo.n).toBe(2);
    expect(r.fases.correndo.maxMs).toBe(17);
    expect(r.fases.correndo.acima).toEqual({ "33": 0, "50": 0, "100": 0 });
  });
  it("o primeiro quadro só marca o relógio; o laço se re-arma e para ao parar", () => {
    const { m, quadro, quadros, cancelados } = montar();
    m.iniciar(contexto());
    quadro(500);
    expect(m.parar()!.fases.standby.n).toBe(0);
    expect(quadros).toHaveLength(2); // pediu o seguinte
    expect(cancelados).toEqual([2]);
    expect(m.medindo).toBe(false);
    expect(m.parar()).toBeNull();
  });
  it("tarefas longas: conta, soma e máximo; sem suporte, diz que não suporta", () => {
    let cb: (d: number) => void = () => {};
    const a = montar({ observarTarefasLongas: (f) => ((cb = f), () => {}) });
    a.m.iniciar(contexto());
    [60, 120, 80].forEach((d) => cb(d));
    expect(a.m.parar()!.tarefasLongas).toEqual({ suportado: true, n: 3, somaMs: 260, maxMs: 120 });
    const b = montar();
    b.m.iniciar(contexto());
    expect(b.m.parar()!.tarefasLongas).toEqual({ suportado: false, n: 0, somaMs: 0, maxMs: 0 });
  });
  it("quadros descartados: a diferença entre o fim e o começo; sem a API, nulo", () => {
    const q = [{ descartados: 5, total: 100 }, { descartados: 12, total: 400 }];
    const a = montar({ qualidadeDoVideo: () => q.shift() ?? null });
    a.m.iniciar(contexto());
    expect(a.m.parar()!.quadrosDoVideo).toEqual({ descartados: 7, total: 300, fpsReal: null, fpsPedido: 60 });
    const b = montar();
    b.m.iniciar(contexto());
    expect(b.m.parar()!.quadrosDoVideo).toBeNull();
  });
  it("pedaços do vídeo: intervalos entre os dataavailable; sem pedaço, nulo", () => {
    const { m } = montar();
    m.iniciar(contexto());
    [0, 1000, 2010, 4100].forEach((t) => m.registrarPedaco(t));
    const r = m.parar()!;
    expect(r.pedacosDeVideo).toMatchObject({ nPedacos: 4, n: 3, maxMs: 2090, acima: { "1500": 1, "2000": 1 } });
    const b = montar();
    b.m.iniciar(contexto());
    expect(b.m.parar()!.pedacosDeVideo).toBeNull();
  });
  it("a câmera real e o ambiente entram no relatório; o último valor lido da câmera vale", () => {
    let c: { largura: number; altura: number; fps: number } | null = null;
    const { m, avancar } = montar({ cameraReal: () => c });
    m.iniciar(contexto());
    c = { largura: 1920, altura: 1080, fps: 29.97 };
    m.marcarFase("correndo");
    c = null; // a câmera já soltou ao fechar
    avancar(2500);
    const r = m.parar()!;
    expect(r.cameraReal).toEqual({ largura: 1920, altura: 1080, fps: 29.97 });
    expect(r).toMatchObject({ versao: 1, quando: "2026-11-24T10:00:00.000Z", duracaoMs: 2500, app: "0.1.4 (teste)", cameraPedida: "traseira", qualidadePedida: { altura: 1080, fps: 60 } });
    expect(r.ambiente).toEqual({ userAgent: "UA", devicePixelRatio: 2.5, tela: { largura: 1080, altura: 2400 }, nucleos: 8, memoriaGb: 4 });
    expect(r.laboratorio).toEqual(laboratorioPadrao());
  });
  it("fpsReal: quadros por segundo a 0,1; nulo sem dado", () => {
    expect(fpsReal(60, 2000)).toBe(30);
    expect(fpsReal(13, 2000)).toBe(6.5);
    expect(fpsReal(100, 3000)).toBe(33.3);
    expect(fpsReal(0, 2000)).toBeNull();
    expect(fpsReal(10, 0)).toBeNull();
    expect(fpsReal(NaN, 1000)).toBeNull();
  });
  it("quadrosDoVideo ganha fpsReal (total / duração) e fpsPedido", () => {
    const q = [{ descartados: 0, total: 0 }, { descartados: 2, total: 150 }];
    const { m, avancar } = montar({ qualidadeDoVideo: () => q.shift() ?? null });
    m.iniciar({ ...contexto(), qualidadePedida: { altura: 720, fps: 30 } });
    avancar(5000);
    expect(m.parar()!.quadrosDoVideo).toEqual({ descartados: 2, total: 150, fpsReal: 30, fpsPedido: 30 });
  });
  it("cameraEntregue: quadros, fps real e intervalos separados por fase; limiar = 2x o esperado pelo fps pedido", () => {
    let cb: (ms: number, mt: number | null) => void = () => {};
    const { m, avancar } = montar({ observarQuadrosEntregues: (f) => ((cb = f), () => {}) });
    m.iniciar({ ...contexto(), qualidadePedida: { altura: 720, fps: 30 } });
    // standby: 3 s, 30 quadros a cada 33,3 ms em média (usa o relógio: sem mediaTime)
    [0, 33, 66, 100, 300].forEach((t) => cb(t, null)); // 4 intervalos: 33, 33, 34 e 200 (um acima de 66,7)
    avancar(2000);
    m.marcarFase("correndo");
    // correndo: o intervalo que cruza a troca vai para a fase nova; mediaTime manda quando anda
    cb(400, 1.0);
    cb(433, 1.1); // pelo mediaTime: 100 ms
    cb(466, 1.1); // mediaTime parado: cai no relógio, 33 ms
    avancar(500);
    const r = m.parar()!;
    expect(r.cameraEntregue).toMatchObject({ fpsPedido: 30 });
    const s = r.cameraEntregue!.standby;
    expect(s).toMatchObject({ n: 5, duracaoMs: 2000, fps: 2.5, lentos: 1, maxMs: 200, limiarMs: 66.7 });
    const c = r.cameraEntregue!.correndo;
    expect(c).toMatchObject({ n: 3, duracaoMs: 500, fps: 6, lentos: 2 });
    expect(c.maxMs).toBeCloseTo(100, 0);
  });
  it("cameraEntregue: o limiar acompanha o fps pedido (60 fps: 33,3 ms) e sem requestVideoFrameCallback fica nulo", () => {
    let cb: (ms: number, mt: number | null) => void = () => {};
    const a = montar({ observarQuadrosEntregues: (f) => ((cb = f), () => {}) });
    a.m.iniciar({ ...contexto(), qualidadePedida: { altura: 720, fps: 60 } });
    cb(0, null);
    cb(40, null);
    expect(a.m.parar()!.cameraEntregue!.standby).toMatchObject({ limiarMs: 33.3, lentos: 1 });
    const b = montar();
    b.m.iniciar(contexto());
    expect(b.m.parar()!.cameraEntregue).toBeNull();
  });
  it("bateria e energia: início e fim; sem as APIs, nulos", async () => {
    const g = { nivel: 0.4, carregando: false };
    let eco = false;
    const { m } = montar({ bateria: async () => () => ({ ...g }), energia: () => ({ economia: eco, termico: 1 }) });
    m.iniciar(contexto());
    await Promise.resolve();
    await Promise.resolve();
    g.nivel = 0.38;
    eco = true;
    const r = m.parar()!;
    expect(r.bateria).toEqual({ inicio: { nivel: 0.4, carregando: false }, fim: { nivel: 0.38, carregando: false } });
    expect(r.energia).toEqual({ inicio: { economia: false, termico: 1 }, fim: { economia: true, termico: 1 } });
    const b = montar();
    b.m.iniciar(contexto());
    const rb = b.m.parar()!;
    expect(rb.bateria).toEqual({ inicio: null, fim: null });
    expect(rb.energia).toEqual({ inicio: { economia: null, termico: null }, fim: { economia: null, termico: null } });
  });
  it("uma medição nova começa do zero", () => {
    const { m, quadro } = montar();
    m.iniciar(contexto());
    [0, 20, 40].forEach(quadro);
    m.parar();
    m.iniciar(contexto());
    expect(m.parar()!.fases.standby.n).toBe(0);
  });
});

describe("ambienteDoAparelho", () => {
  it("o que o aparelho não diz fica nulo", () => {
    expect(ambienteDoAparelho({})).toEqual({ userAgent: "", devicePixelRatio: null, tela: null, nucleos: null, memoriaGb: null });
  });
});

function relatorioFalso(quando: string, extra = ""): RelatorioDeDesempenho {
  const m = montar();
  m.m.iniciar(contexto());
  const r = m.m.parar()!;
  return { ...r, quando, app: r.app + extra };
}

describe("a lista guardada", () => {
  it("o novo vai ao topo, no máximo 10", () => {
    let l: RelatorioDeDesempenho[] = [];
    for (let i = 0; i < 12; i++) l = acrescentarRelatorio(l, relatorioFalso(`2026-11-24T10:${String(i).padStart(2, "0")}:00Z`));
    expect(l).toHaveLength(10);
    expect(l[0].quando).toBe("2026-11-24T10:11:00Z");
    expect(l[9].quando).toBe("2026-11-24T10:02:00Z");
  });
  it("o limite de tamanho tira os mais velhos, mas o novo sempre fica", () => {
    const um = relatorioFalso("2026-11-24T10:00:00Z");
    const tam = JSON.stringify([um]).length;
    const l = acrescentarRelatorio([relatorioFalso("a"), relatorioFalso("b"), relatorioFalso("c")], um, 10, tam * 2);
    expect(l.length).toBeLessThanOrEqual(2);
    expect(l[0]).toBe(um);
    expect(acrescentarRelatorio([relatorioFalso("a")], um, 10, 10)).toEqual([um]);
  });
  it("a leitura é tolerante a lixo", () => {
    const bom = relatorioFalso("2026-11-24T10:00:00Z");
    expect(relatoriosDoTexto(null)).toEqual([]);
    expect(relatoriosDoTexto("{não é json")).toEqual([]);
    expect(relatoriosDoTexto('{"a":1}')).toEqual([]);
    expect(relatoriosDoTexto(JSON.stringify([bom, 1, null, { versao: 1 }, { ...bom, versao: 2 }, { ...bom, fases: {} }]))).toEqual([bom]);
  });
  it("resumo da fase (p95 e quadros acima de 50 ms) e o arquivo de exportação", () => {
    const m = montar();
    m.m.iniciar(contexto());
    [0, 20, 90].forEach(m.quadro);
    const r = m.m.parar()!;
    expect(resumoDaFase(r, "standby")).toEqual({ n: 2, p95Ms: 70, acima50: 1 });
    const arq = arquivoDeRelatorios([r], "v", "2026-11-24T11:00:00Z");
    expect(arq).toEqual({ formato: "nicska-desempenho/1", app: "v", exportadoEm: "2026-11-24T11:00:00Z", relatorios: [r] });
  });
});

describe("robustez dos relatórios guardados", () => {
  const base = { versao: 1, quando: "2026-11-24T10:00:00.000Z", qualidadePedida: { altura: 720, fps: 30 }, fases: { standby: { n: 3, p95Ms: 20, acima: { "50": 1 } }, correndo: { n: 5, p95Ms: 30, acima: { "50": 2 } } } };
  it("descarta relatórios com a mesma data", () => {
    const lista = relatoriosDoTexto(JSON.stringify([base, base, { ...base, quando: "2026-11-24T11:00:00.000Z" }]));
    expect(lista.map((r) => r.quando)).toEqual(["2026-11-24T10:00:00.000Z", "2026-11-24T11:00:00.000Z"]);
  });
  it("o resumo ignora valores que não são números", () => {
    const r = { ...base, fases: { ...base.fases, correndo: { n: 5, p95Ms: "lento", acima: { "50": {} } } } } as never;
    expect(resumoDaFase(r, "correndo")).toEqual({ n: 5, p95Ms: 0, acima50: 0 });
  });
});

describe("relatórios antigos e novos", () => {
  const antigo = { versao: 1, quando: "2026-11-24T10:00:00.000Z", qualidadePedida: { altura: 720, fps: 30 }, cameraReal: { largura: 1280, altura: 720, fps: 30 }, quadrosDoVideo: { descartados: 1, total: 100 }, fases: { standby: { n: 3, p95Ms: 20, acima: { "50": 1 } }, correndo: { n: 5, p95Ms: 30, acima: { "50": 2 } } } };
  it("o relatório antigo (sem os campos novos) é lido e não mostra fps real", () => {
    const [r] = relatoriosDoTexto(JSON.stringify([antigo]));
    expect(r).toBeDefined();
    expect(fpsRealDaFase(r, "correndo")).toBeNull();
    expect(fpsConfigurado(r)).toBe(30);
  });
  it("o novo mostra o fps entregue por fase; sem ele, o do <video> pela medição; lixo vira nulo", () => {
    const fase = (fps: unknown) => ({ n: 9, duracaoMs: 1000, fps, p50Ms: 0, p95Ms: 0, maxMs: 0, lentos: 0, limiarMs: 66.7 });
    const novo = { ...antigo, quadrosDoVideo: { descartados: 0, total: 60, fpsReal: 6.1, fpsPedido: 30 }, cameraEntregue: { fpsPedido: 30, standby: fase(29.8), correndo: fase(null) } };
    const [r] = relatoriosDoTexto(JSON.stringify([novo]));
    expect(fpsRealDaFase(r, "standby")).toBe(29.8);
    expect(fpsRealDaFase(r, "correndo")).toBe(6.1);
    const lixo = { ...novo, cameraEntregue: "x", quadrosDoVideo: { fpsReal: "alto" }, cameraReal: { fps: "x" } } as never;
    expect(fpsRealDaFase(lixo, "standby")).toBeNull();
    expect(fpsConfigurado(lixo)).toBeNull();
  });
});
