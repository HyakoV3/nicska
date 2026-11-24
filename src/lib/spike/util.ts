// SPIKE S1 (EXPERIMENTAL, descartável): pequenos auxiliares do navegador usados por mais de um passo.

/** Espera o evento `nome` em `alvo`; verdadeiro se veio, falso se passou `limiteMs` (ou veio `erro`). */
export function esperarEvento(alvo: EventTarget, nome: string, limiteMs: number): Promise<boolean> {
  return new Promise((ok) => {
    const fim = (veio: boolean) => {
      clearTimeout(timer);
      alvo.removeEventListener(nome, aoVir);
      alvo.removeEventListener("error", aoErro);
      ok(veio);
    };
    const aoVir = () => fim(true);
    const aoErro = () => fim(false);
    const timer = setTimeout(() => fim(false), limiteMs);
    alvo.addEventListener(nome, aoVir, { once: true });
    alvo.addEventListener("error", aoErro, { once: true });
  });
}

export const dormir = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

/** Uma cópia só com dados simples (sem funções nem Infinity), pronta para o JSON. */
export const simples = <T>(x: T): T => JSON.parse(JSON.stringify(x ?? null)) as T;

type ComMemoria = { memory?: { usedJSHeapSize: number } };

/** `performance.memory.usedJSHeapSize` (só o Chromium tem); nulo se não existe. */
export const memoriaJs = (): number | null => (performance as unknown as ComMemoria).memory?.usedJSHeapSize ?? null;

export type Bateria = { nivel: number; carregando: boolean } | null;

/** O nível da bateria (0 a 1) se `navigator.getBattery` existe. A temperatura não tem API no navegador. */
export async function lerBateria(): Promise<Bateria> {
  const nav = navigator as unknown as { getBattery?: () => Promise<{ level: number; charging: boolean }> };
  if (!nav.getBattery) return null;
  try {
    const b = await nav.getBattery();
    return { nivel: b.level, carregando: b.charging };
  } catch {
    return null;
  }
}

/** Mede quanto tempo (ms) leva `f` e devolve com o resultado. */
export async function cronometrar<T>(f: () => Promise<T>): Promise<{ ms: number; valor: T }> {
  const t0 = performance.now();
  const valor = await f();
  return { ms: Math.round((performance.now() - t0) * 100) / 100, valor };
}
