// A cor dos ícones das barras do sistema (status e navegação) no Android. O Android escolhe sozinho pelo tema do SISTEMA, mas o app tem o seu
// próprio (Claro, Escuro, estilo e Alto contraste): com o tema escuro forçado num aparelho claro (ou o contrário) a hora e a bateria ficariam
// escuras sobre fundo escuro. Aqui se mede o fundo REAL da tela (o token --fundo já resolvido pelo CSS) e se avisa a ponte nativa `NkTema`
// (MainActivity.kt / PonteTema.kt): ela liga ou desliga os ícones claros das barras e pinta a barra de navegação de baixo com a cor do app. Fora do Android não há ponte e nada acontece.

/** Os canais [r, g, b] (0 a 255) de uma cor "#rgb", "#rrggbb" ou "rgb(r, g, b)"; null se não entendi. */
export function canais(cor: string): [number, number, number] | null {
  const c = cor.trim().toLowerCase();
  let r: number, g: number, b: number;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(c);
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(c);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((x) => x + x).join("") : hex[1];
    [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  } else if (rgb) {
    [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
  } else {
    return null;
  }
  return [r, g, b];
}

/** A cor como "#rrggbb" (é o que a ponte nativa entende); null se não entendi. */
export function paraHex(cor: string): string | null {
  const c = canais(cor);
  return c ? "#" + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("") : null;
}

/** Luminância relativa (WCAG) de uma cor; null se não entendi. */
export function luminancia(cor: string): number | null {
  const rgb = canais(cor);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** O fundo é escuro? (luminância abaixo de 0,18, o ponto em que o texto branco passa a ter mais contraste que o preto). Cor ilegível: não. */
export const fundoEhEscuro = (cor: string): boolean => {
  const l = luminancia(cor);
  return l !== null && l < 0.18;
};

type PonteTema = { barras(escuro: boolean, fundo: string): void };

/** Lê o --fundo atual do documento e põe as barras do sistema em sintonia. Chamar depois de trocar modo ou estilo. */
export function sincronizarBarras(): void {
  const ponte = (globalThis as { NkTema?: PonteTema }).NkTema;
  if (!ponte || typeof document === "undefined") return;
  const fundo = getComputedStyle(document.documentElement).getPropertyValue("--fundo");
  try {
    ponte.barras(fundoEhEscuro(fundo), paraHex(fundo) ?? "");
  } catch {
    /* a ponte pode sumir com a WebView: não é motivo para quebrar a tela */
  }
}
