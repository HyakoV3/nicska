#!/usr/bin/env node
// Gera src/lib/icones.json: só os ícones que o app usa, em SVG, do conjunto "ic" (Google Material Icons, contorno,
// licença Apache-2.0) e, onde o "ic" não tem o desenho, do "material-symbols" (Google Material Symbols, a família nova,
// também Apache-2.0), buscados na API pública do Iconify. Inspirado em admin-web/scripts/build-icons-subset.mjs do
// outro projeto do responsável (mesma ideia: buscar uma vez, gravar o JSON no repositório; em uso o app não precisa de rede).
//
// Uso (precisa de rede, só quando a lista abaixo mudar):
//   node tools/gerar-icones.mjs            # mostra o que faria
//   node tools/gerar-icones.mjs --escrever # grava src/lib/icones.json
//
// Cada entrada de NOMES é "nome" (do conjunto padrão, "ic") ou "conjunto:nome" (de outro conjunto, ver CONJUNTOS_ACEITOS).
// Para trocar o conjunto padrão (ex.: "material-symbols-light"), mude CONJUNTO e os nomes em NOMES.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const CONJUNTO = "ic";
// Só conjuntos com esta licença e do mesmo desenhista entram (ver docs/licencas-de-terceiros.md e src/lib/licencas.ts).
const CONJUNTOS_ACEITOS = new Set(["ic", "material-symbols"]);
const LICENCA = "Apache-2.0 (Google Material Icons e Material Symbols, via Iconify)";
// nome usado no app -> nome do ícone no conjunto
const NOMES = {
  stop: "outline-stop",
  voltar: "outline-arrow-back",
  ok: "outline-check",
  mais: "outline-add",
  menos: "outline-remove",
  abrir: "outline-expand-more",
  fechar: "outline-expand-less",
  ajustes: "outline-settings", // engrenagem
  compartilhar: "outline-share", // três pontos ligados (enviar a tentativa: áudio ou vídeo)
  lixeira: "outline-delete", // descartar a tentativa
  x: "outline-close", // fechar uma janela (o "fechar" acima é a seta dos cartões)
};
// Só tags de desenho: o corpo do SVG é inserido na página com {@html}, então nada além disso pode passar.
const TAGS_PERMITIDAS = new Set(["path", "g", "circle", "rect", "ellipse", "line", "polyline", "polygon"]);

const destino = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "icones.json");

// "nome" -> { conjunto: CONJUNTO, id: "nome" }; "conjunto:nome" -> { conjunto, id }.
const separar = (valor) => {
  const [a, b] = valor.includes(":") ? valor.split(":") : [CONJUNTO, valor];
  if (!CONJUNTOS_ACEITOS.has(a)) throw new Error(`conjunto não aceito: ${a} (em ${valor})`);
  return { conjunto: a, id: b };
};
const pedidos = Object.fromEntries(Object.entries(NOMES).map(([nome, valor]) => [nome, separar(valor)]));

// Uma busca por conjunto; cada resposta tem de ser 24x24 (o Icone.svelte fixa o viewBox) e sem ícone de tamanho próprio.
const respostas = {};
for (const conjunto of new Set(Object.values(pedidos).map((p) => p.conjunto))) {
  const ids = Object.values(pedidos).filter((p) => p.conjunto === conjunto).map((p) => p.id);
  const resposta = await fetch(`https://api.iconify.design/${conjunto}.json?icons=${ids.join(",")}`);
  if (!resposta.ok) throw new Error(`Iconify respondeu ${resposta.status} para ${conjunto}`);
  const dados = await resposta.json();
  if (dados.not_found?.length) throw new Error(`não encontrados em ${conjunto}: ${dados.not_found.join(", ")}`);
  if (dados.aliases && Object.keys(dados.aliases).length) throw new Error(`${conjunto} devolveu aliases; trate antes de gravar`);
  if ((dados.width ?? 24) !== 24 || (dados.height ?? 24) !== 24) throw new Error(`${conjunto}: o ícone não é 24x24`);
  for (const id of ids) {
    const i = dados.icons?.[id];
    if (i && ((i.width ?? 24) !== 24 || (i.height ?? 24) !== 24 || i.left || i.top)) throw new Error(`${conjunto}:${id} tem caixa própria`);
  }
  respostas[conjunto] = dados;
}

const icones = {};
for (const [nome, { conjunto, id: nomeNoConjunto }] of Object.entries(pedidos)) {
  const corpo = respostas[conjunto].icons?.[nomeNoConjunto]?.body;
  if (typeof corpo !== "string") throw new Error(`sem corpo para ${conjunto}:${nomeNoConjunto}`);
  const tags = new Set([...corpo.matchAll(/<\s*([A-Za-z][A-Za-z0-9]*)/g)].map((m) => m[1]));
  const fora = [...tags].filter((t) => !TAGS_PERMITIDAS.has(t));
  if (fora.length || /\son\w+\s*=|javascript:/i.test(corpo)) throw new Error(`${nomeNoConjunto}: conteúdo não permitido (${fora.join(", ")})`);
  icones[nome] = corpo;
}

const saida = { conjunto: CONJUNTO, conjuntos: Object.keys(respostas).sort(), licenca: LICENCA, largura: 24, altura: 24, icones };
const texto = JSON.stringify(saida, null, 1) + "\n";
console.log(`${Object.keys(icones).length} ícones, ${texto.length} bytes (${saida.conjuntos.join(" + ")}, ${LICENCA})`);
if (process.argv.includes("--escrever")) {
  writeFileSync(destino, texto);
  console.log("gravado em", destino);
} else {
  console.log("(simulação: use --escrever para gravar)");
}
