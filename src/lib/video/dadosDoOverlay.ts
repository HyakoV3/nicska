// A montagem dos `dados` do overlay a partir da tentativa: a MESMA para o player (VideoDaTentativa) e para o vídeo exportado com os tempos (V3), para os dois
// nunca discordarem. Função pura: o zero vem do encaixe (o da Revisão, se veio, ou o guardado ao salvar) e os disparos são os ATUAIS (os editados na Revisão,
// os salvos no Histórico). Sem encaixe (zero desconhecido) não há overlay.
import type { Percurso, TentativaGuardada } from "../documento";
import type { Pontos } from "../tentativa";
import { zeroNoVideoS, type Encaixe } from "./alinhamento";
import type { AtiradorDoOverlay, DadosDoOverlay } from "./overlay";

/** O que a tentativa diz ao overlay além do zero: disparos, pontos, selo de incompleta, quem atira, percurso, divisão e data (ISO 8601). */
export type FonteDoOverlay = {
  disparosMs: readonly number[];
  pontos?: Pontos | null;
  incompleta?: boolean;
  atirador?: AtiradorDoOverlay | null;
  percurso?: string;
  divisao?: string;
  data?: string;
};

/** Os dados do overlay, ou nulo sem zero conhecido. */
export function dadosDoOverlay(encaixe: Encaixe | null, f: FonteDoOverlay): DadosDoOverlay | null {
  if (!encaixe) return null;
  return {
    zeroNoVideoS: zeroNoVideoS(encaixe),
    disparosMs: f.disparosMs,
    pontos: f.pontos ?? null,
    incompleta: f.incompleta === true,
    atirador: f.atirador ?? null,
    percurso: f.percurso,
    divisao: f.divisao,
    data: f.data,
  };
}

/** O nome e a divisão do percurso, para o cabeçalho. */
export type PercursoDoOverlay = Pick<Percurso, "nome" | "divisao"> | null | undefined;

/** O overlay de uma tentativa SALVA (Histórico): os disparos e os pontos guardados. */
export function fonteDaTentativaSalva(x: Pick<TentativaGuardada, "disparos_ms" | "pontos" | "incompleta" | "data">, percurso: PercursoDoOverlay, atirador: AtiradorDoOverlay): FonteDoOverlay {
  return { disparosMs: x.disparos_ms, pontos: x.pontos ?? null, incompleta: x.incompleta === true, atirador, percurso: percurso?.nome, divisao: percurso?.divisao, data: x.data };
}

/** O overlay da Revisão como está AGORA: os disparos editados e os pontos da revisão; o atirador fica o deste aparelho (quem monta a entrada o lê). */
export function fonteDaRevisao(rev: { disparosMs: readonly number[]; pontos?: Pontos }, r: { incompleta?: boolean; data: string }, percurso: PercursoDoOverlay): FonteDoOverlay {
  return { disparosMs: [...rev.disparosMs], pontos: rev.pontos ?? null, incompleta: r.incompleta === true, percurso: percurso?.nome, divisao: percurso?.divisao, data: r.data };
}
