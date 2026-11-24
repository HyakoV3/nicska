// SPIKE S1 (EXPERIMENTAL, descartável): a montagem do relatório JSON e o nome do arquivo. Lógica pura; o relatório nunca leva áudio, vídeo nem dado pessoal além do userAgent.
import { diferencaDeIntervalos } from "./estatisticas";

export const VERSAO_RELATORIO = 1;

export type Erro = { passo: string; nome: string; mensagem: string };
export type Entrada = Record<string, unknown>;
export type PassosDoRelatorio = { camera: Entrada[]; gravacoes: Entrada[]; armazenamento: Entrada[]; compartilhar: Entrada[]; cicloDeVida: Entrada[] };
export type EntradaDeMontagem = { quando: Date; ambiente: Entrada | null; passos: PassosDoRelatorio; erros: Erro[] };

/** Nome e mensagem legíveis de qualquer coisa que tenha sido lançada. */
export function descreverErro(passo: string, e: unknown): Erro {
  if (e instanceof Error) return { passo, nome: e.name, mensagem: e.message };
  if (typeof e === "object" && e !== null && "name" in e) return { passo, nome: String((e as { name: unknown }).name), mensagem: String((e as { message?: unknown }).message ?? "") };
  return { passo, nome: "Error", mensagem: String(e) };
}

type Execucao = { modo?: string; detector?: { intervalosMs?: number[] } };

/** Para cada execução com vídeo, a diferença (ms) entre os intervalos dos estalos dela e os da primeira execução só de áudio (nulo se não dá para parear). */
export function compararComSoAudio(gravacoes: Entrada[]): Entrada[] {
  const todas = gravacoes as Execucao[];
  const base = todas.find((g) => g.modo === "audio")?.detector?.intervalosMs;
  if (!base) return [];
  return todas.filter((g) => g.modo !== "audio").map((g) => ({ modo: g.modo, diferencaDeIntervalosMs: diferencaDeIntervalos(base, g.detector?.intervalosMs ?? []) }));
}

export function montarRelatorio({ quando, ambiente, passos, erros }: EntradaDeMontagem): Entrada {
  return {
    versao: VERSAO_RELATORIO,
    quando: quando.toISOString(),
    ambiente,
    camera: passos.camera,
    gravacoes: passos.gravacoes,
    comparacaoComSoAudio: compararComSoAudio(passos.gravacoes),
    armazenamento: passos.armazenamento,
    compartilhar: passos.compartilhar,
    cicloDeVida: passos.cicloDeVida,
    erros,
  };
}

/** "nicska-spike-s1-AAAAMMDD-HHMM.json" (hora local). */
export function nomeDoRelatorio(quando: Date): string {
  const d = (n: number) => String(n).padStart(2, "0");
  return `nicska-spike-s1-${quando.getFullYear()}${d(quando.getMonth() + 1)}${d(quando.getDate())}-${d(quando.getHours())}${d(quando.getMinutes())}.json`;
}

/** "nicska-spike-MODO-AAAAMMDD-HHMMSS.ext" para o vídeo de teste. */
export function nomeDoVideoDeTeste(modo: string, quando: Date, extensao: string): string {
  const d = (n: number) => String(n).padStart(2, "0");
  const data = `${quando.getFullYear()}${d(quando.getMonth() + 1)}${d(quando.getDate())}-${d(quando.getHours())}${d(quando.getMinutes())}${d(quando.getSeconds())}`;
  return `nicska-spike-${modo}-${data}.${extensao}`;
}
