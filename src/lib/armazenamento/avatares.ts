// A foto do perfil de cada atirador (loja `avatares`, chaveada pelo id do atirador): uma imagem pequena (256 x 256), só neste aparelho.
import { pedido, transacao } from "../banco";
import { ArmazenamentoDeTentativas } from "./tentativas";

export type Avatar = { dados: Blob; tipo: string; atualizadoEm: number };

export class ArmazenamentoDeAvatares extends ArmazenamentoDeTentativas {
  /** Guarda (ou troca) a foto do atirador. */
  async salvarAvatar(atiradorId: string, dados: Blob): Promise<void> {
    const b = await this.abrir();
    const avatar: Avatar = { dados, tipo: dados.type, atualizadoEm: Date.now() };
    await transacao(b, ["avatares"], "readwrite", (t) => {
      t.objectStore("avatares").put(avatar, atiradorId);
    });
  }

  /** A foto do atirador, ou nulo se não há. */
  async lerAvatar(atiradorId: string): Promise<Avatar | null> {
    const b = await this.abrir();
    const a = await transacao(b, ["avatares"], "readonly", (t) => pedido(t.objectStore("avatares").get(atiradorId) as IDBRequest<Avatar | undefined>));
    return a ?? null;
  }

  async apagarAvatar(atiradorId: string): Promise<void> {
    const b = await this.abrir();
    await transacao(b, ["avatares"], "readwrite", (t) => {
      t.objectStore("avatares").delete(atiradorId);
    });
  }
}
