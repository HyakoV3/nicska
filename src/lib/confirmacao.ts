// Confirmação em dois toques (apagar): o 1º toque arma, o 2º, no mesmo item e dentro do prazo, confirma. Passado o prazo (ou ao cancelar) volta ao normal:
// o botão não fica armado para sempre. O visual do 2º toque é a classe `.confirmar` (+layout.svelte). Sem interface: quem usa guarda o `id` armado.

/** Quanto tempo o 2º toque fica armado. */
export const PRAZO_CONFIRMACAO_MS = 4000;

export type Confirmacao = {
  /** 1º toque no `id`: arma e devolve false. 2º toque no mesmo `id` dentro do prazo: desarma e devolve true (pode apagar). */
  pedir(id: string): boolean;
  /** Desarma sem confirmar (e para o relógio). */
  cancelar(): void;
};

/** O `id` armado e o relógio que o desarma: `definir(null)` desarma, `definir(id)` arma e (re)começa o prazo. */
function criarArmador(aoMudar: (id: string | null) => void, prazoMs: number) {
  let armado: string | null = null;
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const desarmar = () => definir(null);
  const definir = (id: string | null) => {
    clearTimeout(relogio);
    armado = id;
    aoMudar(id);
    relogio = id === null ? undefined : setTimeout(desarmar, prazoMs);
  };
  return { definir, armado: () => armado };
}

/** `aoMudar` recebe o `id` armado agora (ou null quando desarmou). */
export function criarConfirmacao(aoMudar: (id: string | null) => void, prazoMs: number = PRAZO_CONFIRMACAO_MS): Confirmacao {
  const { definir, armado } = criarArmador(aoMudar, prazoMs);
  const pedir = (id: string) => {
    const confirmou = armado() === id;
    definir(confirmou ? null : id);
    return confirmou;
  };
  const cancelar = () => armado() !== null && definir(null); // definir já limpa o relógio
  return { pedir, cancelar: () => void cancelar() };
}
