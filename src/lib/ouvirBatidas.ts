// A escuta das batidas no celular (I-01) como função solta, fora da tela: liga o acelerômetro, a espera do padrão e a trava de tela (`wakeLock`).
// A tela fica ligada enquanto espera, porque a WebView para de ler sensores com a tela apagada; por isso a espera de início tem limite de tempo.
// A trava é solta ao desistir (CONS-019) e pedida de novo ao voltar ao primeiro plano, porque o sistema a derruba ao esconder o app (telaAcesa.ts).
import { DetectorDeBatidas, magnitude, type Alvo } from "./batidas";
import { manterTelaAcesa } from "./telaAcesa";
import { MedidorDeTaxa, guardarTaxaDoSensor } from "./taxaDoSensor";

export type OpcoesDeBatidas = {
  /** Nada vale nesse começo (ms): o toque que iniciou ainda sacode o aparelho. */
  graciaMs?: number;
  /** Desiste depois disso (ms): solta o sensor e a trava e chama `aoEsgotar`. */
  esgotarEm?: number;
  aoEsgotar?: () => void;
  /** O sensor entregou dado (`ok`) ou nada veio em 2 s (`sem`). */
  aoSensor?: (estado: "ok" | "sem") => void;
  /** A taxa real do sensor (Hz), a cada leitura depois de haver dados suficientes; também fica guardada em `ultimaTaxaDoSensor()`. */
  aoTaxa?: (hz: number) => void;
};

const ESPERA_DO_SENSOR_MS = 2000;
const PERIODO_DO_SILENCIO_MS = 100;

/** Liga a escuta das batidas; devolve o desligar. Quando o padrão `alvo` se completa chama `aoPadrao` (uma vez). */
export function ouvirBatidas(alvo: Alvo, aoPadrao: () => void, op: OpcoesDeBatidas = {}): () => void {
  const detector = new DetectorDeBatidas(alvo);
  const desde = performance.now() + (op.graciaMs ?? 0);
  let vivo = true;
  let viuSensor = false;
  const medidor = new MedidorDeTaxa();
  const disparar = () => {
    if (!vivo || document.hidden || performance.now() < desde) return;
    vivo = false;
    aoPadrao();
  };
  const aoMover = (e: DeviceMotionEvent) => {
    const m = magnitude(e.accelerationIncludingGravity);
    if (m === null || !vivo) return;
    viuSensor = true;
    const hz = medidor.amostra(e.timeStamp, e.interval);
    if (hz !== null) {
      guardarTaxaDoSensor(hz);
      op.aoTaxa?.(hz);
    }
    op.aoSensor?.("ok");
    if (performance.now() < desde) return detector.reiniciar();
    if (detector.amostra(e.timeStamp, m)) disparar();
  };
  const semSensor = setTimeout(() => {
    if (!viuSensor) op.aoSensor?.("sem");
  }, ESPERA_DO_SENSOR_MS);
  const silencio = setInterval(() => {
    if (vivo && performance.now() >= desde && detector.tempo(performance.now())) disparar();
  }, PERIODO_DO_SILENCIO_MS);
  window.addEventListener("devicemotion", aoMover);
  const trava = manterTelaAcesa();

  const desligar = () => {
    vivo = false;
    clearTimeout(semSensor);
    clearTimeout(esgotar);
    clearInterval(silencio);
    window.removeEventListener("devicemotion", aoMover);
    trava.soltar();
  };
  // Esgotou: solta o sensor e a tela já (e não só quando a aba mudar de estado).
  const esgotar = op.esgotarEm
    ? setTimeout(() => {
        desligar();
        op.aoEsgotar?.();
      }, op.esgotarEm)
    : undefined;
  return desligar;
}
