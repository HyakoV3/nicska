// A trilha preenchida dos controles deslizantes: a parte já percorrida pinta na cor de acento. A WebView é Chromium, que não tem `::-moz-range-progress`;
// o padrão é uma variável CSS `--p` (porcentagem) no <input>, lida pelo `linear-gradient` da trilha (+layout.svelte). Action: `use:trilha`.

/** A posição do valor entre min e max, em porcentagem (0 a 100). */
export function porcentagem(valor: number, min: number, max: number): number {
  if (!Number.isFinite(valor) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  return Math.min(100, Math.max(0, ((valor - min) / (max - min)) * 100));
}

/** Action: mantém `--p` em dia ao arrastar (evento `input`) e ao mudar por programa (o parâmetro, qualquer coisa que mude junto com o valor). */
export function trilha(no: HTMLInputElement, _valor?: unknown) {
  const atualizar = () => no.style.setProperty("--p", `${porcentagem(Number(no.value), Number(no.min || 0), Number(no.max || 100))}%`);
  atualizar();
  no.addEventListener("input", atualizar);
  return {
    // O atributo pode ainda não ter sido atualizado quando o parâmetro muda: adia um tique.
    update() {
      atualizar();
      queueMicrotask(atualizar);
    },
    destroy() {
      no.removeEventListener("input", atualizar);
    },
  };
}
