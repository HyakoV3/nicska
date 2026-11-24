// Ponte com a orientação da tela do Android (C8): gravando vídeo, girar o celular no meio deixaria o vídeo metade deitado, metade de pé. O lado Android é
// `PonteOrientacao.kt`, exposta à WebView como `window.NkOrientacao`. Fora do Android (navegador, computador, testes) a ponte não existe e nada acontece.

type Ponte = { travar?(): void; soltar?(): void };

const ponte = (): Ponte | null => (globalThis as { NkOrientacao?: Ponte }).NkOrientacao ?? null;

/** Prende a tela na orientação de agora. Devolve `true` se a ponte existe e aceitou; fora do Android, ou se ela falhar, `false` (segue girando). */
export function travarOrientacao(): boolean {
  try {
    const p = ponte();
    if (!p?.travar) return false;
    p.travar();
    return true;
  } catch (e) {
    console.warn("orientacao: a ponte da orientação falhou", e);
    return false;
  }
}

/** Devolve o giro da tela ao sistema. Sem efeito fora do Android; uma falha da ponte não sobe (quem solta está saindo de um fim ou de um erro). */
export function soltarOrientacao(): void {
  try {
    ponte()?.soltar?.();
  } catch (e) {
    console.warn("orientacao: a ponte da orientação falhou", e);
  }
}
