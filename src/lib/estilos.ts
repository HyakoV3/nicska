// Estilos de cor do app (paletas em src/lib/tema.css). O modo (Automático, Claro, Escuro) é outra escolha, em
// src/lib/tema.svelte.ts: cada estilo tem versão clara e escura, então as duas escolhas se combinam (6 paletas).
//
//   normal      a identidade do Nicska: cinza azulado e preto-azulado; ações azuis, tempos vermelhos
//   titanio     neutros metálicos e grafite; ações em azul-petróleo
//   telemetria  azuis técnicos: azul-gelo no claro e azul-marinho profundo no escuro
// Quem já tinha escolhido os estilos antigos do projeto de origem ("pergaminho", "marinho") é migrado: ver `migrarEstilo`.
//
// O script de src/app.html aplica o estilo salvo antes da primeira pintura e repete esta lista à mão:
// tests/estilos.test.ts confere que as duas continuam iguais.

/** Chave do localStorage onde o estilo é guardado. O script de src/app.html lê a mesma chave (conferido em tests/). */
export const CHAVE_ESTILO = "estilo";

export const ESTILOS = ["normal", "titanio", "telemetria"] as const;
export type Estilo = (typeof ESTILOS)[number];

export const ehEstilo = (x: unknown): x is Estilo => typeof x === "string" && (ESTILOS as readonly string[]).includes(x);

/** Valores que o projeto de origem guardava e que passam a outro estilo (pergaminho → titânio, marinho → telemetria). */
export const ESTILOS_ANTIGOS: Readonly<Record<string, Estilo>> = { pergaminho: "titanio", marinho: "telemetria" };

/** O estilo certo para um valor guardado: o próprio, o que substitui um antigo, ou "normal" se não vale. */
export const migrarEstilo = (x: unknown): Estilo => (ehEstilo(x) ? x : typeof x === "string" && Object.hasOwn(ESTILOS_ANTIGOS, x) ? ESTILOS_ANTIGOS[x] : "normal");
