// Compartilhar um arquivo (áudio ou vídeo da tentativa, ou JSON) pela folha de compartilhamento do sistema (a que mostra os apps mais usados: WhatsApp etc.). No Android a WebView não abre
// essa folha sozinha, então o app tem uma ponte (`PonteCompartilhar.kt`, `window.NkCompartilhar`) que recebe o áudio em pedaços e abre a folha (`compartilhar/ponte.ts`).
// O áudio WebM/Opus da tentativa vai como Ogg/Opus (`compartilhar/arquivo.ts`). Fora do Android usa a Web Share API quando o navegador compartilha arquivos
// (`compartilhar/navegador.ts`); sem nenhuma das duas, `podeCompartilhar()` é falso e o botão nem aparece. O arquivo que outro app manda abrir: `compartilhar/recebido.ts`.
import { ehWebm, prepararOgg, type Envio } from "./compartilhar/arquivo";
import { enviarPeloNavegador, navegadorCompartilha, type Resultado } from "./compartilhar/navegador";
import { enviarPelaPonte, ponte } from "./compartilhar/ponte";
import { enviarVideoAgora } from "./compartilhar/video";

export { nomeDoArquivo, tipoSemCodec } from "./compartilhar/arquivo";
export type { Resultado } from "./compartilhar/navegador";
export { BYTES_POR_PEDACO } from "./compartilhar/ponte";
export { formaDoEnvio, nomeDoVideo, videoParaEnviar, type FormaDoEnvio } from "./compartilhar/video";
export { PREFIXO_ERRO_RECEBIDO, arquivoRecebido, interpretarRecebido, type ArquivoRecebido } from "./compartilhar/recebido";

export const podeCompartilhar = (): boolean => !!ponte() || navegadorCompartilha();

let fila: Promise<void> = Promise.resolve();

/**
 * Abre a folha de compartilhamento com o arquivo e devolve como terminou (ver `Resultado`).
 */
export function compartilharArquivo(blob: Blob, nome: string, titulo: string): Promise<Resultado> {
  return naFila(() => enviarAgora({ blob, nome, titulo }));
}

/** Um vídeo: o da tentativa como foi gravado (V2b) ou o exportado com os tempos (V3, MP4 ou WebM). MIME e extensão de vídeo, sem passar pela conversão para Ogg (compartilhar/video.ts). */
export function compartilharVideo(blob: Blob, nome: string, titulo: string): Promise<Resultado> {
  return naFila(() => enviarVideoAgora({ blob, nome, titulo }).catch(resultadoDoErro));
}

/** Um envio de cada vez: a ponte tem um arquivo em andamento só, e dois envios juntos (áudio e vídeo, por exemplo) se misturariam. */
function naFila(envio: () => Promise<Resultado>): Promise<Resultado> {
  const vez = fila.then(envio);
  fila = vez.then(() => undefined, () => undefined);
  return vez;
}

/** Como o envio terminou, para o que NÃO jogou: "original" se era WebM e a conversão para Ogg não deu. */
const resultadoDe = (foiOriginal: boolean): Resultado => (foiOriginal ? "original" : "ok");

/** A pessoa fechar a folha não é falha; o resto é. */
function resultadoDoErro(e: unknown): Resultado {
  if (e instanceof DOMException && e.name === "AbortError") return "cancelado";
  console.warn("compartilhar: falhou", e);
  return "erro";
}

/** Entrega o `envio` pela ponte (Android) ou pelo navegador; `original` é o arquivo antes da conversão (null se não houve). */
async function entregar(envio: Envio, { original, foiOriginal }: { original: Envio | null; foiOriginal: boolean }): Promise<Resultado> {
  const p = ponte();
  if (p) return (await enviarPelaPonte(p, envio)) ? resultadoDe(foiOriginal) : "erro";
  return enviarPeloNavegador(envio, { alternativa: original, jaEraOriginal: foiOriginal });
}

async function enviarAgora(original: Envio): Promise<Resultado> {
  const convertido = await prepararOgg(original);
  const foiOriginal = ehWebm(original.blob) && !convertido;
  const opcoes = { original: convertido ? original : null, foiOriginal };
  try {
    return await entregar(convertido ?? original, opcoes);
  } catch (e) {
    return resultadoDoErro(e);
  }
}
