// A gravação do áudio da tentativa, que corre no mesmo fluxo do detector: guarda um pedaço por segundo (uma queda no meio ainda deixa o que já foi gravado)
// e entrega o áudio inteiro ao parar. Separada da `Escuta` (src/lib/escuta.ts), que só cuida do microfone e do detector.
import type { Fabricas } from "./escutaNavegador";

/** Quanto se espera o gravador avisar que parou antes de entregar o que já tem (ms). */
const LIMITE_PARA_PARAR_MS = 4000;

export class GravadorDaEscuta {
  private gravador: MediaRecorder | null = null;
  private pedacos: Blob[] = [];
  private tipo = "";

  constructor(private readonly fabricas: Pick<Fabricas, "gravador">) {}

  /** Começa a gravar o `fluxo`. `aoErro`: o gravador falhou no meio. Sem gravador no aparelho, não faz nada. */
  iniciar(fluxo: MediaStream, aoErro: () => void): void {
    const novo = this.fabricas.gravador(fluxo);
    if (!novo) return;
    this.gravador = novo.gravador;
    this.tipo = novo.tipo;
    this.pedacos = [];
    novo.gravador.ondataavailable = (e) => {
      if (e.data.size > 0) this.pedacos.push(e.data);
    };
    novo.gravador.onerror = aoErro;
    novo.gravador.start(1000);
  }

  /** Para e entrega o áudio gravado (e o formato); nulo se não havia gravador. Não solta o gravador: chamar `soltar` depois. */
  async parar(): Promise<{ blob: Blob; tipo: string } | null> {
    const g = this.gravador;
    if (!g) return null;
    if (g.state !== "inactive") await this.pararEAguardar(g);
    return { blob: new Blob(this.pedacos, { type: this.tipo }), tipo: this.tipo };
  }

  private pararEAguardar(g: MediaRecorder): Promise<void> {
    return new Promise<void>((ok) => aguardarParada(g, ok));
  }

  /** Esquece a gravação; se ainda corria, para sem esperar. */
  soltar(): void {
    const g = this.gravador;
    this.gravador = null;
    this.pedacos = [];
    if (!g) return;
    g.ondataavailable = null;
    g.onerror = null;
    g.onstop = null;
    if (g.state !== "inactive") pararSemErro(g);
  }
}

/** Para o gravador; falso se ele já estava parado (e `stop` lançou). */
function pararSemErro(g: MediaRecorder): boolean {
  try {
    g.stop();
    return true;
  } catch {
    return false; // já parado
  }
}

/** Para o gravador e chama `ok` quando ele avisa que parou (ou quando o limite passa, ou se já estava parado). Usado também pelo gravador do vídeo. */
export function aguardarParada(g: MediaRecorder, ok: () => void): void {
  const limite = setTimeout(ok, LIMITE_PARA_PARAR_MS);
  const fim = () => {
    clearTimeout(limite);
    ok();
  };
  g.onstop = fim;
  if (!pararSemErro(g)) fim();
}
