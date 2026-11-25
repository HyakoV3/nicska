// O diagnóstico de DESEMPENHO da gravação ao vivo na tela cheia: mede o que o aparelho entrega enquanto a câmera, os dois gravadores (áudio e vídeo), o detector
// e o overlay trabalham juntos, para achar o que trava. Módulo puro: o relógio, o requestAnimationFrame e os observadores entram por `DepsDoMedidor`
// (desempenhoNavegador.ts liga os do navegador), então tudo se testa sem tela. O custo por quadro é uma subtração, um contador e uma escrita numa lista de
// tamanho fixo. Mede, por FASE ("standby" = antes do apito, "correndo" = escutando): os intervalos entre quadros (média, p50, p95, p99, máximo, quantos
// passaram de 33, 50 e 100 ms); e, no total: as tarefas longas (PerformanceObserver "longtask"), os quadros descartados da prévia, os intervalos entre os
// pedaços do MediaRecorder de vídeo e o ambiente (aparelho, câmera real, preferências). O relatório é um JSON pequeno; os 10 últimos ficam no aparelho.
import type { PrefsLaboratorio, PrefsOverlay } from "../preferencias";
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
  quadrosDoVideo: { descartados: number; total: number } | null;
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
  /** As configurações reais da câmera agora, ou nulo. */
  cameraReal?: () => ConfigDaCamera | null;
};

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

  constructor(private readonly d: DepsDoMedidor) {}

  get medindo(): boolean {
    return this.ativo;
  }

  private novosQuadros(): Record<FaseDeMedicao, AcumuladorDeIntervalos> {
    return { standby: new AcumuladorDeIntervalos(LIMIARES_DE_QUADRO_MS, CAPACIDADE_DE_QUADROS), correndo: new AcumuladorDeIntervalos(LIMIARES_DE_QUADRO_MS, CAPACIDADE_DE_QUADROS) };
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

  /** Termina e devolve o relatório (nulo se não estava medindo). */
  parar(): RelatorioDeDesempenho | null {
    if (!this.ativo || !this.contexto) return null;
    this.ativo = false;
    this.d.cancelarQuadro(this.idDoQuadro);
    this.soltarLongas?.();
    this.capturarCamera();
    const fim = this.d.qualidadeDoVideo?.() ?? null;
    const ini = this.videoInicio;
    return {
      versao: 1,
      quando: this.d.agoraIso(),
      duracaoMs: Math.round(this.d.agora() - this.inicioMs),
      ...this.contexto,
      cameraReal: this.camera,
      fases: { standby: this.quadros.standby.resumo(), correndo: this.quadros.correndo.resumo() },
      tarefasLongas: { suportado: this.soltarLongas !== null, n: this.longas.n, somaMs: arredondar(this.longas.somaMs), maxMs: arredondar(this.longas.maxMs) },
      quadrosDoVideo: ini && fim ? { descartados: Math.max(0, fim.descartados - ini.descartados), total: Math.max(0, fim.total - ini.total) } : null,
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

/** O arquivo que a pessoa compartilha: TODOS os relatórios guardados, com a versão do app e a data da exportação. */
export function arquivoDeRelatorios(relatorios: readonly RelatorioDeDesempenho[], app: string, exportadoEm: string) {
  return { formato: "nicska-desempenho/1", app, exportadoEm, relatorios };
}
