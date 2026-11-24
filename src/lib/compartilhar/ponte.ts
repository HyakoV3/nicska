// A ponte do Android (`PonteCompartilhar.kt`, `window.NkCompartilhar`): a WebView não abre a folha de compartilhamento sozinha, então o app entrega o arquivo à ponte
// em pedaços e ela abre a folha.
import { tipoSemCodec, type Envio } from "./arquivo";

export type Ponte = {
  comecar(nome: string, tipo: string): boolean;
  parte(base64: string): boolean;
  enviar(titulo: string): boolean;
  cancelar(): void;
};

/** Múltiplo de 3 bytes (o base64 de cada pedaço não leva preenchimento no meio); 192 KiB por chamada à ponte. */
export const BYTES_POR_PEDACO = 3 * 65536;

export const ponte = (): Ponte | null => (globalThis as { NkCompartilhar?: Ponte }).NkCompartilhar ?? null;

function paraBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Entrega o arquivo à ponte em pedaços. Devolve false se a ponte recusou algum (ela já descartou o arquivo). */
async function enviarPedacos(p: Ponte, blob: Blob): Promise<boolean> {
  for (let i = 0; i < blob.size; i += BYTES_POR_PEDACO) {
    const bytes = new Uint8Array(await blob.slice(i, i + BYTES_POR_PEDACO).arrayBuffer());
    if (p.parte(paraBase64(bytes))) continue;
    p.cancelar();
    return false;
  }
  return true;
}

/** Envio pela ponte do Android. Joga se falhar no meio (ler o pedaço, codificar): a ponte fecha o arquivo e apaga o que já tinha escrito. */
export async function enviarPelaPonte(p: Ponte, { blob, nome, titulo }: Envio): Promise<boolean> {
  // Sem parâmetros no tipo: o Intent do Android compara o tipo por igualdade com o que os apps declaram.
  if (!p.comecar(nome, tipoSemCodec(blob.type))) return false;
  try {
    return (await enviarPedacos(p, blob)) && p.enviar(titulo);
  } catch (e) {
    try {
      p.cancelar();
    } catch {
      /* a ponte já falhou: nada mais a fazer */
    }
    throw e;
  }
}
