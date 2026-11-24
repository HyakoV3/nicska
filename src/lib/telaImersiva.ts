// Ponte com as barras do sistema do Android (V2b): na tela cheia do modo vídeo a câmera ocupa tudo, então a barra de status e a de navegação somem (modo
// imersivo). O lado Android é `PonteTela.kt`, exposta à WebView como `window.NkTela`. Fora do Android (navegador, computador, testes) a ponte não existe e
// nada acontece. Como a trava de tela (telaAcesa.ts), pede de novo ao voltar ao primeiro plano (o sistema pode devolver as barras ao esconder o app) e
// solta tudo no `soltar`, que quem liga chama ao sair, num erro ou ao desmontar.

type Ponte = { imersivo?(ligado: boolean): void };
type Documento = Pick<Document, "hidden" | "addEventListener" | "removeEventListener">;

const ponte = (): Ponte | null => (globalThis as { NkTela?: Ponte }).NkTela ?? null;

/** Liga ou desliga o modo imersivo. Devolve `true` se a ponte existe e aceitou; fora do Android, ou se ela falhar, `false` (as barras ficam). */
export function definirImersivo(ligado: boolean): boolean {
  try {
    const p = ponte();
    if (!p?.imersivo) return false;
    p.imersivo(ligado);
    return true;
  } catch (e) {
    console.warn("telaImersiva: a ponte da tela falhou", e);
    return false;
  }
}

export type Imersivo = { soltar: () => void };

/** Esconde as barras até o `soltar` (que pode ser chamado mais de uma vez); ao voltar ao primeiro plano, esconde de novo. */
export function manterImersivo(documento: Documento = document): Imersivo {
  let ativo = true;
  const aoVisivel = () => {
    if (ativo && !documento.hidden) definirImersivo(true);
  };
  documento.addEventListener("visibilitychange", aoVisivel);
  definirImersivo(true);
  return {
    soltar: () => {
      if (!ativo) return;
      ativo = false;
      documento.removeEventListener("visibilitychange", aoVisivel);
      definirImersivo(false);
    },
  };
}
