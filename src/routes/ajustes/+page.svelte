<script lang="ts">
  import Icone from "$lib/Icone.svelte";
  import type { Chave } from "$lib/i18n/pt";
  import Aviso from "$lib/Aviso.svelte";
  import Cartao from "$lib/Cartao.svelte";
  import Dados from "$lib/Dados.svelte";
  import DesempenhoRelatorios from "$lib/DesempenhoRelatorios.svelte";
  import Laboratorio from "$lib/Laboratorio.svelte";
  import MeuPerfil from "$lib/MeuPerfil.svelte";
  import OverlayDeVideo from "$lib/OverlayDeVideo.svelte";
  import QualidadeDoVideo from "$lib/QualidadeDoVideo.svelte";
  import RegistroAjustes from "$lib/RegistroAjustes.svelte";
  import RetencaoDeVideo from "$lib/RetencaoDeVideo.svelte";
  import Barra from "$lib/Barra.svelte";
  import { IDIOMAS, i18n, type Idioma } from "$lib/i18n/index.svelte";
  import { usarVoltar } from "$lib/navegacao";
  import { ESTILOS, TEMAS, estilo, tema } from "$lib/tema.svelte";
  import { CREDITOS, semLicenca, textoDaLicenca } from "$lib/licencas";
  import { lerAjustes, lerRegistro, salvarAjustes } from "$lib/preferencias";

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const voltar = usarVoltar();

  // Cada bloco é um cartão recolhível, fechado de saída: a linha de resumo ao lado do título mostra o estado sem abrir. Aparência e Idioma
  // lembram se a pessoa os deixou abertos (`prefs.ajustes`); Sobre e Créditos abrem sempre fechados.
  const lembrado = lerAjustes();
  let aparenciaAberta = $state(lembrado.aparencia);
  let idiomaAberto = $state(lembrado.idioma);
  /** Grava só o que a PESSOA escolheu: o `Cartao` chama isto no clique, e não quando o programa abre um cartão. */
  const lembrar = (cartao: keyof typeof lembrado) => (aberto: boolean) => {
    lembrado[cartao] = aberto;
    salvarAjustes(lembrado);
  };
  let perfilAberto = $state(false);
  let dadosAberto = $state(false);
  let registroAberto = $state(false);
  /** O modo de registro escolhido, para o resumo do cartão (atualizado quando a pessoa muda lá dentro). */
  let modoDeRegistro = $state(lerRegistro().modo);
  let qualidadeAberta = $state(false);
  let retencaoAberta = $state(false);
  let overlayAberto = $state(false);
  let laboratorioAberto = $state(false);
  let desempenhoAberto = $state(false);
  let sobreAberto = $state(false);
  let creditosAberto = $state(false);

  const resumoAparencia = $derived(
    // O Alto contraste tem paleta própria e ignora o estilo: só ele aparece.
    tema.atual === "alto-contraste" ? t("tema.alto-contraste") : `${t(`tema.${tema.atual}`)} · ${t(`estilo.${estilo.atual}`)}`,
  );
</script>

<svelte:head><title>{t("ajustes.titulo")} · Nicska</title></svelte:head>

<Barra titulo={t("ajustes.titulo")} {voltar} rotuloVoltar={t("nav.voltar")} />

<main class="coluna conteudo">
  <section>
    <Aviso tipo="info"><strong>{t("sobre.aviso_titulo")}</strong><br />{t("sobre.aviso")}</Aviso>
  </section>

  <section>
    <Cartao id="cartao-aparencia" titulo={t("ajustes.aparencia")} resumo={resumoAparencia} bind:aberto={aparenciaAberta} aoAlternar={lembrar("aparencia")}>
      <!-- Duas escolhas que se combinam: o modo (claro ou escuro) e o estilo de cor. O próprio rótulo visível dá o nome
           ao grupo (aria-labelledby), então texto visível e nome acessível são sempre o mesmo. -->
      <p class="rotulo-grupo" id="rotulo-modo">{t("ajustes.modo")}</p>
      <fieldset class="segmentos modo" aria-labelledby="rotulo-modo">
        {#each TEMAS as id}
          <label class:ativo={tema.atual === id}>
            <input type="radio" name="tema" value={id} checked={tema.atual === id} onchange={() => (tema.atual = id)} />
            <span class="opcao-tema">{#if tema.atual === id}<Icone nome="ok" tamanho={18} />{/if}{t(`tema.${id}`)}</span>
          </label>
        {/each}
      </fieldset>
      <p class="rotulo-grupo" id="rotulo-estilo">{t("ajustes.estilo")}</p>
      <!-- O Alto contraste tem paleta própria: com ele o estilo não vale, então o grupo fica desativado e uma nota diz por quê. -->
      <fieldset class="segmentos" aria-labelledby="rotulo-estilo" disabled={tema.atual === "alto-contraste"}>
        {#each ESTILOS as id}
          <label class:ativo={estilo.atual === id}>
            <input type="radio" name="estilo" value={id} checked={estilo.atual === id} onchange={() => (estilo.atual = id)} />
            <span class="opcao-tema">{#if estilo.atual === id}<Icone nome="ok" tamanho={18} />{/if}{t(`estilo.${id}`)}</span>
          </label>
        {/each}
      </fieldset>
      {#if tema.atual === "alto-contraste"}<p class="meta">{t("ajustes.estilo_alto_contraste")}</p>{/if}
    </Cartao>
  </section>

  <section>
    <Cartao id="cartao-idioma" titulo={t("ajustes.idioma")} resumo={IDIOMAS[i18n.idioma].nome} bind:aberto={idiomaAberto} aoAlternar={lembrar("idioma")}>
      <select
        aria-label={t("ajustes.idioma")}
        value={i18n.idioma}
        onchange={(e) => (i18n.idioma = e.currentTarget.value as Idioma)}
      >
        <!-- Cada nome está na própria língua: o lang faz o leitor de tela pronunciar certo. -->
        {#each Object.entries(IDIOMAS) as [id, l]}<option value={id} lang={id}>{l.nome}</option>{/each}
      </select>
    </Cartao>
  </section>

  <section>
    <Cartao id="cartao-perfil" titulo={t("perfil.titulo")} bind:aberto={perfilAberto}>
      <MeuPerfil />
    </Cartao>
  </section>

  <section>
    <Cartao id="cartao-registro" titulo={t("ajustes.registro")} resumo={t(modoDeRegistro === "video" ? "registro.audio_video" : "registro.so_audio")} bind:aberto={registroAberto}>
      <RegistroAjustes aoMudar={(r) => (modoDeRegistro = r.modo)} />
    </Cartao>
  </section>

  <section>
    <Cartao id="cartao-video-qualidade" titulo={t("ajustes.video_qualidade")} bind:aberto={qualidadeAberta}>
      <QualidadeDoVideo />
    </Cartao>
  </section>

  <section>
    <Cartao id="cartao-video-retencao" titulo={t("ajustes.video_retencao")} bind:aberto={retencaoAberta}>
      <RetencaoDeVideo />
    </Cartao>
  </section>

  <section>
    <Cartao id="cartao-video-overlay" titulo={t("ajustes.overlay")} bind:aberto={overlayAberto}>
      <OverlayDeVideo />
    </Cartao>
  </section>

  <section>
    <Cartao id="cartao-laboratorio" titulo={t("ajustes.laboratorio")} bind:aberto={laboratorioAberto}>
      <Laboratorio />
    </Cartao>
  </section>

  <section>
    <Cartao id="cartao-desempenho" titulo={t("ajustes.desempenho")} bind:aberto={desempenhoAberto}>
      {#if desempenhoAberto}<DesempenhoRelatorios />{/if}
    </Cartao>
  </section>

  <section>
    <Cartao id="cartao-dados" titulo={t("ajustes.dados")} bind:aberto={dadosAberto}>
      <Dados />
    </Cartao>
  </section>

  <section>
    <Cartao titulo={t("ajustes.sobre")} bind:aberto={sobreAberto}>
      <div class="sobre">
        <p>{t("sobre.intro")}</p>

        <h3>{t("sobre.como_titulo")}</h3>
        <p>{t("sobre.como")}</p>

        <h3>{t("sobre.privacidade_titulo")}</h3>
        <p>{t("sobre.privacidade")}</p>

        <h3>{t("sobre.codigo_titulo")}</h3>
        <p>{t("sobre.codigo")}</p>

        <h3>{t("sobre.nome_titulo")}</h3>
        <p>{t("sobre.nome")}</p>
      </div>
    </Cartao>
  </section>

  <section>
    <Cartao titulo={t("ajustes.creditos")} bind:aberto={creditosAberto}>
      <div class="sobre">
        <p>{t("creditos.intro")}</p>
        <p>{t("creditos.marcas")}</p>
        <p>{t("creditos.nao_oficial")}</p>
        <ul class="creditos">
          {#each CREDITOS as c (c.id)}
            <li>
              <strong>{c.nome}</strong>
              <span class="meta">{t("creditos.por", { autor: c.autoria })}</span>
              <span>{t(`creditos.uso.${c.id}` as Chave)}</span>
              <span class="meta">{t("creditos.licenca", { licenca: semLicenca(c) ? t("creditos.reservado") : c.licenca })}</span>
              {#if c.url}<span class="meta url">{c.url}</span>{/if}
              <details class="licenca">
                <summary>{t(semLicenca(c) ? "creditos.ver_direitos" : "creditos.ver")}</summary>
                {#each c.textos as tx}
                  <pre>{textoDaLicenca(tx)}</pre>
                {/each}
              </details>
            </li>
          {/each}
        </ul>
      </div>
    </Cartao>
  </section>

  <!-- "Apoie o desenvolvedor": fora de card, logo acima da versão. -->

  <!-- A versão fica sozinha no fim, centralizada, fora do card. -->
  <p class="meta versao">{t("ajustes.versao", { v: `${__APP_VERSAO__} (${__APP_COMMIT__})` })}</p>
  <!-- Ferramenta EXPERIMENTAL de medição (spike de vídeo): sem destaque, só para quem sabe que existe (docs/spike-video.md). -->
  <p class="meta versao"><a class="spike" href="/spike-video">{t("spike.link")}</a></p>
</main>

<style>
  /* "Em nome do Senhor Jesus": numa linha só, com o tamanho acompanhando a largura da tela. Se não couber ao lado do título, a própria barra o põe na linha de baixo (`quebra`). */
  section { margin-bottom: 0.9rem; }
  .versao { margin: 0 0 1.5rem; text-align: center; }
  .spike { display: inline-block; min-height: 3rem; line-height: 3rem; color: var(--suave); font-size: 0.8rem; }
  .sobre p, .sobre li { line-height: 1.5; }
  .sobre h3 { margin: 1.1rem 0 0.3rem; font-size: 0.95rem; }
  .sobre ul { margin: 0; padding-left: 1.2rem; }
  .sobre ul.creditos { padding-left: 0; list-style: none; }
  .creditos li { display: grid; gap: 0.15rem; padding: 0.7rem 0; border-top: 0.0625rem solid var(--borda-controle); }
  .creditos li:first-child { border-top: 0; }
  .creditos .url { overflow-wrap: anywhere; }
  .licenca summary {
    display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; cursor: pointer; list-style: none;
    min-height: 2.75rem; padding: 0; font-weight: 500; color: var(--acento);
  }
  .licenca summary::-webkit-details-marker { display: none; }
  .licenca pre { margin: 0.4rem 0 0.8rem; font: 0.78rem/1.45 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
  select {
    width: 100%; box-sizing: border-box; /* ocupa toda a largura, como as opções de aparência */
    min-height: 3rem; font-size: 1rem; padding: 0 0.6rem; border-radius: 0.75rem;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  /* Aparência: três opções lado a lado; a escolhida tem "✓", negrito e borda de acento (não só cor). */
  .rotulo-grupo { margin: 0.9rem 0 0.35rem; font-size: 0.9rem; color: var(--suave); }
  .rotulo-grupo:first-of-type { margin-top: 0.4rem; }
  .segmentos { display: flex; gap: 0.4rem; margin: 0; padding: 0; border: 0; }
  /* O modo tem quatro opções: 2 por linha no celular em pé e 4 por linha numa janela larga (o rem acompanha a fonte do sistema). */
  .segmentos.modo { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); }
  .segmentos:disabled { opacity: 0.6; }
  .segmentos:disabled input { cursor: not-allowed; }
  .segmentos label { position: relative; flex: 1; }
  .segmentos input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .segmentos span {
    display: flex; align-items: center; justify-content: center; min-height: 3rem; box-sizing: border-box;
    padding: 0 0.5rem; text-align: center; border-radius: 0.75rem; font-size: 0.95rem;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  .opcao-tema { display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; }
  .segmentos .ativo span { border: 0.125rem solid var(--acento); font-weight: 700; }
  .segmentos input:focus-visible + span { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
</style>
