<script lang="ts">
  // Abas de uma tela (ex.: Ouvir | Letra), no padrão dos apps de celular: barra fixa embaixo, ao alcance do polegar.
  // Com o celular deitado (pouca altura) vira uma barra lateral à esquerda, como o "navigation rail" do Material.
  // Publica o próprio tamanho em variáveis CSS do documento para o resto da tela abrir espaço:
  //   --altura-navegacao  altura da barra inferior (0 quando é lateral)
  //   --largura-trilho    largura da barra lateral (0 quando é inferior)
  // O painel de cada aba é `#painel-<id>` e a aba é `#aba-<id>` (WAI-ARIA Tabs).
  type Aba = { id: string; rotulo: string };
  let {
    abas,
    selecionada,
    aoSelecionar,
    rotulo,
  }: { abas: Aba[]; selecionada: string; aoSelecionar: (id: string) => void; rotulo: string } = $props();

  // Celular deitado: pouca altura. Tablets e telas altas ficam com a barra embaixo.
  let trilho = $state(false);
  $effect(() => {
    const mq = matchMedia("(orientation: landscape) and (max-height: 32.5em)");
    trilho = mq.matches;
    const mudou = (e: MediaQueryListEvent) => (trilho = e.matches);
    mq.addEventListener("change", mudou);
    return () => mq.removeEventListener("change", mudou);
  });

  let altura = $state(0);
  let largura = $state(0);
  $effect(() => {
    const raiz = document.documentElement.style;
    raiz.setProperty("--altura-navegacao", trilho ? "0rem" : `${altura}px`);
    raiz.setProperty("--largura-trilho", trilho ? `${largura}px` : "0rem");
    // A barra inferior já reserva a área da barra de gestos; o miniplayer acima dela não repete.
    raiz.setProperty("--inset-miniplayer", trilho ? "env(safe-area-inset-bottom)" : "0rem");
    return () => {
      raiz.setProperty("--altura-navegacao", "0rem");
      raiz.setProperty("--largura-trilho", "0rem");
      raiz.removeProperty("--inset-miniplayer");
    };
  });

  const DESTINOS: Record<string, (i: number, n: number) => number> = {
    ArrowLeft: (i, n) => (i - 1 + n) % n,
    ArrowUp: (i, n) => (i - 1 + n) % n,
    ArrowRight: (i, n) => (i + 1) % n,
    ArrowDown: (i, n) => (i + 1) % n,
    Home: () => 0,
    End: (_, n) => n - 1,
  };
  const destinoDaTecla = (tecla: string, i: number, n: number) => DESTINOS[tecla]?.(i, n) ?? -1;

  // Teclado (padrão WAI-ARIA): setas trocam de aba (nas duas direções, a barra pode estar deitada ou em pé);
  // Home e End vão para a primeira e a última.
  function teclas(e: KeyboardEvent) {
    const i = abas.findIndex((a) => a.id === selecionada);
    const destino = destinoDaTecla(e.key, i, abas.length);
    if (destino < 0) return;
    e.preventDefault();
    aoSelecionar(abas[destino].id);
    document.getElementById(`aba-${abas[destino].id}`)?.focus();
  }
</script>

<div
  class="abas"
  class:trilho
  role="tablist"
  aria-label={rotulo}
  aria-orientation={trilho ? "vertical" : "horizontal"}
  tabindex="-1"
  onkeydown={teclas}
  bind:offsetHeight={altura}
  bind:offsetWidth={largura}
>
  {#each abas as a (a.id)}
    <button
      role="tab"
      id={`aba-${a.id}`}
      aria-selected={selecionada === a.id}
      aria-controls={`painel-${a.id}`}
      tabindex={selecionada === a.id ? 0 : -1}
      onclick={() => aoSelecionar(a.id)}>{a.rotulo}</button
    >
  {/each}
</div>

<style>
  /* Barra inferior: ocupa a largura toda e respeita a barra de gestos. */
  .abas {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 15; display: flex;
    background: var(--fundo); border-top: 0.0625rem solid var(--borda);
    padding-bottom: env(safe-area-inset-bottom);
  }
  button {
    flex: 1; min-height: 3.5rem; padding: 0 0.75rem; font-size: 1rem; background: transparent; color: var(--suave);
    border: 0; border-top: 0.1875rem solid transparent; cursor: pointer;
  }
  button[aria-selected="true"] { color: var(--texto); font-weight: 600; border-top-color: var(--acento); }

  /* Barra lateral (celular deitado): à esquerda, na altura toda, com as abas empilhadas no meio. */
  .abas.trilho {
    right: auto; top: 0; flex-direction: column; justify-content: center; width: max-content; min-width: 5.5rem;
    border-top: 0; border-right: 0.0625rem solid var(--borda);
    padding-bottom: 0; padding-left: env(safe-area-inset-left);
  }
  .trilho button { flex: none; border-top: 0; border-left: 0.1875rem solid transparent; }
  .trilho button[aria-selected="true"] { border-top-color: transparent; border-left-color: var(--acento); }
</style>
