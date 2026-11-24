import { describe, expect, it } from "vitest";
import { DRILLS_PRONTOS } from "../src/lib/documento";
import { idDoDrill } from "../src/lib/drills";

// CONS-026 (RANK-001): duas pessoas que escolhem a mesma sugestão precisam do mesmo percurso.id para o ranking juntá-las.
describe("ids estáveis dos percursos-modelo", () => {
  it("cada sugestão tem id próprio, não vazio e único", () => {
    const ids = DRILLS_PRONTOS.map(idDoDrill);
    expect(ids.every((i) => typeof i === "string" && i.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("os ids são fixos (mudar um separa os rankings: só com migração consciente)", () => {
    expect(DRILLS_PRONTOS.map(idDoDrill)).toEqual(["drill-bill-drill", "drill-el-presidente", "drill-mozambique", "drill-saque"]);
  });

  it("é determinístico: chamar de novo dá o mesmo id (não é aleatório)", () => {
    expect(idDoDrill(DRILLS_PRONTOS[0])).toBe(idDoDrill(DRILLS_PRONTOS[0]));
  });
});
