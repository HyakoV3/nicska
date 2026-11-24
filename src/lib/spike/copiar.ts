// SPIKE S1, passo 7 (EXPERIMENTAL, descartável): copiar o relatório para a área de transferência, com recuo para o texto selecionado.

/** Copia `texto`. Tenta `navigator.clipboard`; se falhar, seleciona o `campo` e usa `execCommand`. Devolve como foi: "clipboard", "selecao" ou "falhou". */
export async function copiarTexto(texto: string, campo: HTMLTextAreaElement | null): Promise<"clipboard" | "selecao" | "falhou"> {
  try {
    await navigator.clipboard.writeText(texto);
    return "clipboard";
  } catch {
    if (!campo) return "falhou";
    campo.focus();
    campo.select();
    try {
      return document.execCommand("copy") ? "selecao" : "falhou";
    } catch {
      return "falhou";
    }
  }
}
