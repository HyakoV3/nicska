// Quando a escuta do Timer deve parar por causa do Android: app em segundo plano e o serviço em primeiro plano (notificação com Parar, falha ao subir).
import { aoFalharServico, aoPararPelaNotificacao } from "./servico";
import type { Timer } from "./timer";
import type { GravadorDeVideo } from "./video/gravadorDeVideo";

/** App em segundo plano: a escuta para, a menos que o serviço do Android a tenha assumido. Devolve o desligar. */
export function cancelarAoEsconder(timer: Timer, protegida: () => boolean): () => void {
  const aoEsconder = () => {
    if (document.hidden && timer.ocupado && !protegida()) timer.cancelar();
  };
  document.addEventListener("visibilitychange", aoEsconder);
  return () => document.removeEventListener("visibilitychange", aoEsconder);
}

/** Liga a notificação do serviço Android (Parar) e a falha dele ao Timer; devolve o desligar. Sem o serviço o microfone se vai com o app em segundo plano. */
export function ligarServicoAndroid(timer: Timer, aoProteger: (protegida: boolean) => void): () => void {
  const soltarParar = aoPararPelaNotificacao(() => void timer.parar());
  const soltarFalha = aoFalharServico(() => {
    aoProteger(false);
    if (document.hidden && timer.ocupado) timer.cancelar();
  });
  return () => {
    soltarParar();
    soltarFalha();
  };
}

/**
 * App oculto ou tela bloqueada no modo vídeo (C8): a câmera para (a WebView pausa e o Android a toma), então o vídeo é finalizado como parcial.
 * O áudio segue se o serviço assumiu a escuta; senão `cancelarAoEsconder` cancela a tentativa (e o vídeo é apagado). Devolve o desligar.
 */
export function interromperVideoAoEsconder(video: Pick<GravadorDeVideo, "interromper">): () => void {
  const aoEsconder = () => {
    if (document.hidden) void video.interromper();
  };
  document.addEventListener("visibilitychange", aoEsconder);
  return () => document.removeEventListener("visibilitychange", aoEsconder);
}
