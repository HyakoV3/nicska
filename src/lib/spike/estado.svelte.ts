// SPIKE S1 (EXPERIMENTAL, descartável): o estado do relatório (cada passo anexa o que mediu) e o último vídeo gravado (os passos 4 e 5 o usam).
import { descreverErro, type Entrada, type Erro, type PassosDoRelatorio } from "./relatorio";

type Passo = keyof PassosDoRelatorio;

export const estado = $state<{ ambiente: Entrada | null; passos: PassosDoRelatorio; erros: Erro[] }>({
  ambiente: null,
  passos: { camera: [], gravacoes: [], armazenamento: [], compartilhar: [], cicloDeVida: [] },
  erros: [],
});

/** O último vídeo de teste gravado (nulo antes do 1º). `pedacos`: um Blob por `timeslice`. */
export const ultimoVideo = $state<{ blob: Blob | null; pedacos: Blob[]; modo: string; mime: string; segundos: number }>({
  blob: null, pedacos: [], modo: "", mime: "", segundos: 0,
});

export const anexar = (passo: Passo, entrada: Entrada): void => void estado.passos[passo].push(entrada);

export const registrarErro = (passo: string, e: unknown): Erro => {
  const erro = descreverErro(passo, e);
  estado.erros.push(erro);
  return erro;
};

/** Um evento da linha do tempo do passo 6, com o `performance.now()` em ms. */
export function evento(tipo: string, detalhe: Entrada = {}): void {
  estado.passos.cicloDeVida.push({ tMs: Math.round(performance.now()), tipo, ...detalhe });
}

export function apagarRelatorio(): void {
  estado.ambiente = null;
  estado.passos = { camera: [], gravacoes: [], armazenamento: [], compartilhar: [], cicloDeVida: [] };
  estado.erros = [];
}

const liberadores = new Set<() => void>();

/** Quem mantém a câmera aberta (a pré-visualização do passo 2) registra como soltá-la; o passo 3 chama `liberarCameras` antes de gravar. */
export function registrarLiberador(f: () => void): () => void {
  liberadores.add(f);
  return () => void liberadores.delete(f);
}
export const liberarCameras = (): void => liberadores.forEach((f) => f());
