// Preferências guardadas no aparelho (localStorage). Tudo é validado ao ler (`ler`, nunca `JSON.parse` solto) e qualquer falha de armazenamento é
// ignorada: o app segue com o padrão. Os valores padrão do detector são HIPÓTESES até a Etapa 1 (docs/calibracao.md) trazer números medidos.
import { MAXIMO_DE_NOMES, type NomeLembrado } from "./nomesDePercurso";
import { normalizarQualidade, qualidadePadrao, type Qualidade } from "./video/formato";
import { ESPACO_DE_VIDEO, PRAZOS_DE_VIDEO, limitesDeVideoPadrao, type LimitesDeVideo } from "./video/politica";

/** Quais cartões de Ajustes ficam abertos. Créditos abre sempre fechado. */
export type AjustesAbertos = { aparencia: boolean; idioma: boolean };

const CHAVE_AJUSTES = "prefs.ajustes";

/** Padrão: todos fechados, cada um com o estado na linha de cima. */
export const ajustesPadrao = (): AjustesAbertos => ({ aparencia: false, idioma: false });

export function lerAjustes(): AjustesAbertos {
  const p = ajustesPadrao();
  const o = lerObjeto(CHAVE_AJUSTES);
  if (o) for (const k of Object.keys(p) as (keyof AjustesAbertos)[]) if (typeof o[k] === "boolean") p[k] = o[k];
  return p;
}

export function salvarAjustes(a: AjustesAbertos) {
  guardar(CHAVE_AJUSTES, { aparencia: a.aparencia, idioma: a.idioma });
}

/**
 * Ajustes do timer: atraso do apito (aleatório entre mínimo e máximo, em ms; fixo se iguais), sensibilidade (0 a 1), tempo morto (ms) e quanto
 * silêncio depois do último disparo encerra a escuta (ms); `batidas`: 0 desligado, ou 2 ou 3 batidas no celular para iniciar o Standby; `standbyVoz` (padrão sim), `standbyVibrar` (padrão sim) e `standbyBipe` (padrão não) são os avisos de que o Standby começou; a voz tem precedência sobre o bipe; `vibracao321` (padrão não) troca a vibração longa por 3 toques, 2 toques e, no apito, 1 toque (para quem não ouve).
 */
export type PrefsTimer = { atrasoMinMs: number; atrasoMaxMs: number; sensibilidade: number; tempoMortoMs: number; silencioMs: number; batidas: 0 | 2 | 3; standbyVibrar: boolean; standbyBipe: boolean; standbyVoz: boolean; vibracao321: boolean };

export const LIMITES_TIMER = {
  atrasoMs: { min: 0, max: 10000, passo: 500 },
  sensibilidade: { min: 0.1, max: 1, passo: 0.1 },
  tempoMortoMs: { min: 20, max: 200, passo: 10 },
  silencioMs: { min: 2000, max: 60000, passo: 1000 },
} as const;

export const timerPadrao = (): PrefsTimer => ({ atrasoMinMs: 1000, atrasoMaxMs: 4000, sensibilidade: 0.6, tempoMortoMs: 60, silencioMs: 15000, batidas: 0, standbyVibrar: true, standbyBipe: false, standbyVoz: true, vibracao321: false });

const CHAVE_TIMER = "prefs.timer";

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Os campos numéricos de `PrefsTimer` e os limites de cada um. */
const CAMPOS_NUMERICOS = [
  ["atrasoMinMs", LIMITES_TIMER.atrasoMs],
  ["atrasoMaxMs", LIMITES_TIMER.atrasoMs],
  ["sensibilidade", LIMITES_TIMER.sensibilidade],
  ["tempoMortoMs", LIMITES_TIMER.tempoMortoMs],
  ["silencioMs", LIMITES_TIMER.silencioMs],
] as const;
const CAMPOS_BOOLEANOS = ["standbyVibrar", "standbyBipe", "standbyVoz", "vibracao321"] as const;

/** Copia para `p` os campos válidos de `o` (números limitados, booleanos, `batidas` 2 ou 3). */
function mesclar(p: PrefsTimer, o: Record<string, unknown>): void {
  CAMPOS_NUMERICOS.filter(([k]) => ehNumero(o[k])).forEach(([k, l]) => (p[k] = limitar(o[k] as number, l.min, l.max)));
  CAMPOS_BOOLEANOS.filter((k) => typeof o[k] === "boolean").forEach((k) => (p[k] = o[k] as boolean));
  if (o.batidas === 2 || o.batidas === 3) p.batidas = o.batidas; // qualquer outra coisa vale desligado
}

export function lerTimer(): PrefsTimer {
  const p = timerPadrao();
  const o = lerObjeto(CHAVE_TIMER);
  if (o) mesclar(p, o);
  if (p.atrasoMaxMs < p.atrasoMinMs) p.atrasoMaxMs = p.atrasoMinMs; // o máximo nunca fica abaixo do mínimo
  return p;
}

export function salvarTimer(p: PrefsTimer) {
  guardar(CHAVE_TIMER, p);
}

/** O aviso da voz do Standby (baia vizinha) aparece uma única vez na vida do app; este flag guarda que já apareceu. */
const CHAVE_AVISO_VOZ = "prefs.avisoVozVisto";

export function lerAvisoVozVisto(): boolean {
  return lerObjeto(CHAVE_AVISO_VOZ)?.visto === true;
}

export function salvarAvisoVozVisto() {
  guardar(CHAVE_AVISO_VOZ, { visto: true });
}

// ---- Apoio ----

const ehNumero = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

function lerObjeto(chave: string): Record<string, unknown> | null {
  try {
    const bruto = localStorage.getItem(chave);
    const o = bruto ? JSON.parse(bruto) : null;
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null; // sem armazenamento ou JSON inválido: vale o padrão
  }
}

function guardar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

/** A orientação de primeiro uso (e o pré-aviso do microfone) aparece na tela do Timer até a pessoa tocar em Standby uma vez. */
const CHAVE_PRIMEIRO_STANDBY = "prefs.primeiroStandbyFeito";

export function lerPrimeiroStandbyFeito(): boolean {
  return lerObjeto(CHAVE_PRIMEIRO_STANDBY)?.feito === true;
}

export function salvarPrimeiroStandbyFeito() {
  guardar(CHAVE_PRIMEIRO_STANDBY, { feito: true });
}

/** Como registrar a tentativa: só o áudio (padrão, celular no bolso) ou áudio + vídeo (alguém filma ou tripé). Lembra a última escolha; a câmera é a traseira por padrão. */
export type Registro = { modo: "audio" | "video"; camera: "traseira" | "frontal" };

const CHAVE_REGISTRO = "prefs.registro";

export const registroPadrao = (): Registro => ({ modo: "audio", camera: "traseira" });

export function lerRegistro(): Registro {
  const p = registroPadrao();
  const o = lerObjeto(CHAVE_REGISTRO);
  if (o?.modo === "video") p.modo = "video";
  if (o?.camera === "frontal") p.camera = "frontal";
  return p;
}

export function salvarRegistro(r: Registro) {
  guardar(CHAVE_REGISTRO, r);
}

/** O aviso de privacidade do vídeo (rostos no estande, fica só no aparelho) aparece uma única vez. */
const CHAVE_AVISO_VIDEO = "prefs.avisoVideoVisto";

export function lerAvisoVideoVisto(): boolean {
  return lerObjeto(CHAVE_AVISO_VIDEO)?.visto === true;
}

export function salvarAvisoVideoVisto() {
  guardar(CHAVE_AVISO_VIDEO, { visto: true });
}

/** A qualidade do vídeo (resolução e quadros por segundo), em Ajustes → Vídeo. Padrão 720p30 (4K só a 30 fps); qualquer outra coisa guardada vale o padrão. */
const CHAVE_QUALIDADE = "prefs.videoQualidade";

export function lerQualidade(): Qualidade {
  const q = qualidadePadrao();
  const o = lerObjeto(CHAVE_QUALIDADE);
  if (o?.altura === 1080 || o?.altura === 2160) q.altura = o.altura;
  if (o?.fps === 60) q.fps = 60;
  return normalizarQualidade(q);
}

export function salvarQualidade(q: Qualidade) {
  guardar(CHAVE_QUALIDADE, q);
}

/** A retenção dos vídeos (Ajustes → Retenção): espaço reservado e prazo. O espaço é limitado ao que o controle oferece; o prazo, a 7, 30 ou 90 dias, ou nenhum. */
const CHAVE_RETENCAO = "prefs.videoRetencao";

export function lerRetencao(): LimitesDeVideo {
  const r = limitesDeVideoPadrao();
  const o = lerObjeto(CHAVE_RETENCAO);
  if (ehNumero(o?.bytes)) r.bytes = limitar(o.bytes, ESPACO_DE_VIDEO.min, ESPACO_DE_VIDEO.max);
  if (o && "dias" in o && (PRAZOS_DE_VIDEO as readonly unknown[]).includes(o.dias)) r.dias = o.dias as number | null;
  return r;
}

export function salvarRetencao(r: LimitesDeVideo) {
  guardar(CHAVE_RETENCAO, r);
}

/** O que a última limpeza de vídeos soltos apagou (só gravada quando apagou algo): itens, bytes e quando. */
const CHAVE_ORFAOS = "prefs.videoOrfaos";
export type LimpezaDeOrfaos = { n: number; bytes: number; quando: number };

export function lerLimpezaDeOrfaos(): LimpezaDeOrfaos | null {
  const o = lerObjeto(CHAVE_ORFAOS);
  return o && ehNumero(o.n) && ehNumero(o.bytes) && ehNumero(o.quando) ? { n: o.n, bytes: o.bytes, quando: o.quando } : null;
}

export function salvarLimpezaDeOrfaos(r: LimpezaDeOrfaos) {
  guardar(CHAVE_ORFAOS, r);
}

/** Os nomes de percurso que a pessoa já digitou (com os disparos), para sugerir ao criar um novo. Validados ao ler. */
const CHAVE_NOMES = "prefs.nomesDePercurso";

export function lerNomesDePercurso(): NomeLembrado[] {
  const o = lerObjeto(CHAVE_NOMES);
  if (!Array.isArray(o?.itens)) return [];
  const itens = (o.itens as unknown[]).filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null && typeof (x as { nome?: unknown }).nome === "string");
  return itens.slice(0, MAXIMO_DE_NOMES).map((x) => ({ nome: (x.nome as string).slice(0, 80), ...(ehNumero(x.disparos) ? { disparos: x.disparos } : {}) }));
}

export function salvarNomesDePercurso(itens: NomeLembrado[]) {
  guardar(CHAVE_NOMES, { itens });
}

/**
 * O overlay do vídeo (Ajustes → Overlay do vídeo e o botão no próprio player): `ligado` é o geral; as outras chaves ligam cada parte. Tudo ligado por padrão.
 * Avatar e nome desligados = dá para mostrar o vídeo sem identificar a pessoa. A posição dos blocos é fixa nesta fatia (avatar embaixo à esquerda, tempo
 * embaixo à direita, cabeçalho no alto); a posição ajustável fica para depois (docs/archive/ideia-gravar-video.md, achado 26 da revisão).
 */
export type PrefsOverlay = { ligado: boolean; avatar: boolean; nome: boolean; cabecalho: boolean; splits: boolean; marca: boolean };

const CHAVE_OVERLAY = "prefs.videoOverlay";
export const PARTES_DO_OVERLAY = ["avatar", "nome", "cabecalho", "splits", "marca"] as const;

export const overlayPadrao = (): PrefsOverlay => ({ ligado: true, avatar: true, nome: true, cabecalho: true, splits: true, marca: true });

export function lerOverlay(): PrefsOverlay {
  const p = overlayPadrao();
  const o = lerObjeto(CHAVE_OVERLAY);
  if (o) for (const k of ["ligado", ...PARTES_DO_OVERLAY] as const) if (typeof o[k] === "boolean") p[k] = o[k];
  return p;
}

export function salvarOverlay(p: PrefsOverlay) {
  guardar(CHAVE_OVERLAY, p);
}

/** O aviso do enquadramento (distância, tela acesa, privacidade) aparece numa janela uma única vez; depois a tela de enquadrar mostra só Começar e Sair. */
const CHAVE_AVISO_ENQUADRAR = "prefs.avisoEnquadrarVisto";

export function lerAvisoEnquadrarVisto(): boolean {
  return lerObjeto(CHAVE_AVISO_ENQUADRAR)?.visto === true;
}

export function salvarAvisoEnquadrarVisto() {
  guardar(CHAVE_AVISO_ENQUADRAR, { visto: true });
}
