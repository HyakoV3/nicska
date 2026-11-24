// A tela cheia da REPRODUÇÃO do vídeo (Revisão e Histórico). O botão nativo do <video controls> leva só o elemento <video> para a tela cheia, e o overlay (DOM
// por cima, OverlayDoVideo) fica de fora e some. Por isso o botão nativo é escondido (`controlsList="nofullscreen"`) e um botão próprio pede a tela cheia do
// PALCO, o contêiner com o vídeo e o overlay. Os controles nativos (play, barra) são parte do <video> e seguem funcionando dentro do contêiner em tela cheia:
// não foi preciso fazer controles próprios. Aqui só a parte sem Svelte: pedir/sair (com o prefixo webkit, que WebViews e Safari antigos ainda usam) e o rótulo.
// Não confundir com video/telaCheia.ts, a "tela cheia" da GRAVAÇÃO (um <dialog> com a câmera), que é outra coisa.

type ElementoCheio = Pick<HTMLElement, "requestFullscreen"> & { webkitRequestFullscreen?: () => void | Promise<void> };
type DocumentoCheio = Pick<Document, "exitFullscreen" | "fullscreenElement" | "fullscreenEnabled"> & {
  webkitExitFullscreen?: () => void | Promise<void>;
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
};

/** O navegador deixa um elemento ir à tela cheia? (A API padrão ou a com prefixo webkit.) Sem isto o botão nem aparece. */
export function telaCheiaDisponivel(doc: DocumentoCheio = document, el?: Partial<ElementoCheio>): boolean {
  const permitido = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false;
  if (!permitido) return false;
  return el === undefined || typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function";
}

/** O elemento que está em tela cheia agora (nulo se nenhum). */
export function emTelaCheia(doc: DocumentoCheio = document): Element | null {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/** O `el` é o elemento em tela cheia? */
export const estaEmTelaCheia = (el: Element | null, doc: DocumentoCheio = document): boolean => el !== null && emTelaCheia(doc) === el;

/** Pede a tela cheia do contêiner. Devolve `false` se o navegador recusar ou não souber (o botão fica como estava). */
export async function entrarTelaCheia(el: ElementoCheio): Promise<boolean> {
  try {
    if (typeof el.requestFullscreen === "function") await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
    return true;
  } catch (e) {
    console.warn("telaCheiaReproducao: o navegador recusou a tela cheia", e);
    return false;
  }
}

/** Sai da tela cheia, se houver; sem efeito (e sem erro) se não estiver nela. */
export async function sairTelaCheiaDoVideo(doc: DocumentoCheio = document): Promise<void> {
  try {
    if (!emTelaCheia(doc)) return;
    if (typeof doc.exitFullscreen === "function") await doc.exitFullscreen();
    else await doc.webkitExitFullscreen?.();
  } catch (e) {
    console.warn("telaCheiaReproducao: não foi possível sair da tela cheia", e);
  }
}

/** A chave de texto do botão: o que ele FAZ ao ser tocado. */
export const rotuloDaTelaCheia = (ativa: boolean): "revisao_video.sair_tela_cheia" | "revisao_video.tela_cheia" =>
  ativa ? "revisao_video.sair_tela_cheia" : "revisao_video.tela_cheia";
