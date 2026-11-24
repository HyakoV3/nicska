// A aba aberta da tela inicial e onde estava a rolagem de cada uma. Fica fora do componente para a aba e a posição sobreviverem a uma ida a Ajustes.
// Vale durante o uso do app: ao abri-lo de novo, começa em Timer.
export type AbaInicio = "timer" | "historico";

export const inicio = $state<{ aba: AbaInicio; rolagem: Record<AbaInicio, number>; recebido: string | null }>({
  aba: "timer",
  /** O texto de um arquivo que outro app mandou abrir no Nicska (Android), à espera de a aba Histórico importar. */
  recebido: null,
  rolagem: { timer: 0, historico: 0 },
});
