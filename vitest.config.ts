import { defineConfig } from "vitest/config";

// Testes automatizados da lógica do app (módulos em src/lib, sem tela). Rodar: npm test
// O teste de ponta a ponta do timer, que usa um Chrome de verdade, fica à parte: npm run test:e2e
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
