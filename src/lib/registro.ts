// Do resultado da tela de revisão para a tentativa guardada (e o que o aparelho lembra entre aberturas: o percurso escolhido e quem é o atirador).
import type { Atirador, TentativaGuardada } from "./documento";
import type { Pontos } from "./tentativa";
import type { Resultado } from "./timer";

export const novoId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export async function sha256Hex(blob: Blob): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Monta o documento da tentativa como ficou depois da revisão (disparos editados, início, ajustes do detector que valem agora). */
export async function montarTentativa(
  r: Resultado,
  percursoId: string,
  rev: { disparosMs: number[]; apagados: number; inseridos: number; inicio: "detectado" | "estimado"; sensibilidade: number; tempoMortoMs: number; pontos?: Pontos; zeroNoAudioS?: number | null },
  id: string = novoId(),
): Promise<TentativaGuardada> {
  const t: TentativaGuardada = {
    id,
    percurso_id: percursoId,
    data: r.data,
    quando: Date.parse(r.data) || Date.now(),
    atraso_ms: Math.round(r.atrasoMs),
    inicio: rev.inicio,
    disparos_ms: [...rev.disparosMs],
    editada: { apagados: rev.apagados, inseridos: rev.inseridos },
    detector: { versao: 1, sensibilidade: rev.sensibilidade, tempo_morto_ms: rev.tempoMortoMs },
  };
  if (r.incompleta) t.incompleta = true;
  if (rev.pontos) t.pontos = { ...rev.pontos };
  if (r.audio) t.audio_sha256 = await sha256Hex(r.audio.blob);
  return t;
}

/** O Salvar só vale com percurso escolhido, sem outro Salvar em andamento e com algo novo a guardar. */
export const podeSalvar = (o: { temPercurso: boolean; salvando: boolean; salva: boolean }): boolean => o.temPercurso && !o.salvando && !o.salva;

/**
 * Toque em um botão que joga fora uma tentativa: se ela NÃO está salva, o 1º toque só arma a confirmação e o 2º executa; se já está salva (ou nada a perder), executa direto.
 * Devolve se executa agora e o novo estado de "armado".
 */
export function tocarDescartavel(naoSalva: boolean, armado: boolean): { executa: boolean; armado: boolean } {
  if (!naoSalva || armado) return { executa: true, armado: false };
  return { executa: false, armado: true };
}

const CHAVE_PERCURSO = "nk.percurso";
const CHAVE_ATIRADOR = "nk.atirador";

export const percursoEscolhido = (): string | null => {
  try {
    return localStorage.getItem(CHAVE_PERCURSO);
  } catch {
    return null;
  }
};
export const escolherPercurso = (id: string | null): void => {
  try {
    if (id) localStorage.setItem(CHAVE_PERCURSO, id);
    else localStorage.removeItem(CHAVE_PERCURSO);
  } catch {
    /* sem armazenamento: a escolha vale só nesta abertura */
  }
};

/** `nomePadrao`: o nome de quem ainda não escolheu um (vem do idioma da tela; o módulo não depende do dicionário). */
export function lerAtirador(nomePadrao = "Atirador"): Atirador {
  const guardado = atiradorGuardado();
  if (guardado) return guardado;
  const a = { id: novoId(), nome: nomePadrao };
  salvarAtirador(a);
  return a;
}
/** O atirador guardado no aparelho, ou null se não há (ou está estragado). */
function atiradorGuardado(): Atirador | null {
  try {
    return atiradorValido(JSON.parse(localStorage.getItem(CHAVE_ATIRADOR) ?? "null") as Partial<Atirador> | null);
  } catch {
    return null; // usa o padrão
  }
}
function atiradorValido(x: Partial<Atirador> | null): Atirador | null {
  if (!x || typeof x.id !== "string" || typeof x.nome !== "string" || !x.nome.trim()) return null;
  const a: Atirador = { id: x.id, nome: x.nome };
  if (x.divisao) a.divisao = x.divisao;
  return a;
}
export function salvarAtirador(a: Atirador): void {
  try {
    localStorage.setItem(CHAVE_ATIRADOR, JSON.stringify(a));
  } catch {
    /* idem */
  }
}
