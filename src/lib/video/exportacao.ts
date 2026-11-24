// Exportar o vídeo COM OS TEMPOS (V3, caminho C de docs/archive/ideia-gravar-video.md): o contrato dos motores, a escolha deles pelo que o aparelho tem e o roteiro
// de uma exportação (tela acesa, progresso, cancelar, entregar). Tudo aqui é puro ou recebe o mundo por parâmetro, para os testes usarem motores falsos.
// Dois motores com a mesma interface: (A) WebCodecs + H.264 + MP4 (motorWebCodecs.ts) e (B) o recuo em tempo real, canvas + MediaRecorder (motorTempoReal.ts).
// Um motor que descobre no meio que não serve ao vídeo (resolução que o codificador recusa, áudio que não decodifica) joga `MotorIndisponivel` e o próximo
// tenta; qualquer outra falha é erro. Cancelar aborta o `sinal`: o motor solta decoder, encoder, <video> e URLs e joga `AbortError`.
import type { TelaAcesa } from "../telaAcesa";
import type { DesenhoDoOverlay } from "./quadroComOverlay";

export type IdDoMotor = "webcodecs" | "tempo-real";

/**
 * O que o aparelho oferece (lido em capacidades.ts). `avc`: o VideoEncoder aceita H.264 numa resolução comum (a do vídeo se confere de novo ao exportar).
 * `gravador`: o tipo que o MediaRecorder grava para o motor B (MP4 se der, senão WebM), ou nulo.
 */
export type Capacidades = { webCodecs: boolean; avc: boolean; quadroAQuadro: boolean; captura: boolean; gravador: string | null };

/** Os motores que podem rodar, do preferido ao recuo: A só com WebCodecs e H.264; B só com captura do canvas e gravador. Os dois precisam do quadro a quadro. */
export function motoresPossiveis(c: Capacidades): IdDoMotor[] {
  if (!c.quadroAQuadro) return [];
  const motores: IdDoMotor[] = [];
  if (c.webCodecs && c.avc) motores.push("webcodecs");
  if (c.captura && c.gravador) motores.push("tempo-real");
  return motores;
}

/** O vídeo a exportar (montado, com a duração) e o desenho do overlay. `soltar` libera o que a preparação abriu (a foto do avatar decodificada). */
export type EntradaDaExportacao = { video: Blob; desenho: DesenhoDoOverlay; soltar?: () => void };
/** A fração feita (0 a 1), ou nulo quando não se sabe a duração. */
export type AoProgresso = (fracao: number | null) => void;
export type MotorDeExportacao = { id: IdDoMotor; exportar(entrada: EntradaDaExportacao, aoProgresso: AoProgresso, sinal: AbortSignal): Promise<Blob> };

/** O motor não serve a ESTE vídeo (não é falha da exportação): o próximo motor tenta. (Qualquer outra falha do motor também passa ao próximo; esta só dá a mensagem certa.) */
export class MotorIndisponivel extends Error {
  override name = "MotorIndisponivel";
}

export const ehAbortado = (e: unknown): boolean => e instanceof DOMException && e.name === "AbortError";
/** Joga `AbortError` se já cancelaram (os motores chamam entre um passo e outro). */
export function conferirSinal(sinal: AbortSignal): void {
  if (sinal.aborted) throw new DOMException("exportação cancelada", "AbortError");
}

/** O bitrate do H.264 exportado: o do vídeo gravado (bytes ÷ duração) com 25% a mais (o overlay tem bordas finas), entre 1 e 8 Mbps; 2 Mbps se não se sabe. */
export function bitrateDaExportacao(bytes: number, duracaoS: number): number {
  const medido = (bytes * 8) / duracaoS;
  if (!Number.isFinite(medido) || medido <= 0) return 2_000_000;
  return Math.round(Math.min(8_000_000, Math.max(1_000_000, medido * 1.25)));
}

/** O lado menor máximo do vídeo exportado (px): 1080. Um vídeo gravado em 4K sai em 1080p (o codificador de aparelho em 4K é lento e o MP4 é montado na memória: 3 min em 4K passariam de 400 MB). */
export const LADO_MENOR_MAXIMO_DA_EXPORTACAO = 1080;

/** A largura × altura do arquivo exportado (pares, como o H.264 pede): a do vídeo, ou reduzida (mesma proporção) para o lado menor não passar de 1080. */
export function tamanhoDaExportacao(largura: number, altura: number): { largura: number; altura: number } {
  const fator = Math.min(1, LADO_MENOR_MAXIMO_DA_EXPORTACAO / Math.min(largura, altura));
  const par = (n: number) => Math.max(2, Math.round((n * fator) / 2) * 2);
  return { largura: par(largura), altura: par(altura) };
}

/** "nicska-percurso-2026-11-23-1407.webm" → "nicska-percurso-2026-11-23-1407-tempos.mp4": a extensão é a do arquivo exportado. */
export function nomeComTempos(nomeCru: string, tipo: string): string {
  const ext = tipo.split(";")[0].trim().toLowerCase() === "video/mp4" ? "mp4" : "webm";
  return `${nomeCru.replace(/\.[a-z0-9]+$/i, "")}-tempos.${ext}`;
}

/** Como terminou: o resultado da entrega ("cancelado" = fechou a folha sem enviar), "interrompida" (a pessoa parou a exportação), "sem" (não havia vídeo ou zero) ou "erro". */
export type FimDaExportacao = "ok" | "original" | "cancelado" | "erro" | "sem" | "interrompida";

/** O que uma exportação usa do mundo: preparar a entrada, os motores na ordem, a entrega e a tela acesa. */
export type PassosDaExportacao = {
  preparar: (sinal: AbortSignal) => Promise<EntradaDaExportacao | null>;
  motores: readonly MotorDeExportacao[];
  entregar: (blob: Blob) => Promise<"ok" | "original" | "cancelado" | "erro">;
  manterTelaAcesa: () => TelaAcesa;
};
/** O que a janela acompanha: o progresso e qual motor está rodando (o B avisa que demora o tamanho do vídeo). */
export type Acompanhamento = { aoProgresso: AoProgresso; aoMotor: (id: IdDoMotor) => void; aoEntregar: () => void; aoFalhar?: (detalhe: string) => void };

/** Onde a exportação estava quando falhou e o que o navegador disse, numa linha curta ("motor webcodecs: NotSupportedError: ..."), para a mensagem ser específica. */
export function detalheDaFalha(etapa: string, e: unknown): string {
  const nome = e instanceof Error || (typeof e === "object" && e !== null && "name" in e) ? String((e as { name: unknown }).name) : "";
  const texto = e instanceof Error ? e.message : String(e ?? "");
  const resto = [nome, texto].filter(Boolean).join(": ").replace(/\s+/g, " ").slice(0, 160);
  return resto ? `${etapa} — ${resto}` : etapa;
}

/** Uma falha com o nome da etapa em que ocorreu (preparar, o motor, entregar). */
class EtapaFalhou extends Error {
  constructor(readonly etapa: string, readonly causa: unknown) {
    super(etapa);
  }
}

/** Tenta os motores na ordem; `MotorIndisponivel` passa ao próximo; sem nenhum que sirva, `MotorIndisponivel`. */
async function rodarMotores(motores: readonly MotorDeExportacao[], entrada: EntradaDaExportacao, a: Acompanhamento, sinal: AbortSignal): Promise<Blob> {
  const motivos: string[] = [];
  for (const m of motores) {
    conferirSinal(sinal);
    a.aoMotor(m.id);
    a.aoProgresso(0);
    try {
      return await m.exportar(entrada, a.aoProgresso, sinal);
    } catch (e) {
      // Cancelar sai na hora. Qualquer outra falha (o motor não serve, ou quebrou no meio) passa ao próximo motor: melhor um recuo mais lento do que nenhum vídeo.
      if (ehAbortado(e) || sinal.aborted) throw e;
      console.warn(`exportar: o motor ${m.id} falhou`, e);
      motivos.push(`${m.id}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120));
    }
  }
  throw new EtapaFalhou("motores", new Error(motivos.length ? `nenhum serve (${motivos.join("; ")})` : "nenhum motor disponível"));
}

/** Uma exportação inteira: tela acesa do começo ao fim, preparar, exportar, entregar. Nunca joga: devolve como terminou e sempre solta tela e entrada. */
export async function exportarEEntregar(p: PassosDaExportacao, a: Acompanhamento, sinal: AbortSignal): Promise<FimDaExportacao> {
  const tela = p.manterTelaAcesa();
  let entrada: EntradaDaExportacao | null = null;
  try {
    entrada = await p.preparar(sinal).catch((e) => {
      throw new EtapaFalhou("preparar", e);
    });
    if (!entrada) return "sem";
    const blob = await rodarMotores(p.motores, entrada, a, sinal);
    conferirSinal(sinal);
    a.aoEntregar();
    return await p.entregar(blob).catch((e) => {
      throw new EtapaFalhou("entregar", e);
    });
  } catch (e) {
    const falha = e instanceof EtapaFalhou ? e : new EtapaFalhou("exportar", e);
    if (ehAbortado(falha.causa) || sinal.aborted) return "interrompida";
    console.warn("exportar: falhou", falha.etapa, falha.causa);
    a.aoFalhar?.(detalheDaFalha(falha.etapa, falha.causa));
    return "erro";
  } finally {
    entrada?.soltar?.();
    tela.soltar();
  }
}
