// Ícones do app: SVG de um subset local (src/lib/icones.json), gerado por tools/gerar-icones.mjs a partir do conjunto
// "ic" (Google Material Icons) e, onde o "ic" não tem o desenho, "material-symbols" (ambos Apache-2.0). Sem rede em uso. Para acrescentar um ícone, edite NOMES no script e gere de novo.
import dados from "./icones.json";

export type IconeNome = keyof typeof dados.icones;

/** Corpo do SVG (só tags de desenho, validadas pelo gerador). */
export const corpoDoIcone = (nome: IconeNome): string => dados.icones[nome];
