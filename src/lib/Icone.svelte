<script lang="ts">
  import { corpoDoIcone, type IconeNome } from "./icones";

  // Ícone decorativo: o nome acessível fica no botão ou no texto ao lado (aria-label), então o SVG é escondido do leitor
  // de tela. A cor vem do texto em volta (currentColor), então acompanha os temas.
  // `tamanho` é o número de sempre (16, 20, 24...), lido como px de um corpo de 16 px: vira rem, então escala com a fonte do sistema.
  let { nome, tamanho = 20 }: { nome: IconeNome; tamanho?: number } = $props();
</script>

<svg
  class="icone"
  viewBox="0 0 24 24"
  style:width={`${tamanho / 16}rem`}
  style:height={`${tamanho / 16}rem`}
  fill="currentColor"
  aria-hidden="true"
  focusable="false"
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- conteúdo local e validado por tools/gerar-icones.mjs -->
  {@html corpoDoIcone(nome)}
</svg>

<style>
  .icone { flex: none; vertical-align: middle; }
</style>
