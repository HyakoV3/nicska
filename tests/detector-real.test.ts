import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analisar, temposEmMs } from "../src/lib/detector";
import { lerWav } from "./wav";

// Áudio real de dois treinos (9 mm e .22). AINDA SEM GABARITO de tiros: estes testes só travam o que se confere no gráfico da onda
// (o apito e o primeiro tiro depois dele) e que a cauda de cada tiro não vira disparos extras. A contagem exata vem com o gabarito (Etapa 1).
const casos = [
  { arquivo: "tests/fixtures/treino-9mm.wav", apito: 3.536, primeiro: 6.06 },
  { arquivo: "tests/fixtures/treino-22.wav", apito: 4.3, primeiro: 5.74 },
];

describe.skipIf(casos.some((c) => !existsSync(c.arquivo)))("detector em áudio real", () => {
  for (const c of casos) {
    it(`${c.arquivo}: apito a ${c.apito} s e primeiro tiro a ${c.primeiro} s`, () => {
      const { amostras, taxa } = lerWav(c.arquivo);
      const r = analisar(amostras, taxa);
      expect(r.apito).not.toBeNull();
      expect(Math.abs(r.apito! / taxa - c.apito)).toBeLessThan(0.02);
      const t = temposEmMs(r, taxa)!;
      expect(t.inicio).toBe("detectado");
      expect(Math.abs(t.disparos_ms[0] - (c.primeiro - c.apito) * 1000)).toBeLessThan(25);
      // disparos crescentes, nenhum colado ao anterior (tempo morto) e nenhum antes do apito
      for (let i = 1; i < t.disparos_ms.length; i++) expect(t.disparos_ms[i] - t.disparos_ms[i - 1]).toBeGreaterThanOrEqual(50);
      expect(t.disparos_ms.every((m) => m >= 0)).toBe(true);
    });
  }
});
