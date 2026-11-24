// Formatos de tempo e número do Histórico, no idioma da interface (as funções leem o idioma a cada chamada, então acompanham a troca).
import { i18n } from "./i18n/index.svelte";
import { formatarSegundos } from "./tentativa";

export const seg = (ms: number): string => formatarSegundos(ms, i18n.idioma);
export const data = (ms: number): string => new Intl.DateTimeFormat(i18n.idioma, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
export const hora = (ms: number): string => new Intl.DateTimeFormat(i18n.idioma, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
export const num = (v: number, casas: number): string => new Intl.NumberFormat(i18n.idioma, { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);
/** A mensagem de um erro qualquer. */
export const motivo = (e: unknown): string => (e instanceof Error ? e.message : String(e));
