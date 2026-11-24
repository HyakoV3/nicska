// Iniciar o Standby batendo no celular (I-01, docs/roadmap-ideas.md): 2 ou 3 batidas secas, uma atrás da outra, e o app faz o que o botão faz. As batidas vêm do
// acelerômetro (o evento `devicemotion` da WebView): não usa o microfone, gasta pouco e não confunde com o tiro do vizinho. Esta parte é pura (sem relógio nem sensor
// próprios: quem chama entrega cada amostra com o seu instante), então dá para testar com sequências inventadas.

export type Alvo = 1 | 2 | 3;

/** Quanto tempo o app espera as batidas de início antes de desistir (ms): a tela fica acesa e o sensor ligado, então não pode ser para sempre. Recomeça ao usar o timer. */
export const ESPERA_MAXIMA_DAS_BATIDAS_MS = 10 * 60_000;
/** Depois de o Standby começar, as batidas de cancelar só valem depois disto (ms): o motor de vibração e o toque que iniciou ainda sacodem o aparelho. */
export const GRACA_DO_CANCELAR_MS = 800;

export const BATIDAS = {
  /** Quanto a magnitude da aceleração precisa se afastar da sua média lenta para contar como batida (m/s²). Caminhar fica abaixo disso; uma batida de dedo passa. */
  limiar: 7,
  /** Constante de tempo da média lenta que acompanha a gravidade e a posição do aparelho (ms). */
  mediaMs: 300,
  /** Depois de uma batida, o aparelho "toca" por um tempo: nada conta dentro desta janela (ms). */
  refratarioMs: 90,
  /** Intervalo entre uma batida e a seguinte (ms): menor que o mínimo é eco; maior que o máximo recomeça a contagem. */
  intervaloMinMs: 120,
  intervaloMaxMs: 1000,
  /** Depois da última batida esperada, este silêncio confirma o padrão (se vier mais uma, não era este padrão). */
  silencioMs: 600,
} as const;

/** A magnitude da aceleração (m/s²) de um evento `devicemotion`: com a gravidade, porque nem todo aparelho entrega a aceleração linear. */
export function magnitude(a: { x: number | null; y: number | null; z: number | null } | null | undefined): number | null {
  if (!a || a.x === null || a.y === null || a.z === null || a.x === undefined || a.y === undefined || a.z === undefined) return null;
  return Math.hypot(a.x, a.y, a.z);
}

/** Atualiza a média lenta com a amostra `m` e devolve o desvio dela em relação à média de antes. */
function seguirMedia(antes: number, { m, dt }: { m: number; dt: number }, p: typeof BATIDAS): { media: number; desvio: number } {
  const desvio = Math.abs(m - antes);
  // a média lenta segue o sinal, mas não engole a batida: só se atualiza forte quando não há pico
  const alfa = desvio > p.limiar ? 0 : Math.min(1, dt / p.mediaMs);
  return { media: antes + alfa * (m - antes), desvio };
}

export class DetectorDeBatidas {
  private media: number | null = null;
  private ultimoT: number | null = null;
  private batidas: number[] = [];
  private bloqueadoAte = -Infinity;
  private refratarioAte = -Infinity;

  constructor(readonly alvo: Alvo, private readonly p: typeof BATIDAS = BATIDAS) {}

  /** Quantas batidas já foram contadas no padrão em andamento. */
  get contadas(): number {
    return this.batidas.length;
  }

  reiniciar(): void {
    this.media = null;
    this.ultimoT = null;
    this.batidas = [];
    this.bloqueadoAte = -Infinity;
    this.refratarioAte = -Infinity;
  }

  /** Uma amostra: a magnitude (m/s²) no instante `t` (ms). Devolve true quando o padrão se completou e o silêncio o confirmou. */
  amostra(t: number, m: number): boolean {
    if (!Number.isFinite(m) || !Number.isFinite(t)) return false;
    if (this.ultimoT !== null && t < this.ultimoT) return false; // amostra fora de ordem
    const dt = this.ultimoT === null ? 0 : t - this.ultimoT;
    this.ultimoT = t;
    const { media, desvio } = seguirMedia(this.media ?? m, { m, dt }, this.p);
    this.media = media;
    if (desvio > this.p.limiar && t >= this.refratarioAte) this.batida(t);
    return this.tempo(t);
  }

  /** Para checar o silêncio sem amostra nova (um temporizador). */
  tempo(t: number): boolean {
    if (this.batidas.length === this.alvo && t - this.batidas[this.batidas.length - 1] >= this.p.silencioMs) {
      this.batidas = [];
      return true;
    }
    return false;
  }

  private batida(t: number): void {
    this.refratarioAte = t + this.p.refratarioMs;
    if (t < this.bloqueadoAte) {
      this.bloqueadoAte = t + this.p.silencioMs; // ainda no meio de uma sequência errada: espera calar
      return;
    }
    this.contar(t);
  }

  /** Conta a batida `t` no padrão em andamento: intervalo longo recomeça, curto é eco, a mais invalida o padrão. */
  private contar(t: number): void {
    const ultima = this.batidas.at(-1);
    const intervalo = ultima === undefined ? null : t - ultima;
    if (intervalo !== null && intervalo > this.p.intervaloMaxMs) this.batidas = [];
    else if (intervalo !== null && intervalo < this.p.intervaloMinMs) return; // eco
    this.batidas.push(t);
    if (this.batidas.length > this.alvo) {
      // bateu a mais: não é este padrão. Zera e ignora tudo até o silêncio.
      this.batidas = [];
      this.bloqueadoAte = t + this.p.silencioMs;
    }
  }
}

type Movimento = { requestPermission?: () => Promise<"granted" | "denied"> };

async function concedida(D: Movimento): Promise<boolean> {
  try {
    return (await D.requestPermission!()) === "granted";
  } catch {
    return false;
  }
}

/** iOS e alguns navegadores pedem permissão para o sensor de movimento; no Android da WebView ela não existe e vale `true`. Chamar a partir de um toque. */
export async function pedirPermissaoDeMovimento(): Promise<boolean> {
  const D = (globalThis as { DeviceMotionEvent?: Movimento }).DeviceMotionEvent;
  if (!D) return false;
  return typeof D.requestPermission !== "function" || concedida(D);
}
