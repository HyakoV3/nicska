// Bateria e economia de energia, para o diagnóstico de desempenho e para o aviso da tela cheia de gravação: com pouca bateria e a economia de energia ligada, o
// Android limita CPU e câmera e o vídeo pode travar. A bateria vem da API do navegador (`navigator.getBattery`, que o WebView pode não ter); a economia e o
// estado térmico vêm da ponte `PonteEnergia.kt` (`window.NkEnergia`). Tudo é opcional: o que o aparelho não diz fica nulo, e nada aqui lança.

export type EstadoDeBateria = { /** 0 a 1 */ nivel: number; carregando: boolean };
export type Energia = {
  /** Economia de energia do sistema ligada? Nulo se não há ponte (navegador, testes) ou ela falhou. */
  economia: boolean | null;
  /** `PowerManager.currentThermalStatus` (0 nenhum ... 6 desligando; Android 10+), ou nulo. */
  termico: number | null;
};

/** O que a ponte Kotlin expõe: `economia()` devolve 1, 0 ou -1 (não sabe) e `termico()` devolve o estado ou -1. */
type Ponte = { economia?(): number; termico?(): number };
const ponte = (): Ponte | null => (globalThis as { NkEnergia?: Ponte }).NkEnergia ?? null;

/** A economia de energia e o estado térmico agora. Sem ponte, ou com ela falhando, tudo nulo. */
export function lerEnergia(p: Ponte | null = ponte()): Energia {
  const v: Energia = { economia: null, termico: null };
  if (!p) return v;
  try {
    const e = p.economia?.();
    v.economia = e === 1 ? true : e === 0 ? false : null;
  } catch {
    /* fica nulo */
  }
  try {
    const t = p.termico?.();
    v.termico = typeof t === "number" && Number.isInteger(t) && t >= 0 ? t : null;
  } catch {
    /* fica nulo */
  }
  return v;
}

type GerenteDeBateria = { level?: number; charging?: boolean };
const estadoDe = (g: GerenteDeBateria): EstadoDeBateria | null =>
  typeof g.level === "number" && Number.isFinite(g.level) && typeof g.charging === "boolean" ? { nivel: Math.min(1, Math.max(0, g.level)), carregando: g.charging } : null;

/** Um leitor vivo da bateria (o `BatteryManager` guarda os valores de agora), ou nulo se o navegador não tem a API ou ela falha. */
export async function abrirBateria(nav: { getBattery?: () => Promise<GerenteDeBateria> } | undefined = globalThis.navigator as never): Promise<(() => EstadoDeBateria | null) | null> {
  try {
    const g = await nav?.getBattery?.();
    return g ? () => estadoDe(g) : null;
  } catch {
    return null;
  }
}

/** Bateria baixa: no máximo 15% e fora da tomada. */
export const NIVEL_DE_BATERIA_BAIXA = 0.15;

/** Mostra o aviso "bateria baixa ou economia de energia"? Sim se a economia está ligada, ou se a bateria está em 15% ou menos e não carrega. Dado nulo (não sabe) não avisa. */
export function avisoDeEnergia(bateria: EstadoDeBateria | null, economia: boolean | null): boolean {
  if (economia === true) return true;
  return !!bateria && !bateria.carregando && bateria.nivel <= NIVEL_DE_BATERIA_BAIXA;
}
