// O avatar da pessoa: as iniciais (e a cor delas) para quem não tem foto, e as regras de entrada da imagem. As partes de <canvas> estão em `avatarImagem.ts`.

/** O maior arquivo de imagem aceito antes de decodificar (uma foto de câmera de 12 MP passa folgada; um arquivo gigante não trava o app). */
export const LIMITE_DO_ARQUIVO = 15 * 1024 * 1024;
/** O lado do avatar guardado, em pixels. */
export const LADO_DO_AVATAR = 256;

/** O arquivo escolhido serve? Devolve o motivo da recusa ou nulo. */
export function recusarArquivo(a: { size: number; type: string }): "grande" | "nao_imagem" | null {
  if (a.type && !a.type.startsWith("image/")) return "nao_imagem";
  return a.size > LIMITE_DO_ARQUIVO ? "grande" : null;
}

const LETRA = /[\p{L}\p{N}]/u;

/** A primeira letra ou número da palavra (ignora emoji, pontuação e pedaços quebrados), em maiúscula; "" se não há. */
const inicialDe = (palavra: string): string => (Array.from(palavra).find((c) => LETRA.test(c)) ?? "").toLocaleUpperCase();

/** As iniciais do nome: a da primeira e a da última palavra (1 ou 2 letras); "?" se o nome não tem nenhuma letra. */
export function iniciais(nome: string): string {
  const letras = nome.split(/\s+/).map(inicialDe).filter(Boolean);
  if (letras.length === 0) return "?";
  return letras.length === 1 ? letras[0] : letras[0] + letras[letras.length - 1];
}

/** As cores dos círculos de iniciais: os tokens das séries dos gráficos (cada tema já os deixa legíveis); o texto sobre elas usa `--fundo`. */
export const CORES_DAS_INICIAIS = ["var(--grafico-a)", "var(--grafico-b)", "var(--grafico-c)", "var(--grafico-d)"] as const;

/** A cor (token) do círculo de iniciais de um atirador: sempre a mesma para o mesmo id (hash FNV-1a). */
export function corDasIniciais(id: string): (typeof CORES_DAS_INICIAIS)[number] {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  return CORES_DAS_INICIAIS[h % CORES_DAS_INICIAIS.length];
}

/** Lê uma cor CSS (`#rgb`, `#rrggbb` ou `rgb(r, g, b)`) como [r, g, b]; cinza médio se não entende. */
export function paraRgb(css: string): [number, number, number] {
  const t = css.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t)?.[1];
  if (hex) {
    const h = hex.length === 3 ? Array.from(hex, (c) => c + c).join("") : hex;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(t);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [128, 128, 128];
}
