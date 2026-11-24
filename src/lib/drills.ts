// Os percursos-modelo do app com id ESTÁVEL (CONS-026): o ranking agrupa por `percurso.id`, então duas pessoas que escolhem a mesma sugestão ("Bill Drill")
// precisam do mesmo id para se comparar. Percursos criados à mão continuam com id aleatório; os já existentes não são migrados nem fundidos por nome.
import { DRILLS_PRONTOS } from "./documento";
import { normalizar } from "./nomesDePercurso";

type Pronto = (typeof DRILLS_PRONTOS)[number];

/** O id de cada sugestão pelo nome (o nome de "Saque" muda com o idioma, mas o id não). Fixo para sempre: mudar um id separa os rankings. */
const IDS: Record<string, string> = {
  "Bill Drill": "drill-bill-drill",
  "El Presidente": "drill-el-presidente",
  Mozambique: "drill-mozambique",
  "Saque (1 disparo)": "drill-saque",
};

/** O id estável do drill que a pessoa ESCREVEU, se o nome for o de um percurso-modelo (sem acento nem maiúsculas; também o nome traduzido). O app não oferece mais esses nomes
 *  prontos, mas quem escreve "bill drill" continua no mesmo percurso.id de todo mundo e o ranking segue juntando as pessoas. */
export function idEstavelPorNome(nome: string, traduzir: (d: Pronto) => string = (d) => d.nome): string | null {
  const alvo = normalizar(nome);
  const d = DRILLS_PRONTOS.find((x) => normalizar(x.nome) === alvo || normalizar(traduzir(x)) === alvo);
  return d ? idDoDrill(d) : null;
}

/** O id estável da sugestão (sempre o mesmo, em qualquer aparelho e idioma). */
export const idDoDrill = (d: Pronto): string => IDS[d.nome];
