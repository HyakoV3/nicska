// A trava de tela (`navigator.wakeLock`): usada pelas batidas (a WebView para de ler sensores com a tela apagada) e pelo modo vídeo (a câmera para com a
// tela apagada, C8). Pede a trava, pede de novo ao voltar ao primeiro plano (o sistema a derruba ao esconder o app) e solta tudo no `soltar` (CONS-019).
// Sem `wakeLock` no aparelho, não faz nada. O ambiente entra por parâmetro só para os testes; o app usa o do navegador.

type Documento = Pick<Document, "hidden" | "addEventListener" | "removeEventListener">;
export type AmbienteDaTela = { wakeLock?: WakeLock; documento?: Documento };

export type TelaAcesa = { soltar: () => void };

/** A trava de uma vez: viva do `manterTelaAcesa` até o `soltar`. */
class Trava {
  private sentinela: WakeLockSentinel | null = null;
  private ativa = true;
  private pedindo = false;
  private readonly aoVisivel = () => {
    if (!this.documento.hidden) this.pedir();
  };

  constructor(
    private readonly wakeLock: () => WakeLock | undefined,
    private readonly documento: Documento,
  ) {
    documento.addEventListener("visibilitychange", this.aoVisivel);
    this.pedir();
  }

  private pedir(): void {
    const wl = this.wakeLock();
    if (!this.ativa || this.pedindo || this.sentinela || this.documento.hidden || !wl) return;
    this.pedindo = true;
    wl.request("screen").then((w) => this.guardar(w), () => (this.pedindo = false));
  }

  private guardar(w: WakeLockSentinel): void {
    this.pedindo = false;
    if (!this.ativa) return void w.release(); // soltaram enquanto o pedido corria
    this.sentinela = w;
    w.addEventListener?.("release", () => {
      if (this.sentinela === w) this.sentinela = null; // o sistema a derrubou (app escondido): ao voltar, pede de novo
    });
  }

  soltar(): void {
    this.ativa = false;
    this.documento.removeEventListener("visibilitychange", this.aoVisivel);
    const w = this.sentinela;
    this.sentinela = null;
    void w?.release();
  }
}

/** Mantém a tela acesa até o `soltar` (que pode ser chamado mais de uma vez). */
export function manterTelaAcesa(a: AmbienteDaTela = {}): TelaAcesa {
  const wakeLock = () => a.wakeLock ?? (globalThis.navigator as Navigator | undefined)?.wakeLock;
  const trava = new Trava(wakeLock, a.documento ?? document);
  return { soltar: () => trava.soltar() };
}
