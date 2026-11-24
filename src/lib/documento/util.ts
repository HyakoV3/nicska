// Pequenos auxiliares dos leitores e escritores de documento.

/** `valor` se `ok` (verdadeiro), senão nada: para espalhar um campo opcional num objeto (`...opcional(x, { x })`). */
export const opcional = <T extends object>(ok: unknown, valor: T): T | Record<never, never> => (ok ? valor : {});

/** Um texto opcional cortado em `max` caracteres; vazio se não for texto. */
export const textoCurto = (x: unknown, max: number): string => (typeof x === "string" ? x.slice(0, max) : "");

/** A mensagem de um erro jogado (qualquer coisa pode ser jogada). */
export const mensagemDe = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Os `id` de `itens`, como conjunto. */
export const idsDe = (itens: readonly { id: string }[]): ReadonlySet<string> => new Set(itens.map((i) => i.id));
