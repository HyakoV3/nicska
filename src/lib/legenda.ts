// A legenda SubRip (.srt) com os splits de uma tentativa, para quem edita o vídeo fora do app. Função pura: o instante zero é o apito (como em `disparos_ms`), cada
// disparo é uma entrada que vai até o próximo, e o total vem logo depois do último. Os textos chegam prontos (i18n) por `textos`, para o gerador não depender do idioma.
// Formato: índice, `HH:MM:SS,mmm --> HH:MM:SS,mmm`, texto, linha em branco; UTF-8 sem BOM, quebra de linha "\n".

export type TextosDaLegenda = {
  apito: string;
  /** O 1º disparo: o tempo desde o apito. */
  primeiro: (n: number, ms: number) => string;
  /** Os demais: o split desde o disparo anterior. */
  split: (n: number, ms: number) => string;
  total: (ms: number) => string;
};

/** Quanto o último disparo e o total ficam na tela (ms). */
export const DURACAO_ULTIMO_MS = 1000;
export const DURACAO_TOTAL_MS = 3000;

/** Tipo MIME e extensão registrados para SubRip. */
export const TIPO_SRT = "application/x-subrip";

/** `HH:MM:SS,mmm` de um instante em ms (arredondado ao ms inteiro; negativo vira zero). */
export function instanteSrt(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0;
  const p = (n: number, c: number) => String(n).padStart(c, "0");
  return `${p(Math.floor(total / 3600000), 2)}:${p(Math.floor(total / 60000) % 60, 2)}:${p(Math.floor(total / 1000) % 60, 2)},${p(total % 1000, 3)}`;
}

type Entrada = { de: number; ate: number; texto: string };

function entradasDe(disparosMs: readonly number[], x: TextosDaLegenda): Entrada[] {
  const d = disparosMs.map((v) => Math.max(0, Math.round(v))).sort((a, b) => a - b);
  const fim = (i: number) => (i + 1 < d.length ? Math.max(d[i + 1], d[i] + 1) : d[i] + DURACAO_ULTIMO_MS);
  const lista: Entrada[] = [];
  if (d[0] > 0) lista.push({ de: 0, ate: d[0], texto: x.apito });
  d.forEach((t, i) => lista.push({ de: t, ate: fim(i), texto: i === 0 ? x.primeiro(1, t) : x.split(i + 1, t - d[i - 1]) }));
  const ultimo = d[d.length - 1];
  lista.push({ de: fim(d.length - 1), ate: fim(d.length - 1) + DURACAO_TOTAL_MS, texto: x.total(ultimo) });
  return lista;
}

/** O conteúdo do .srt, ou texto vazio sem disparos (não há o que legendar). */
export function gerarSrt(disparosMs: readonly number[], textos: TextosDaLegenda): string {
  if (disparosMs.length === 0) return "";
  return entradasDe(disparosMs, textos)
    .map((e, i) => `${i + 1}\n${instanteSrt(e.de)} --> ${instanteSrt(e.ate)}\n${e.texto}\n`)
    .join("\n");
}

/** "nicska-percurso-AAAA-MM-DD-HHMM.srt" (hora local, como o nome do áudio). */
export function nomeDaLegenda(criadaEm: number, percurso?: string): string {
  const d = new Date(criadaEm);
  const dois = (n: number) => String(n).padStart(2, "0");
  const limpo = (percurso ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `nicska-${limpo ? `${limpo}-` : ""}${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}-${dois(d.getHours())}${dois(d.getMinutes())}.srt`;
}
