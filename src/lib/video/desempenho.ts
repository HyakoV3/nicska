// O diagnóstico de DESEMPENHO da gravação ao vivo na tela cheia: mede o que o aparelho entrega enquanto a câmera, os dois gravadores (áudio e vídeo), o detector
// e o overlay trabalham juntos, para achar o que trava. Módulo puro: o relógio, o requestAnimationFrame e os observadores entram por `DepsDoMedidor`
// (desempenhoNavegador.ts liga os do navegador), então tudo se testa sem tela. O custo por quadro é uma subtração, um contador e uma escrita numa lista de
// tamanho fixo. Mede, por FASE ("standby" = antes do apito, "correndo" = escutando): os intervalos entre quadros (média, p50, p95, p99, máximo, quantos
// passaram de 33, 50 e 100 ms); e, no total: as tarefas longas (PerformanceObserver "longtask"), os quadros descartados da prévia, os intervalos entre os
// pedaços do MediaRecorder de vídeo e o ambiente (aparelho, câmera real, preferências). O relatório é um JSON pequeno; os 10 últimos ficam no aparelho.
import type { PrefsLaboratorio, PrefsOverlay } from "../preferencias";
import type { Energia, EstadoDeBateria } from "../energia";
import type { Camera, Qualidade } from "./formato";

export type FaseDeMedicao = "standby" | "correndo";
/** Os limiares de quadro lento (ms): 33 = perdeu um quadro a 30 fps, 50 = tranco que se vê, 100 = parada. */
export const LIMIARES_DE_QUADRO_MS = [33, 50, 100] as const;
/** Os limiares do intervalo entre pedaços de vídeo (ms; o gravador pede um pedaço a cada 1000). */
export const LIMIARES_DE_PEDACO_MS = [1500, 2000] as const;
/** Quantos relatórios ficam guardados e o tamanho máximo (caracteres do JSON) da lista toda. */
export const MAXIMO_DE_RELATORIOS = 10;
export const MAXIMO_DE_CARACTERES = 60_000;
/** Quantas amostras de intervalo cada fase guarda (20 mil quadros = mais de 5 min a 60 fps; o que passar só entra nos contadores). */
const CAPACIDADE_DE_QUADROS = 20_000;
const CAPACIDADE_DE_PEDACOS = 600;

export type ResumoDeIntervalos = {
  n: number;
  mediaMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  /** Quantos intervalos passaram de cada limiar (a chave é o limiar em ms). */
  acima: Record<string, number>;
};

const arredondar = (v: number): number => Math.round(v * 100) / 100;
const arredondar1 = (v: number): number => Math.round(v * 10) / 10;

/** O percentil `p` (0 a 100) pelo método do posto mais próximo, de `n` amostras já em ordem crescente. Sem amostras, 0. */
export function percentil(ordenadas: ArrayLike<number>, n: number, p: number): number {
  if (n <= 0) return 0;
  const i = Math.min(n - 1, Math.max(0, Math.ceil((p / 100) * n) - 1));
  return ordenadas[i];
}

/** Guarda intervalos (ms) em contadores exatos e numa lista de tamanho fixo (para os percentis), sem alocar por registro. */
export class AcumuladorDeIntervalos {
  private n = 0;
  private soma = 0;
  private max = 0;
  private guardadas = 0;
  private readonly acima: number[];
  private amostras: Float32Array | null = null;

  constructor(
    private readonly limiares: readonly number[],
    private readonly capacidade: number,
  ) {
    this.acima = limiares.map(() => 0);
  }

  registrar(ms: number): void {
    this.n++;
    this.soma += ms;
    if (ms > this.max) this.max = ms;
    for (let i = 0; i < this.limiares.length; i++) if (ms > this.limiares[i]) this.acima[i]++;
    if (this.guardadas < this.capacidade) (this.amostras ??= new Float32Array(this.capacidade))[this.guardadas++] = ms;
  }

  resumo(): ResumoDeIntervalos {
    const ordenadas = this.amostras ? this.amostras.slice(0, this.guardadas).sort() : new Float32Array(0);
    const m = ordenadas.length;
    return {
      n: this.n,
      mediaMs: this.n ? arredondar(this.soma / this.n) : 0,
      p50Ms: arredondar(percentil(ordenadas, m, 50)),
      p95Ms: arredondar(percentil(ordenadas, m, 95)),
      p99Ms: arredondar(percentil(ordenadas, m, 99)),
      maxMs: arredondar(this.max),
      acima: Object.fromEntries(this.limiares.map((l, i) => [String(l), this.acima[i]])),
    };
  }
}

/** O resumo de uma lista pronta de intervalos (ms): a mesma conta do acumulador, para quem já tem os números. */
export function resumirIntervalos(intervalos: readonly number[], limiares: readonly number[] = LIMIARES_DE_QUADRO_MS): ResumoDeIntervalos {
  const a = new AcumuladorDeIntervalos(limiares, Math.max(1, intervalos.length));
  for (const v of intervalos) a.registrar(v);
  return a.resumo();
}

/** Os quadros que a câmera ENTREGOU de verdade ao <video> da prévia numa fase (contados por `requestVideoFrameCallback`; `getSettings().frameRate` é só o configurado). */
export type QuadrosEntregues = {
  /** Quantos quadros chegaram na fase. */
  n: number;
  /** Quanto durou a fase (ms). */
  duracaoMs: number;
  /** Quadros por segundo reais: `n` / segundos da fase (0,1 de precisão); nulo se a fase não durou. */
  fps: number | null;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  /** Intervalos acima de 2x o esperado pelo fps pedido (ex.: mais de 66,7 ms a 30 fps). */
  lentos: number;
  limiarMs: number;
};
export type CameraEntregue = { fpsPedido: number; standby: QuadrosEntregues; correndo: QuadrosEntregues };

/** O fps real: `quadros` em `duracaoMs`, a 0,1; nulo sem quadros ou sem tempo. */
export function fpsReal(quadros: number, duracaoMs: number): number | null {
  return Number.isFinite(quadros) && Number.isFinite(duracaoMs) && quadros > 0 && duracaoMs > 0 ? arredondar1(quadros / (duracaoMs / 1000)) : null;
}

export type ConfigDaCamera = { largura: number | null; altura: number | null; fps: number | null };
export type AmbienteDoAparelho = { userAgent: string; devicePixelRatio: number | null; tela: { largura: number; altura: number } | null; nucleos: number | null; memoriaGb: number | null };

/** O aparelho, lido dos globais do navegador (injetados: nos testes são objetos soltos). Tudo que o aparelho não diz fica nulo. */
export function ambienteDoAparelho(g: { navigator?: Record<string, unknown>; devicePixelRatio?: number; screen?: { width?: number; height?: number } }): AmbienteDoAparelho {
  const n = g.navigator ?? {};
  const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
  return {
    userAgent: typeof n.userAgent === "string" ? n.userAgent : "",
    devicePixelRatio: num(g.devicePixelRatio),
    tela: num(g.screen?.width) !== null && num(g.screen?.height) !== null ? { largura: g.screen!.width!, altura: g.screen!.height! } : null,
    nucleos: num(n.hardwareConcurrency),
    memoriaGb: num(n.deviceMemory),
  };
}

export type RelatorioDeDesempenho = {
  versao: 1;
  /** ISO 8601 de quando a medição terminou. */
  quando: string;
  duracaoMs: number;
  app: string;
  ambiente: AmbienteDoAparelho;
  qualidadePedida: Qualidade;
  cameraPedida: Camera;
  /** O que a câmera entregou de verdade (`track.getSettings()`), ou nulo se não deu para ler. */
  cameraReal: ConfigDaCamera | null;
  overlay: PrefsOverlay;
  laboratorio: PrefsLaboratorio;
  fases: Record<FaseDeMedicao, ResumoDeIntervalos>;
  tarefasLongas: { suportado: boolean; n: number; somaMs: number; maxMs: number };
  /** Quadros descartados do <video> da prévia entre o início e o fim, ou nulo se o navegador não diz. */
  quadrosDoVideo: { descartados: number; total: number; /** total / segundos da medição (0,1); ausente em relatórios antigos. */ fpsReal?: number | null; fpsPedido?: number } | null;
  /** Os quadros entregues pela câmera por fase (ausente em relatórios antigos; nulo se o navegador não tem `requestVideoFrameCallback`). */
  cameraEntregue?: CameraEntregue | null;
  /** Bateria no início e no fim (nulo onde o navegador não diz); ausente em relatórios antigos. */
  bateria?: { inicio: EstadoDeBateria | null; fim: EstadoDeBateria | null };
  /** Economia de energia e estado térmico no início e no fim (nulos sem a ponte); ausente em relatórios antigos. */
  energia?: { inicio: Energia; fim: Energia };
  /** Os intervalos entre os pedaços do gravador de vídeo (nominal 1000 ms); nulo se nenhum pedaço chegou (vídeo não gravado). */
  pedacosDeVideo: (ResumoDeIntervalos & { nPedacos: number }) | null;
};

/** O que o chamador sabe no início e o relatório repete. */
export type ContextoDoRelatorio = Pick<RelatorioDeDesempenho, "app" | "ambiente" | "qualidadePedida" | "cameraPedida" | "overlay" | "laboratorio">;

export type DepsDoMedidor = {
  /** requestAnimationFrame: o callback recebe o carimbo do quadro (ms). */
  pedirQuadro: (cb: (ts: number) => void) => number;
  cancelarQuadro: (id: number) => void;
  /** O relógio de alta resolução (ms), o mesmo dos carimbos. */
  agora: () => number;
  agoraIso: () => string;
  /** Assina as tarefas longas (duração em ms); devolve como cancelar, ou nulo se o navegador não tem. */
  observarTarefasLongas?: (cb: (duracaoMs: number) => void) => (() => void) | null;
  /** Os quadros descartados e o total do <video> da prévia agora, ou nulo se não há como saber. */
  qualidadeDoVideo?: () => { descartados: number; total: number } | null;
  /** As configurações da câmera agora (`getSettings`: o CONFIGURADO, não o entregue), ou nulo. */
  cameraReal?: () => ConfigDaCamera | null;
  /** Assina cada quadro que chega ao <video> da prévia (carimbo em ms do mesmo relógio de `agora`, e `mediaTime` em s se houver); devolve como cancelar, ou nulo se não há `requestVideoFrameCallback`. */
  observarQuadrosEntregues?: (cb: (agoraMs: number, mediaTimeS: number | null) => void) => (() => void) | null;
  /** Abre um leitor vivo da bateria (`navigator.getBattery`), ou nulo se não há. */
  bateria?: () => Promise<(() => EstadoDeBateria | null) | null>;
  /** A economia de energia e o estado térmico agora. */
  energia?: () => Energia;
};

/** Acumula os quadros entregues de UMA fase: contagem, duração e intervalos (só contadores e uma lista de tamanho fixo). */
class FaseEntregue {
  n = 0;
  duracaoMs = 0;
  readonly intervalos: AcumuladorDeIntervalos;
  constructor(readonly limiarMs: number) {
    this.intervalos = new AcumuladorDeIntervalos([limiarMs], CAPACIDADE_DE_QUADROS);
  }
  resumo(): QuadrosEntregues {
    const r = this.intervalos.resumo();
    return { n: this.n, duracaoMs: Math.round(this.duracaoMs), fps: fpsReal(this.n, this.duracaoMs), p50Ms: r.p50Ms, p95Ms: r.p95Ms, maxMs: r.maxMs, lentos: r.acima[String(this.limiarMs)] ?? 0, limiarMs: this.limiarMs };
  }
}

export class MedidorDeDesempenho {
  private ativo = false;
  private fase: FaseDeMedicao = "standby";
  private contexto: ContextoDoRelatorio | null = null;
  private idDoQuadro = 0;
  private ultimoQuadro = -1;
  private inicioMs = 0;
  private readonly quadros: Record<FaseDeMedicao, AcumuladorDeIntervalos> = this.novosQuadros();
  private pedacos = new AcumuladorDeIntervalos(LIMIARES_DE_PEDACO_MS, CAPACIDADE_DE_PEDACOS);
  private nPedacos = 0;
  private ultimoPedaco = -1;
  private longas = { n: 0, somaMs: 0, maxMs: 0 };
  private soltarLongas: (() => void) | null = null;
  private videoInicio: { descartados: number; total: number } | null = null;
  private camera: ConfigDaCamera | null = null;
  private entregues: Record<FaseDeMedicao, FaseEntregue> = this.novasEntregues(30);
  private soltarEntregues: (() => void) | null = null;
  private entreguesAtivo = false;
  private ultimoEntregue = -1;
  private ultimoMediaTime: number | null = null;
  private faseDesde = 0;
  private geracao = 0;
  private bateriaInicio: EstadoDeBateria | null = null;
  private lerBateria: (() => EstadoDeBateria | null) | null = null;
  private energiaInicio: Energia | null = null;

  constructor(private readonly d: DepsDoMedidor) {}

  get medindo(): boolean {
    return this.ativo;
  }

  private novosQuadros(): Record<FaseDeMedicao, AcumuladorDeIntervalos> {
    return { standby: new AcumuladorDeIntervalos(LIMIARES_DE_QUADRO_MS, CAPACIDADE_DE_QUADROS), correndo: new AcumuladorDeIntervalos(LIMIARES_DE_QUADRO_MS, CAPACIDADE_DE_QUADROS) };
  }

  private novasEntregues(fps: number): Record<FaseDeMedicao, FaseEntregue> {
    const limiar = arredondar1((2 * 1000) / (fps > 0 ? fps : 30));
    return { standby: new FaseEntregue(limiar), correndo: new FaseEntregue(limiar) };
  }

  /** Um quadro chegou ao <video>: conta na fase de agora; o intervalo vem do `mediaTime` quando ele anda, senão do relógio. */
  private quadroEntregue(agoraMs: number, mediaTimeS: number | null): void {
    const f = this.entregues[this.fase];
    f.n++;
    if (this.ultimoEntregue >= 0) {
      const dm = mediaTimeS !== null && this.ultimoMediaTime !== null ? (mediaTimeS - this.ultimoMediaTime) * 1000 : 0;
      f.intervalos.registrar(dm > 0 ? dm : agoraMs - this.ultimoEntregue);
    }
    this.ultimoEntregue = agoraMs;
    this.ultimoMediaTime = mediaTimeS;
  }

  /** Começa a medir (na fase "standby"). Já medindo, não faz nada. */
  iniciar(contexto: ContextoDoRelatorio): void {
    if (this.ativo) return;
    this.ativo = true;
    this.contexto = contexto;
    this.fase = "standby";
    this.ultimoQuadro = -1;
    this.ultimoPedaco = -1;
    this.nPedacos = 0;
    this.longas = { n: 0, somaMs: 0, maxMs: 0 };
    Object.assign(this.quadros, this.novosQuadros());
    this.pedacos = new AcumuladorDeIntervalos(LIMIARES_DE_PEDACO_MS, CAPACIDADE_DE_PEDACOS);
    this.inicioMs = this.d.agora();
    this.videoInicio = this.d.qualidadeDoVideo?.() ?? null;
    this.camera = null;
    this.capturarCamera();
    this.entregues = this.novasEntregues(contexto.qualidadePedida?.fps ?? 30);
    this.ultimoEntregue = -1;
    this.ultimoMediaTime = null;
    this.faseDesde = this.inicioMs;
    this.soltarEntregues = this.d.observarQuadrosEntregues?.((ms, mt) => this.quadroEntregue(ms, mt)) ?? null;
    this.entreguesAtivo = this.soltarEntregues !== null;
    this.energiaInicio = this.lerEnergia();
    this.bateriaInicio = null;
    this.lerBateria = null;
    const g = ++this.geracao;
    this.d.bateria?.().then(
      (leitor) => {
        if (g !== this.geracao || !leitor) return; // a medição já acabou ou recomeçou
        this.lerBateria = leitor;
        this.bateriaInicio = leitor();
      },
      () => {},
    );
    this.soltarLongas =
      this.d.observarTarefasLongas?.((ms) => {
        this.longas.n++;
        this.longas.somaMs += ms;
        if (ms > this.longas.maxMs) this.longas.maxMs = ms;
      }) ?? null;
    const quadro = (ts: number) => {
      if (this.ultimoQuadro >= 0) this.quadros[this.fase].registrar(ts - this.ultimoQuadro);
      this.ultimoQuadro = ts;
      this.idDoQuadro = this.d.pedirQuadro(quadro);
    };
    this.idDoQuadro = this.d.pedirQuadro(quadro);
  }

  /** Muda a fase: os quadros daqui em diante contam nela (o intervalo que cruza a troca conta na fase nova). */
  marcarFase(fase: FaseDeMedicao): void {
    if (this.ativo && fase !== this.fase) {
      const agora = this.d.agora();
      this.entregues[this.fase].duracaoMs += agora - this.faseDesde;
      this.faseDesde = agora;
    }
    this.fase = fase;
    this.capturarCamera();
  }

  /** Guarda as configurações reais da câmera, se ela as diz (pode ser chamado à vontade; o último valor lido vale). */
  capturarCamera(): void {
    const c = this.d.cameraReal?.();
    if (c) this.camera = c;
  }

  /** Chegou um pedaço do gravador de vídeo (o gancho do `GravadorDeVideo`): mede o intervalo para o anterior. */
  registrarPedaco(agoraMs: number = this.d.agora()): void {
    if (!this.ativo) return;
    this.nPedacos++;
    if (this.ultimoPedaco >= 0) this.pedacos.registrar(agoraMs - this.ultimoPedaco);
    this.ultimoPedaco = agoraMs;
  }

  private lerEnergia(): Energia {
    try {
      return this.d.energia?.() ?? { economia: null, termico: null };
    } catch {
      return { economia: null, termico: null };
    }
  }

  /** Termina e devolve o relatório (nulo se não estava medindo). */
  parar(): RelatorioDeDesempenho | null {
    if (!this.ativo || !this.contexto) return null;
    this.ativo = false;
    this.d.cancelarQuadro(this.idDoQuadro);
    this.soltarLongas?.();
    this.soltarEntregues?.();
    const agora = this.d.agora();
    this.entregues[this.fase].duracaoMs += agora - this.faseDesde;
    this.geracao++; // um getBattery atrasado não mexe mais nesta medição
    let bateriaFim: EstadoDeBateria | null = null;
    try {
      bateriaFim = this.lerBateria?.() ?? null;
    } catch {
      /* sem bateria */
    }
    this.capturarCamera();
    const fim = this.d.qualidadeDoVideo?.() ?? null;
    const ini = this.videoInicio;
    const duracaoMs = Math.round(agora - this.inicioMs);
    const totalVideo = ini && fim ? Math.max(0, fim.total - ini.total) : null;
    return {
      versao: 1,
      quando: this.d.agoraIso(),
      duracaoMs,
      ...this.contexto,
      cameraReal: this.camera,
      fases: { standby: this.quadros.standby.resumo(), correndo: this.quadros.correndo.resumo() },
      tarefasLongas: { suportado: this.soltarLongas !== null, n: this.longas.n, somaMs: arredondar(this.longas.somaMs), maxMs: arredondar(this.longas.maxMs) },
      quadrosDoVideo: ini && fim ? { descartados: Math.max(0, fim.descartados - ini.descartados), total: totalVideo ?? 0, fpsReal: fpsReal(totalVideo ?? 0, duracaoMs), fpsPedido: this.contexto.qualidadePedida.fps } : null,
      cameraEntregue: this.entreguesAtivo ? { fpsPedido: this.contexto.qualidadePedida.fps, standby: this.entregues.standby.resumo(), correndo: this.entregues.correndo.resumo() } : null,
      bateria: { inicio: this.bateriaInicio, fim: bateriaFim },
      energia: { inicio: this.energiaInicio ?? { economia: null, termico: null }, fim: this.lerEnergia() },
      pedacosDeVideo: this.nPedacos > 0 ? { ...this.pedacos.resumo(), nPedacos: this.nPedacos } : null,
    };
  }
}

// ---- A lista guardada e o arquivo ----

/** O relatório no topo da lista, no máximo `maximo` deles e `maxCaracteres` de JSON na lista toda (os mais velhos saem primeiro; o novo sempre fica). */
export function acrescentarRelatorio(lista: readonly RelatorioDeDesempenho[], novo: RelatorioDeDesempenho, maximo: number = MAXIMO_DE_RELATORIOS, maxCaracteres: number = MAXIMO_DE_CARACTERES): RelatorioDeDesempenho[] {
  const r = [novo, ...lista].slice(0, Math.max(1, maximo));
  while (r.length > 1 && JSON.stringify(r).length > maxCaracteres) r.pop();
  return r;
}

const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** Um relatório que dá para mostrar na lista (versão 1, data e as duas fases com contagem). O resto é do arquivo e não é conferido. */
function ehRelatorio(x: unknown): x is RelatorioDeDesempenho {
  if (!ehObjeto(x) || x.versao !== 1 || typeof x.quando !== "string" || !ehObjeto(x.fases) || !ehObjeto(x.qualidadePedida)) return false;
  return (["standby", "correndo"] as const).every((f) => ehObjeto((x.fases as Record<string, unknown>)[f]) && Number.isFinite(((x.fases as Record<string, Record<string, unknown>>)[f]).n));
}

/** Lê a lista guardada: texto ausente, inválido ou de outra forma vale lista vazia; itens que não prestam são descartados. */
export function relatoriosDoTexto(bruto: string | null): RelatorioDeDesempenho[] {
  if (!bruto) return [];
  try {
    const o: unknown = JSON.parse(bruto);
    if (!Array.isArray(o)) return [];
    const vistos = new Set<string>(); // `quando` é a chave da lista na tela: repetido (armazenamento editado, relógio mexido) é descartado
    return o.filter((x) => ehRelatorio(x) && !vistos.has(x.quando) && !!vistos.add(x.quando)).slice(0, MAXIMO_DE_RELATORIOS);
  } catch {
    return [];
  }
}

/** O resumo de uma fase para a lista de Ajustes: p95 do intervalo entre quadros e quantos passaram de 50 ms. */
export function resumoDaFase(r: RelatorioDeDesempenho, fase: FaseDeMedicao): { n: number; p95Ms: number; acima50: number } {
  const f = r.fases[fase];
  // Vem do armazenamento (pode estar corrompido ou ser de outra versão): só números finitos chegam à tela.
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return { n: num(f.n), p95Ms: num(f.p95Ms), acima50: num(f.acima?.["50"]) };
}

/** O fps REAL entregue pela câmera numa fase, para a lista de Ajustes: o contado por quadro entregue; sem ele (relatório antigo, sem `requestVideoFrameCallback`), o total de quadros do <video> pela duração da medição; senão nulo. */
export function fpsRealDaFase(r: RelatorioDeDesempenho, fase: FaseDeMedicao): number | null {
  const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
  const f = r.cameraEntregue?.[fase]?.fps;
  if (ok(f)) return f;
  const g = r.quadrosDoVideo?.fpsReal;
  return ok(g) ? g : null;
}

/** O fps configurado da câmera (`getSettings`, NÃO o entregue), ou nulo. */
export function fpsConfigurado(r: RelatorioDeDesempenho): number | null {
  const v = r.cameraReal?.fps;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** O arquivo que a pessoa compartilha: TODOS os relatórios guardados, com a versão do app e a data da exportação. */
export function arquivoDeRelatorios(relatorios: readonly RelatorioDeDesempenho[], app: string, exportadoEm: string) {
  return { formato: "nicska-desempenho/1", app, exportadoEm, relatorios };
}
