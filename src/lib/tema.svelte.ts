// Preferência de aparência: Automático (padrão, segue o sistema), Claro, Escuro ou Alto contraste (I-06, baixa visão).
// "sistema" não define data-tema e deixa o CSS seguir prefers-color-scheme. O Automático NÃO liga o alto contraste sozinho
// (prefers-contrast): não se sabe se a WebView repassa essa preferência, e mudar a cor de quem não escolheu surpreenderia.
// O app.html aplica a escolha salva antes da primeira pintura, para não piscar.

import { CHAVE_ESTILO, ESTILOS, migrarEstilo, type Estilo } from "./estilos";

export { ESTILOS, type Estilo };

export const TEMAS = ["sistema", "claro", "escuro", "alto-contraste"] as const;
export type Tema = (typeof TEMAS)[number];

const CHAVE = "tema";

const ehTema = (x: unknown): x is Tema => typeof x === "string" && (TEMAS as readonly string[]).includes(x);

function inicial(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (ehTema(salvo)) return salvo;
  } catch {
    /* sem armazenamento: segue o sistema */
  }
  return "sistema";
}

/** Aplica o tema ao documento (chamado pelo layout sempre que a escolha muda). */
export function aplicarTema(t: Tema) {
  if (t === "sistema") delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = t;
}

// --- Estilo de cor (normal, titânio, telemetria), independente do modo acima ---
function estiloInicial(): Estilo {
  try {
    const salvo = localStorage.getItem(CHAVE_ESTILO);
    if (salvo !== null) return migrarEstilo(salvo); // valores antigos (pergaminho, marinho) viram titânio e telemetria
  } catch {
    /* sem armazenamento: estilo normal */
  }
  return "normal";
}

/** Aplica o estilo ao documento. O normal é o padrão do CSS, então não leva atributo. */
export function aplicarEstilo(e: Estilo) {
  if (e === "normal") delete document.documentElement.dataset.estilo;
  else document.documentElement.dataset.estilo = e;
}

let estiloAtual = $state<Estilo>(estiloInicial());

export const estilo = {
  get atual(): Estilo {
    return estiloAtual;
  },
  set atual(v: Estilo) {
    estiloAtual = v;
    try {
      localStorage.setItem(CHAVE_ESTILO, v);
    } catch {
      /* preferência não salva */
    }
  },
};

let atual = $state<Tema>(inicial());

export const tema = {
  get atual(): Tema {
    return atual;
  },
  set atual(v: Tema) {
    atual = v;
    try {
      localStorage.setItem(CHAVE, v);
    } catch {
      /* preferência não salva */
    }
  },
};
