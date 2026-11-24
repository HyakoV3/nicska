// Limpeza dos vídeos soltos (ver orfaos.ts) ao abrir o app: em segundo plano, depois de a tela subir, em lotes. Falha em silêncio (é só faxina).
import { armazenamento } from "../armazenamento";
import { salvarLimpezaDeOrfaos } from "../preferencias";

/** O começo desta sessão do app: o módulo é carregado na abertura, antes de qualquer gravação. */
export const INICIO_DA_SESSAO = Date.now();
const ATRASO_MS = 3000;
let rodou = false;

/** Roda uma vez por sessão; guarda o resultado para Ajustes → Retenção só quando algo foi apagado. */
export function limparOrfaosAoAbrir(): void {
  if (rodou) return;
  rodou = true;
  setTimeout(() => {
    armazenamento
      .limparOrfaos(INICIO_DA_SESSAO)
      .then((r) => r.n > 0 && salvarLimpezaDeOrfaos({ ...r, quando: Date.now() }))
      .catch((e) => console.warn("video: a limpeza dos vídeos soltos falhou", e));
  }, ATRASO_MS);
}
