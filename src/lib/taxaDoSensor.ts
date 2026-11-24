// A taxa real do `devicemotion` (leituras por segundo que a WebView entrega). Uma batida de dedo dura poucos ms: com taxa baixa o pico cai entre duas
// amostras e o detector (batidas.ts) não o vê. Esta parte é pura: quem chama entrega o intervalo de cada evento. `e.interval` (ms no Chrome/Android; s na
// especificação antiga) vale quando existe; senão vale a diferença de `timeStamp` entre eventos. A taxa é a MEDIANA dos últimos intervalos, que ignora
// os saltos de pausa (tela apagada, app em segundo plano) em vez de os diluir como a média faria.

/** Abaixo disto (Hz) o pico de uma batida pode cair entre amostras e as batidas podem falhar. */
export const TAXA_MINIMA_BOA_HZ = 30;
/** Quantos intervalos recentes entram na mediana. */
const JANELA = 30;
/** Um intervalo maior que isto (ms) é pausa, não ritmo do sensor: não entra na conta . */
const SALTO_DE_PAUSA_MS = 1000;
/** Mínimo de intervalos para dar uma taxa. */
const MINIMO = 5;

/** O intervalo declarado pelo evento em ms (`interval` vem em ms no Chrome; um valor < 1 é em segundos), ou null se vazio ou inválido. */
export function intervaloDeclaradoMs(interval: number | null | undefined): number | null {
  if (interval === null || interval === undefined || !Number.isFinite(interval) || interval <= 0) return null;
  return interval < 1 ? interval * 1000 : interval;
}

export class MedidorDeTaxa {
  private intervalos: number[] = [];
  private ultimo: number | null = null;

  /** Registra um evento (`timeStamp` em ms, `interval` do evento se houver). Devolve a taxa atual (Hz) ou null enquanto faltam dados. */
  amostra(timeStamp: number, interval?: number | null): number | null {
    const dif = this.ultimo === null ? null : timeStamp - this.ultimo;
    this.ultimo = timeStamp;
    const decl = intervaloDeclaradoMs(interval);
    const ms = decl ?? dif;
    if (ms !== null && ms > 0 && ms < SALTO_DE_PAUSA_MS) {
      this.intervalos.push(ms);
      if (this.intervalos.length > JANELA) this.intervalos.shift();
    }
    return this.taxa();
  }

  /** A taxa em Hz (inteiro), pela mediana dos intervalos; null com poucos dados. */
  taxa(): number | null {
    if (this.intervalos.length < MINIMO) return null;
    const o = [...this.intervalos].sort((a, b) => a - b);
    const m = o.length >> 1;
    const mediana = o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
    return Math.round(1000 / mediana);
  }
}

/** O último valor medido (módulo): sobrevive à escuta, para o diagnóstico mostrar mesmo depois de ela terminar. */
let ultima: number | null = null;
export const guardarTaxaDoSensor = (hz: number | null) => {
  if (hz !== null) ultima = hz;
};
export const ultimaTaxaDoSensor = (): number | null => ultima;
export const reiniciarTaxaDoSensor = () => {
  ultima = null;
};

/** Esta taxa é baixa demais para as batidas? */
export const taxaBaixa = (hz: number): boolean => hz < TAXA_MINIMA_BOA_HZ;
