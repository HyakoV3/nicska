<script lang="ts">
  import urlDaMarca from "./assets/marca-nicska.webp";
  import Avatar from "./Avatar.svelte";
  import { i18n } from "./i18n/index.svelte";
  import type { PrefsOverlay } from "./preferencias";
  import { formatarSegundos } from "./tentativa";
  import { CLARAO_MS, SPLITS_VISIVEIS, dataDoCabecalho, estadoDoOverlay, opacidadeDoSplit, type DadosDoOverlay } from "./video/overlay";

  // O overlay desenhado SOBRE o vídeo na reprodução (caminho B): não conhece o <video>, só o tempo dele (`tempoS`, que quem toca atualiza a cada quadro),
  // então serve igual ao vídeo importado (I-04). É decorativo para o leitor de tela (aria-hidden): os mesmos números estão em texto no resultado e na lista.
  // Tamanhos em cqh/cqw (fração do vídeo, que é o contêiner): o overlay cresce e encolhe com a imagem, em pé ou deitada. Cada texto tem caixa própria, quase
  // sólida, na cor de fundo do tema: legível sobre qualquer imagem nos quatro modos (no alto contraste, sólida). Nada só por cor: o disparo recém-ocorrido
  // tem marcador e negrito além da cor do tempo. Posição fixa nesta fatia (cabeçalho no alto, avatar embaixo à esquerda, tempos embaixo à direita).
  // `reservaBaixo` (tela cheia ao vivo, V2b): o botão de cancelar/parar fica no fundo, no centro, então a faixa de baixo (avatar, splits e cronômetro) sobe para não ficar por baixo dele. Os splits mostram os últimos 5 e os mais antigos esmaecem.
  let { tempoS, dados, opcoes, reservaBaixo = false }: { tempoS: number; dados: DadosDoOverlay; opcoes: PrefsOverlay; reservaBaixo?: boolean } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const seg = (ms: number) => formatarSegundos(ms, i18n.idioma);
  const hf = (v: number) => new Intl.NumberFormat(i18n.idioma, { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(v);

  const estado = $derived(estadoDoOverlay(tempoS, dados));
  const splits = $derived(estado.splits.slice(-SPLITS_VISIVEIS));
  const cabecalho = $derived([dados.percurso, dados.divisao, dataDoCabecalho(dados.data, i18n.idioma)].filter(Boolean).join(" · "));
  /** O clarão do apito some aos poucos em `CLARAO_MS` (a opacidade vem do tempo do vídeo, não de uma animação: pausado, fica parado). */
  const clarao = $derived(estado.clarao ? 0.55 * (1 - estado.decorridoMs / CLARAO_MS) : 0);
  const atirador = $derived(dados.atirador ?? null);
</script>

<div class="overlay" aria-hidden="true">
  {#if clarao > 0}<div class="clarao" style:opacity={clarao}></div>{/if}

  <div class="alto">
    {#if opcoes.cabecalho && cabecalho}<p class="caixa cabecalho">{cabecalho}</p>{/if}
    {#if opcoes.marca}<p class="caixa marca"><img src={urlDaMarca} alt="" /><span>{t("overlay.marca")}</span></p>{/if}
  </div>

  {#if estado.fase === "antes"}
    <div class="meio"><p class="caixa standby"><span class="standby-grande">{t("timer.standby_grande")}</span><span class="apito">{t("overlay.apito")}</span></p></div>
  {:else if estado.resultado}
    {@const r = estado.resultado}
    <dl class="caixa resultado">
      <div><dt>{t("timer.total")}</dt><dd class="digitos">{seg(r.totalMs)}</dd></div>
      <div><dt>{t("timer.primeiro")}</dt><dd class="digitos">{seg(r.primeiroMs)}</dd></div>
      <div><dt>{t("timer.n_disparos")}</dt><dd class="digitos">{r.n}</dd></div>
      {#if r.pontos !== null}<div><dt>{t("pontos.total", { n: r.pontos })}</dt><dd class="digitos">{r.hf === null ? "—" : t("pontos.hf", { hf: hf(r.hf) })}</dd></div>{/if}
      {#if r.incompleta}<div class="selo">⚠ {t("overlay.incompleta")}</div>{/if}
    </dl>
  {/if}

  <div class="pe" class:reserva-baixo={reservaBaixo}>
    <div class="quem">
      {#if opcoes.avatar && atirador}<span class="moldura"><Avatar id={atirador.id} nome={atirador.nome} lado="calc(var(--u) * 13)" oculto /></span>{/if}
      {#if opcoes.nome && atirador}<p class="caixa nome">{atirador.nome}</p>{/if}
    </div>
    <div class="tempos">
      {#if opcoes.splits && splits.length}
        <ol class="splits">
          {#each splits as s, i (s.n)}
            <li class="caixa" class:recente={estado.recente === s.n} style:opacity={opacidadeDoSplit(splits.length - 1 - i)}><span class="n">{estado.recente === s.n ? "▸" : ""}{s.n}</span> <span class="digitos">{seg(s.splitMs)}</span></li>
          {/each}
        </ol>
      {/if}
      <p class="caixa cronometro digitos">{seg(estado.decorridoMs)}<span class="unidade"> s</span></p>
    </div>
  </div>
</div>

<style>
  /* O próprio overlay é o contêiner (cobre o vídeo inteiro, inset 0) e dá a medida das unidades cqw/cqh aos filhos. Toques passam para os controles do vídeo.
     `--u` = 1% do LADO MENOR da caixa do vídeo: em pé a largura manda, deitado a altura, então o desenho é o mesmo em 9:16 e 16:9 e em qualquer resolução (720p, 1080p, 4K:
     o que conta é a proporção da caixa, não os pixels). O `--u` é só um texto guardado aqui e vira medida nos filhos, onde as unidades cq* valem. */
  .overlay { --u: min(1cqw, 1cqh); position: absolute; inset: 0; container-type: size; pointer-events: none; overflow: hidden; color: var(--texto); line-height: 1.15; }
  p, dl, ol { margin: 0; }
  .caixa { background: var(--fundo); background: color-mix(in srgb, var(--fundo) 85%, transparent); border-radius: calc(var(--u) * 1.2); padding: calc(var(--u) * 0.6) calc(var(--u) * 1.8); }
  :global(:root[data-tema="alto-contraste"]) .caixa { background: var(--fundo); border: calc(var(--u) * 0.25) solid var(--borda-controle); }
  .clarao { position: absolute; inset: 0; background: var(--tempo-fundo); }
  .alto { position: absolute; top: calc(var(--u) * 3); left: calc(var(--u) * 3); right: calc(var(--u) * 3); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: calc(var(--u) * 1) calc(var(--u) * 2); }
  .cabecalho { font-size: clamp(0.6rem, calc(var(--u) * 3.6), 1.4rem); font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* A marca: o ícone do Nicska e o nome embaixo, numa caixa só no canto de cima à direita. */
  .marca { margin-left: auto; display: grid; justify-items: center; gap: calc(var(--u) * 0.4); padding: calc(var(--u) * 0.8) calc(var(--u) * 1.4); font-size: clamp(0.5rem, calc(var(--u) * 2.6), 1rem); font-weight: 700; color: var(--texto); white-space: nowrap; }
  .marca img { display: block; width: calc(var(--u) * 8); height: calc(var(--u) * 8); object-fit: contain; }
  .meio { position: absolute; inset: 0; display: grid; place-content: center; }
  .standby { display: grid; justify-items: center; gap: calc(var(--u) * 0.8); padding: calc(var(--u) * 2) calc(var(--u) * 4); }
  .standby-grande { font-size: calc(var(--u) * 11); font-weight: 800; letter-spacing: 0.05em; white-space: nowrap; }
  .apito { font-size: clamp(0.6rem, calc(var(--u) * 3.6), 1.3rem); }
  .resultado { position: absolute; top: calc(var(--u) * 19); left: 0; right: 0; margin-inline: auto; width: fit-content; max-width: 92cqw; display: flex; flex-wrap: wrap; justify-content: center; gap: calc(var(--u) * 0.6) calc(var(--u) * 3); padding: calc(var(--u) * 1.2) calc(var(--u) * 2.4); font-size: clamp(0.6rem, calc(var(--u) * 3.4), 1.3rem); }
  .resultado div { display: grid; justify-items: center; }
  .resultado dt { color: var(--suave); }
  .resultado dd { margin: 0; font-weight: 700; font-size: 1.4em; font-variant-numeric: tabular-nums; }
  .selo { align-self: center; font-weight: 800; text-transform: uppercase; border: calc(var(--u) * 0.3) solid var(--texto); border-radius: var(--u); padding: calc(var(--u) * 0.4) calc(var(--u) * 1.4); }
  /* A faixa de baixo: avatar e nome à esquerda (o nome encolhe com reticências), splits e cronômetro à direita (não encolhem). */
  .pe { position: absolute; left: calc(var(--u) * 3); right: calc(var(--u) * 3); bottom: calc(var(--u) * 3); display: flex; justify-content: space-between; align-items: flex-end; gap: calc(var(--u) * 2); }
  .quem { display: flex; align-items: center; gap: calc(var(--u) * 1.6); flex: 1 1 0; min-width: 0; }
  .moldura { display: inline-flex; flex: none; border-radius: 50%; border: calc(var(--u) * 0.6) solid var(--acento); background: var(--fundo); }
  .nome { min-width: 0; font-size: clamp(0.65rem, calc(var(--u) * 4), 1.8rem); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tempos { display: grid; justify-items: end; gap: calc(var(--u) * 0.8); flex: none; }
  .splits { max-height: calc(var(--u) * 31); overflow: hidden; align-content: end; list-style: none; padding: 0; display: grid; justify-items: end; gap: calc(var(--u) * 0.5); font-size: clamp(0.6rem, calc(var(--u) * 4), 1.5rem); font-variant-numeric: tabular-nums; }
  .pe.reserva-baixo { bottom: calc(var(--u) * 3 + 5rem); }
  .splits .n { display: inline-block; min-width: 2.2em; color: var(--suave); }
  .splits .recente { background: var(--tempo-fundo); color: var(--tempo-sobre); font-weight: 800; }
  .splits .recente .n { color: inherit; }
  .cronometro { font-size: calc(var(--u) * 11); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--tempo-ativo); padding: calc(var(--u) * 0.4) calc(var(--u) * 2); }
  .unidade { font-size: 0.35em; font-weight: 400; color: var(--suave); }
  /* Quem pediu menos movimento no sistema não vê o clarão (CONS-033). */
  @media (prefers-reduced-motion: reduce) { .clarao { display: none; } }
</style>
