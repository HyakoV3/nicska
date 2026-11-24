> **Arquivado (2026-11-22).** Etapas 0 a 9 feitas no código; os itens `[ ]` (GitHub/CI, calibração com áudio real, estande, site, confiança dos dados) foram para [`../roadmap-pendencias.md`](../roadmap-pendencias.md). As seções 5 a 13 (detecção, formato, ranking, riscos, critérios) continuam valendo como referência aqui. Resumo em [`roadmap-implementadas.md`](roadmap-implementadas.md).

# Nicska — roadmap de desenvolvimento

- **Status (2026-11-22):** Etapas 0 (sem remoto no GitHub, de propósito, até o MVP), 2, 3 e 4 feitas e testadas no Chrome; o timer e o worklet já rodaram no celular (APK 002). Calibração (Etapa 1) em andamento com dois vídeos de treino.
- **Origem:** ideia do responsável, 2026-11-21.
- **Base:** [biblioteca-musical](https://github.com/HyakoV3/biblioteca-musical), commit `e4ac474` (2026-11-21), mesmo autor, MIT. O inventário da seção 3 foi feito sobre esse commit.
- **Lugar deste arquivo no repositório:** `docs/archive/roadmap-desenvolvimento.md` (arquivado).

Legenda: `[x]` feito · `[ ]` a fazer · **(depende de ...)** o que bloqueia o item.

## TL;DR

- **O quê:** app Android, gratuito, MIT, que faz o papel de um *shot timer* de IPSC. Ele dá o apito (com atraso aleatório), escuta o microfone, marca cada disparo e mostra 1º disparo, splits e total. Depois compara dias, compartilha JSON pelo WhatsApp e, no fim, alimenta um site com ranking.
- **Base:** copiar o biblioteca-musical **sem o histórico**, tirar tudo o que é música e manter a infraestrutura. Fica a pilha Tauri/Svelte, o tema, os 3 idiomas, os testes e o CI, mais as peças que já resolvem os problemas difíceis: microfone cru, serviço Android com microfone e tela bloqueada, compartilhamento testado no WhatsApp, IndexedDB e agendamento no relógio de áudio.
- **Truque de precisão:** detectar o **próprio apito no microfone** e medir tudo a partir dele. O apito e os tiros passam pelo mesmo caminho de áudio, então a latência se anula.
- **Ordem:** Etapa 0 (repositório limpo) e Etapa 1 (calibrar com áudio real) **em paralelo** → motor de detecção → timer → revisão → histórico → gráficos → teste no estande → JSON → ranking local → site.
- **Primeiro passo concreto:** no próximo treino, gravar 10–20 tentativas com o Gravador (aba **Calibrar** deste app, ou o do biblioteca-musical) ou filmar. Isso já dá para fazer sem escrever código.

---

## 1. O que é o Nicska

**Nome:** Nicska, do sobrenome da família, Ivanicska. A pronúncia oficial é **"Nísca"** (Ivanicska se fala "Ivanísca": **não há "tch"**; corrigido pelo responsável em 2026-11-22) e deve ir no README e na loja. O nome, como texto, fica **sempre em letras latinas**: repositório, pacote, loja, JSON, buscas. O cirílico entra só na marca visual (seção 12). Nunca usar "Nikka", "Nicca" ou "Nichka" como apelido, domínio ou ícone, pelos motivos da pesquisa de nome.

**Nas palavras do responsável:**

> Aplicativo para medir o tempo entre os disparos durante um percurso de IPSC: o primeiro ponto é o apito, cada disparo mede o tempo entre eles e, claro, o total. Inicialmente comparar localmente entre dois ou três dias e gerar gráficos/dashboard do tempo. Depois compartilhar entre pessoas através de JSON via WhatsApp etc. Quem sabe mais para frente um site web que sobe os dados de todos e já faz o ranqueamento dos JSON subidos.

**Princípios (herdados do biblioteca-musical):**

- Código aberto, gratuito, sem anúncio e sem conta.
- Funciona offline.
- **Nada sai do aparelho sem a pessoa mandar.**
- Pesquisar antes de construir (regra do projeto).
- Funções puras testáveis com relógio falso, com o navegador e o Android só na casca fina.
- Alvos de toque de 48 px, contraste conferido e "reduzir movimento" respeitado.
- Nada de informação passada só por cor.

## 2. Decisões

| # | Decisão | Proposta | Status |
|---|---|---|---|
| D1 | Base | Copiar o biblioteca-musical sem histórico (seção 3) | **feito** (git archive do `e4ac474`) |
| D2 | Pilha | A mesma: Rust + Tauri 2 + Svelte 5 (SvelteKit estático) + TypeScript; Android primeiro | proposto |
| D3 | Identificador do app | `io.github.hyakov3.nicska`, que não exige domínio. Alternativa: `br.com.nicska`, se registrar o domínio. **Não muda depois de publicar na loja** | **provisório** (aplicado no código; confirmar antes de publicar) |
| D4 | Detecção | `AudioWorklet` em TypeScript no MVP; plano B: captura nativa em Rust (`oboe`/`cpal` com AAudio) | proposto |
| D5 | Armazenamento | IndexedDB, no padrão de `gravacoes.ts`, já testado no WebView do Android | proposto |
| D6 | Validação do JSON importado | Em Rust (serde), num comando Tauri, como `importar_hinario` faz hoje. O mesmo código serve ao servidor da fase 3 | proposto |
| D7 | Gráficos | SVG à mão, sem biblioteca, como o pêndulo do metrônomo; tema por variáveis CSS | proposto |
| D8 | Idiomas | pt, es e en, mantendo a estrutura e o `verificar-traducoes.py` | proposto |
| D9 | Prefixo técnico | `Bm`/`bm-`/`__bm` → `Nk`/`nk-`/`__nk` (pontes, banco, sondas de teste) | **feito** |
| D10 | Servidor (fase 3) | Rust (Axum) reaproveitando o código do formato, ou Go | a decidir |

## 3. Estratégia de base: o biblioteca-musical como ponto de partida

**Por que copiar, e não fazer fork:** o fork fica ligado ao repositório de origem e carrega 449 commits de música. Um repositório novo com um primeiro commit que aponta a origem é mais limpo. Correções nas **peças irmãs** são portadas à mão entre os dois apps: `gravador.ts`, `servico.ts`, `compartilhar.ts`, `gravacoes.ts`, `ServicoAudio.kt`, `PonteServico.kt`, `PonteCompartilhar.kt`, tema e i18n. Um pacote comum só vale a pena se os dois apps passarem a evoluir as mesmas peças. Não agora.

```bash
# Feito em 2026-11-22, sem clonar: o repositório local já existia.
git -C ../BibliotecaMusical-CCB archive e4ac474 | tar -x -C ../nicska
cd ../nicska && git init -b main
# ... limpeza da Etapa 0 ...
git add -A && git commit -m "Base: biblioteca-musical @ e4ac474 sem a parte de música"
gh repo create HyakoV3/nicska --public --source=. --push
```

### 3.1 Mapa do que fica, muda e sai

**Fica (como está ou quase):**

| Onde | O quê |
|---|---|
| raiz | `svelte.config.js`, `vite.config.js`, `tsconfig.json`, `vitest.config.ts`, `LICENSE` (conferir nome e ano), `SECURITY.md` (contato) |
| `src/` | `app.html`, `globals.d.ts` |
| `src/lib/` | `Abas.svelte`, `Aviso.svelte`, `Barra.svelte`, `Cartao.svelte`, `Estado.svelte`, `Icone.svelte` + `icones.json`/`icones.ts` (trocar o conjunto), `erros.ts`, `tema.css`, `tema.svelte.ts`, `estilos.ts`, `movimento.css`, `navegacao.ts`, `tempo.ts`, `i18n/` (a estrutura; textos novos) |
| `tools/` | `contraste.py`, `verificar-movimento.py`, `verificar-traducoes.py`, `gerar-icone-do-app.py` + `test_gerar_icone_do_app.py`, `gerar-icones.mjs` |
| `docs/` | `design-tokens.md`, `TRADUCOES.md` |
| `.github/workflows/` | `claude-code-review.yml`, `claude-resolve-threads.yml` (cadastrar os segredos no repositório novo) |

**Adaptar:**

| Arquivo | Mudança |
|---|---|
| `package.json` | nome `nicska`, versão `0.1.0`, descrição. **Saem** `smplr`, `fflate` e `@tauri-apps/plugin-http`, que volta na fase 3 se o app passar a enviar dados. Fica `fake-indexeddb` |
| `src-tauri/Cargo.toml` | nome `nicska`, lib `nicska_lib`. **Saem** `zip`, `roxmltree`, `base64` e `tauri-plugin-http` |
| `src-tauri/tauri.conf.json` | `productName`, `identifier` (D3), título da janela |
| `src-tauri/build.rs` | tirar a cópia de `BM_PACOTE` (hinário embutido) |
| `src-tauri/src/lib.rs` | tirar os 6 comandos do hinário. Na Etapa 8 entra `importar_json` |
| `src-tauri/capabilities/default.json` | tirar a liberação de `https://fb.hm.hv2.xyz/*`. **O MVP não acessa a rede** |
| Android (renomear) | trocar o pacote `br.pro.bibliotecamusical` pelo novo em: pastas `app/src/main/java/br/pro/bibliotecamusical/` e `buildSrc/src/main/java/br/pro/bibliotecamusical/kotlin/`, linha `package` dos `.kt`, `namespace` e `applicationId` em `app/build.gradle.kts`, `Theme.bibliotecamusical` em `values/themes.xml`, `values-night/themes.xml` e `AndroidManifest.xml`, `app_name` nos 3 `strings.xml` e os ícones `mipmap-*` |
| `MainActivity.kt` | as mesmas pontes, renomeadas `NkServico` e `NkCompartilhar`. Na Etapa 8 entra o tratamento do *intent* de abrir `.json` |
| `ServicoAudio.kt` + `PonteServico.kt` | os motivos `tocando`/`gravando`/`metronomo` viram um só, **`armado`**: microfone mais reprodução do apito, wake lock sem limite enquanto armado e notificação "Nicska · Parar" |
| `PonteCompartilhar.kt` + `compartilhar.ts` | genéricos: JSON além de áudio, nome padrão "nicska" em vez de "gravacao" |
| `AndroidManifest.xml` | **ficam** `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS`, `WAKE_LOCK`, `INTERNET` (o Tauri precisa dela no desenvolvimento) e o `FileProvider` |
| `servico.ts` | só o motivo novo e `foneConectado()` |
| `gravador.ts` | fica a abertura do **microfone cru** (`echoCancellation`, `noiseSuppression` e `autoGainControl` desligados, mono), além de `motivoDoErro`, o medidor e o `MediaRecorder`. Vira a base de `escuta.ts` |
| `gravacoes.ts` | o padrão IndexedDB (paginação, `comLimite`, novas tentativas de abrir) vira `armazenamento.ts`, com `percursos`, `sessoes` e `audios`. Banco `nk-dados` |
| `tom.ts` | vira `apito.ts`: `AudioContext` próprio criado no toque, guarda de geração e onda simples, sem `INSTRUMENTOS`. Trazer `atrasoDeSaida()` de `metronomo.ts` |
| `preferencias.ts` | o padrão "ler e validar sempre"; chaves novas: atraso, sensibilidade, tempo morto, percurso padrão |
| `ItemGravacao.svelte` | vira `ItemTentativa.svelte` (ouvir, enviar, apagar com duplo toque) |
| `ControleAndamento.svelte` | vira um controle genérico `− valor +` para atraso, sensibilidade e tempo morto |
| `ListaRecentes.svelte` + `cabem.ts` | percursos recentes (opcional) |
| `licencas.ts`, `licencas-textos.ts`, `docs/licencas-de-terceiros.md` | só o que sobrar de terceiros |
| `src/routes/` | `+page.svelte` (abas novas), `+layout.svelte`, `ajustes/+page.svelte` (ficam aparência, idioma e créditos; saem os pacotes) |
| `tests/e2e/karaoke.mjs` | vira `tests/e2e/timer.mjs`, com o mesmo esqueleto (Vite, Chrome mudo, `invoke` simulado) mais as flags de microfone falso |
| `.github/workflows/ci.yml` | sai o job `conversor`; `leitor` vira "Rust (src-tauri)"; o job web perde `test_gerar_partituras.py` e `test_montar_pacote.py` |
| testes que ficam | `gravador`, `gravacoes`, `compartilhar`, `preferencias`, `erros`, `servico`, `tom` (→ `apito`), `estilos`, `licencas` |
| docs | `README.md`, `apk-de-teste.md` (sem conteúdo embutido), `release-e-apk-no-github.md`, `teste-de-uso.md` (reescrito para o estande), `FORMATO.md` (reescrito para o JSON do Nicska) |

**Sai (música):**

| Onde | O quê |
|---|---|
| `src/lib/` | `Afinador.svelte`, `afinador.ts`, `afinadorPrefs.ts`, `AndamentoDoTopo.svelte`, `AvisoHinario.svelte`, `biblioteca.svelte.ts`, `Busca.svelte`, `compassos.ts`, `contagem.ts`, `ControleDeTamanho.svelte`, `compartilharFormato.svelte.ts`, `compartilharPrefs.ts`, `gravacaoEmCurso.svelte.ts`, `hinario/`, `instalando.svelte.ts`, `instrumentos.ts`, `karaoke.ts`, `leitura.ts`, `letra.ts`, `LinhaPacote.svelte`, `Metronomo.svelte`, `metronomo.svelte.ts`, `metronomoPrefs.ts`, `metronomo.ts` (depois de levar `atrasoDeSaida`), `Miniplayer.svelte`, `notacao.ts`, `notacao.svelte.ts`, `notas.ts`, `numero.ts`, `pacote.ts`, `Partitura.svelte`, `partitura.css`, `partitura.ts`, `partituras/`, `Player.svelte`, `realista.ts`, `reproducao.svelte.ts`, `rotulo-vez.ts`, `sintetizador.ts`, `sons/`, `timbres.json`, `timbres.ts`, `vezes.ts`, `fonts/Leipzig.woff2` |
| `src/lib/Gravador.svelte` | **fica só até a Etapa 1**, como aba "Calibrar" para gravar tentativas cruas; sai depois |
| `src/routes/` | `hino/` |
| `src-tauri/` | `src/hinario.rs`, `src/pacote.rs`, `src/svg.rs`, `exemplo/` |
| raiz | `content/` |
| `tools/` | `mscx2json/`, `gerar-partituras.py`, `montar-manifesto-*.py`, `montar-pacote.py`, `preparar-sons.py`, `baixar-sons-gm.py`, `baixar-sons-teste.sh`, `analisar-timbres.py`, `previas-timbres.mjs`, `renderizar-banco.mjs`, `test_gerar_partituras.py`, `test_montar_*.py` |
| `tests/` | `amostras.ts` e os testes das partes que saem |
| `docs/` | `correcoes-da-letra.md`, `pacote-*.md`, `roadmap-*.md` (substituídos por este), `roadmap-e2e-karaoke.md`, `archive/`. O `roadmap-ideas.md` recomeça vazio, só com o modelo `I-NN` |

---

## 4. Fases e etapas

| Fase | Etapas | Entrega |
|---|---|---|
| **1 — Local** | 0 a 7 | timer, detecção, revisão, histórico, gráficos, APK validado no estande |
| **2 — Compartilhar** | 8 e 9 | JSON pelo WhatsApp, percurso compartilhado, ranking local |
| **3 — Web** | 10 e 11 | site com upload e ranking |

### Etapa 0 — Repositório limpo

- [x] Copiar o biblioteca-musical (comandos da seção 3), sem histórico.
- [ ] Criar `HyakoV3/nicska` no GitHub e fazer o primeiro commit. **(depende do responsável: regra de co-autoria do projeto)**
- [x] Renomear tudo (tabela "Adaptar"), incluindo o identificador (D3, provisório) e o prefixo (D9).
- [x] Remover a parte de música (tabela "Sai") e as dependências que ficam sem uso.
- [x] Montar a concha: abas `Timer | Histórico` (mais `Calibrar`, provisória), mais Ajustes (aparência, idioma, créditos); textos novos nos 3 idiomas; ícone provisório (Ч em anel de alvo).
- [ ] CI verde e segredos do Claude Code Review cadastrados. **(depende do repositório no GitHub)**
- [x] APK de teste abrindo no aparelho (confirmado em 2026-11-22; o gravador da aba Calibrar funcionou).
- [ ] Trocar o conjunto de ícones da interface (`icones.json` ainda traz os desenhos de música).

**Pronto quando:** `npm run check`, `npm test`, `cargo test --lib` (em `src-tauri`) e os verificadores (`traducoes`, `movimento`, `contraste`) passarem, o CI estiver verde e o APK abrir com as abas vazias. Uma busca por `hino|bibliotecamusical|BmServico` não deve achar nada fora do histórico.

### Etapa 1 — Calibração com áudio real (começa já, em paralelo à 0)

- [ ] Gravar 10–20 tentativas com o **Gravador** (aba Calibrar), que já grava o microfone cru, ou filmar com o celular. O vídeo dá para analisar aqui no chat: extraio o áudio e confiro cada disparo no quadro. Posicionar o celular onde ele ficaria no app (bolso, cinto ou mesa) e usar como apito outro aparelho ou um timer.
- [ ] Ter um gabarito: um timer comercial ao lado (anotar 1º disparo, splits e total) ou um vídeo a 60 fps ou mais.
- [ ] Gravar também os casos difíceis: baia vizinha atirando, baia coberta (eco), splits rápidos, recarga e transição.
- [ ] Escrever `tools/analisar-tentativas.py` (numpy/scipy, fora do app): envelope, limiar, tempo morto e Goertzel do apito, com um relatório por tentativa contra o gabarito.
- [ ] Medir subida e pico do tiro, duração do eco, nível dos vizinhos e o menor split real.
- [ ] Conferir se o Opus a 64 kbps desloca o início do tiro em relação a um WAV. Se deslocar, o app grava PCM.
- [ ] Registrar os números em `docs/calibracao.md` (números, não impressões).

**Pronto quando:** os valores padrão de limiar, tempo morto e frequência do apito estiverem escolhidos com dados, e o detector offline acertar a contagem em pelo menos 95% das tentativas.

### Etapa 2 — Motor de detecção

- [x] `src/lib/detector.ts`, puro, com `detectarApito()`, `detectarDisparos()` e a classe incremental `Detector` (quadro a quadro, estado mínimo). A mesma lógica serve ao worklet e ao reprocessamento. O disparo é uma subida sobre a "cauda" que decai (ver `docs/calibracao.md`), não limiar fixo.
- [x] `src/lib/escuta.worklet.ts`: conta amostras, roda o `Detector` e manda pela `port` os eventos (`apito`, `disparo`), cada um com o número da amostra, mais um envelope reduzido para a tela (um ponto a cada ~5 ms).
- [x] Verificar como carregar o worklet no build estático do SvelteKit (`audioWorklet.addModule(new URL(..., import.meta.url))`).
- [x] `src/lib/escuta.ts`: abre o microfone cru (código de `gravador.ts`) e liga o worklet e o `MediaRecorder` ao mesmo fluxo.
- [x] vitest com sinais sintéticos: cada disparo a ±1 ms, eco 30 ms depois ignorado, dois disparos a 100 ms contados como dois, ruído de fundo, apito com e sem ruído, apito ausente (início marcado como `estimado`).
- [ ] Fixtures curtas reais da Etapa 1 no Git (WAV mono de poucos segundos), testadas contra o gabarito. (Os dois vídeos de treino estão em `tests/fixtures/`, fora do Git por terem voz; `detector-real.test.ts` confere apito e 1º tiro. Falta o gabarito.)
- [x] e2e `tests/e2e/timer.mjs`: Chrome com `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>`. O Chrome repete o arquivo; `%noloop` no fim do caminho evita. O e2e gera o próprio WAV (apito + 4 tiros) e confere os tempos a ±25 ms (deu ±1 ms).
- [ ] No aparelho: o `AudioWorklet` roda no WebView? O `getSettings()` da trilha confirma os filtros desligados? Qual a latência de entrada? O que acontece com a tela apagada?
- [ ] **Plano B, só se o worklet falhar:** captura nativa em Rust com o mesmo algoritmo portado.

**Pronto quando:** o e2e com WAV real acertar o mesmo que o offline e, no aparelho, a detecção em tempo real não perder disparo.

### Etapa 3 — Timer: apito e fluxo de uma tentativa

- [x] `apito.ts` (a partir de `tom.ts`): `AudioContext` próprio criado no toque, apito agendado no relógio de áudio (feito na Etapa 0; frequência e onda ainda são hipóteses da Etapa 1).
- [x] Ganho alto sem estourar (0,8), com frequência e duração vindas da medição (2700 Hz, 0,5 s). Falta confirmar com gravação crua do app.
- [x] Máquina de estados pura (`src/lib/timer.ts`, `tests/timer.test.ts`), testada com relógio falso: `parado → preparando ("Standby") → atraso → apito → escutando → resultado`, com cancelar em qualquer ponto.
- [x] Atraso aleatório entre mínimo e máximo (padrão 1–4 s, configurável) ou fixo.
- [x] Parar a escuta: botão, X s sem disparo depois do último (padrão 5 s, configurável; valor final da Etapa 1) ou tempo máximo (180 s).
- [x] Serviço Android com o motivo `armado` e wake lock enquanto armado; notificação com "Parar" (ligados à aba Timer; falta provar no aparelho com a tela bloqueada).
- [x] Um som de cada vez. Se o áudio for perdido (ligação, outro app), cancelar e avisar na tela, como o metrônomo faz com `onstatechange`.
- [x] Gravar o áudio da tentativa junto (Opus a 64 kbps no `MediaRecorder`; PCM se a Etapa 1 mostrar deslocamento). O áudio vai no resultado; guardar no IndexedDB é a Etapa 5.
- [x] Tela: botão grande, estado em texto (não só cor), tempo do último disparo em dígitos grandes, contador de disparos e splits ao vivo. O leitor de tela anuncia só o início, o fim e o resultado, nada durante a tentativa.
- [x] Com fone ou abafador Bluetooth (`foneConectado()`), avisar que o apito sai nele e que o início fica estimado.

**Pronto quando:** uma tentativa completa funcionar no aparelho, com o apito detectado no microfone, os splits ao vivo e o resultado.

### Etapa 4 — Resultado e revisão

- [x] Resultado: total, 1º disparo, splits, maior split e número de disparos. O HF entra com a pontuação (Etapa 5).
- [x] Linha do tempo com o envelope e as marcas: tocar perto de uma marca a seleciona; em outro ponto põe o cursor. Apagar (duplo toque), inserir e ouvir o trecho, também sem tocar na figura (controle deslizante e botões).
- [x] Reprocessar com outra sensibilidade ou outro tempo morto: decodificar o áudio guardado (`decodeAudioData`) e rodar o `detector` puro.
- [x] Marcar `editada` (quantos disparos apagados e inseridos) e `inicio` (`detectado` ou `estimado`).
- [x] Salvar ou descartar.

**Pronto quando:** corrigir um falso disparo recalcular tudo na hora, e reprocessar com os mesmos parâmetros der o mesmo resultado que a escuta ao vivo.

### Etapa 5 — Percursos, sessões e histórico

- [x] Modelo e formato da seção 6; `docs/FORMATO.md` reescrito (compartilhar `nicska/1` e backup `nicska-backup/1`).
- [x] `armazenamento.ts` (IndexedDB, sobre o `banco.ts` genérico) com `percursos`, `tentativas` e `audios`, paginação e `comLimite`. A sessão não é guardada: sai das tentativas (`agruparEmSessoes`).
- [x] Percursos: criar (nome, disparos opcionais) com drills prontos como sugestão, apagar e editar (nome, disparos, pontos máximos, divisão).
- [x] Sessão = um percurso num dia.
- [x] Pontuação opcional (A/C/D/M/NS/procedimentais, fator minor ou major) e HF, ao salvar ou depois no Histórico; % dos pontos do percurso quando há pontos máximos.
- [x] Histórico por percurso, sessões por dia, ouvir o áudio e apagar com duplo toque.
- [x] **Backup:** "Exportar backup" (JSON, sem áudio) e "Importar backup" (validado, sem duplicar nem sobrescrever). Ida e volta testada (`tests/armazenamento.test.ts`). Limpar os dados do app apaga o IndexedDB.

**Pronto quando:** fechar e reabrir o app mantiver tudo, e o ciclo backup → limpar dados → importar devolver exatamente o mesmo.

### Etapa 6 — Gráficos e comparação

- [x] Componentes SVG (`Grafico.svelte`, `Barras.svelte`) com tema por variáveis CSS e tamanhos em `rem` (o SVG é desenhado 1:1 com a tela, então a fonte a 200% cresce o texto). Sem animação, então o movimento reduzido já é respeitado.
- [x] Total e 1º disparo (médias) por sessão (linha).
- [x] Splits de uma tentativa por índice do disparo (barras), com o maior split em destaque (contorno e "▲").
- [x] Sobreposição por sessão (tempo médio até cada disparo) e distribuição dos splits (% por faixa). **Parcial:** a sobreposição é da média de cada sessão, não de cada tentativa solta (com muitas tentativas viraria um borrão e as formas de marcador acabam em 4).
- [x] Comparar até 3 sessões do mesmo percurso: tentativas, melhor total, média, mediana e desvio do total, 1º disparo médio, e média, mediana, desvio e melhor dos splits.
- [x] Acessibilidade: "Ver como tabela" em cada gráfico; cada série tem cor, marcador (círculo, quadrado, triângulo, losango) e tracejado diferentes.

**Pronto quando:** 3 sessões puderem ser comparadas offline, legíveis com o celular em pé e deitado e com a fonte a 200%.

### Etapa 7 — APK de teste e validação no estande

- [x] APK de teste no fluxo de `apk-de-teste.md`, com o nome do arquivo terminando no commit (zips 001 a 009).
- [x] Roteiro de teste no estande (`docs/teste-de-uso.md`), com o modelo de planilha (`docs/modelo-timer.csv`) e `tools/comparar-com-timer.py`, que confere os critérios de 95% na contagem e ±10 ms por disparo contra o timer comercial. O Timer mostra um diagnóstico (taxa, filtros do microfone, latência de saída) para o teste no aparelho.
- [ ] Cumprir os critérios de aceitação da seção 9.

**Pronto quando:** os critérios forem cumpridos com um timer comercial ao lado. **(depende do responsável: estande e timer emprestado)**

### Etapa 8 — Exportar e importar JSON (fase 2)

- [x] Exportar uma sessão ou um percurso pela `PonteCompartilhar` (`application/json`), com o nome `nicska-<percurso>-<data>.json`.
- [x] Importar: *intent-filter* `ACTION_VIEW`/`ACTION_SEND` para `application/json`. Como o WhatsApp às vezes manda `application/octet-stream`, conferir também a extensão. A `MainActivity` entrega o arquivo à WebView, e há também um botão "Importar arquivo".
- [x] Validar (feito em TypeScript, `lerDocumento`, e não em Rust: o mesmo código já valida o backup, com testes; D6 fica para o servidor da fase 3) com limites: tamanho do arquivo, número de tentativas, disparos crescentes, positivos e abaixo de 10 min, versão do formato conhecida.
- [x] Deduplicar pelo `id` da tentativa; tentativas importadas ficam com o atirador de origem.
- [x] Percurso compartilhado: o JSON do percurso, sem tentativas. QR fica para depois.

*Feito em 2026-11-22; falta testar no aparelho (WhatsApp → Abrir com Nicska, em outro celular).*

**Pronto quando:** um JSON enviado pelo WhatsApp e aberto no Nicska de outro celular for importado sem erro e sem duplicar.

### Etapa 9 — Comparar pessoas (ranking local)

- [x] Tabela por percurso e divisão, com melhor marca, média e HF de cada atirador.
- [x] Regras da seção 7.

*Feito em 2026-11-22 (`ranking.ts`, `Ranking.svelte`, dentro do percurso aberto no Histórico; aparece quando há tentativas de outra pessoa; filtro por divisão; critério HF se todos pontuaram, senão tempo; tentativas de início estimado ou editadas são sinalizadas). Falta testar com 3 pessoas reais.*

**Pronto quando:** 3 atiradores importados aparecerem ranqueados corretamente num percurso.

### Etapa 10 — Site (fase 3)

- [ ] Escolher a pilha (D10), com PostgreSQL e nginx + compose na infra própria.
- [ ] Upload arrastando o arquivo. Depois, botão no app, com o `plugin-http` liberado só para o domínio do site.
- [ ] Ranking por percurso e divisão (*view* SQL) e página do atirador.
- [ ] Identidade: só apelido com um código secreto, ou conta? (pergunta aberta)
- [ ] Privacidade: só apelido, botão "apagar meus dados", nenhum rastreamento.

### Etapa 11 — Confiança dos dados

- [ ] Escolher entre as opções da seção 7 antes de abrir o site ao público.

---

## 5. Como a detecção funciona

- **Microfone cru**, como o `gravador.ts` já abre: `echoCancellation: false`, porque com o cancelamento de eco ligado o celular **apaga o próprio apito** do microfone; `autoGainControl: false`, porque o controle automático baixaria o ganho depois do 1º tiro e perderia os seguintes; `noiseSuppression: false`.
- **`AudioWorklet` contando amostras** (blocos de 128 amostras, ~2,7 ms a 48 kHz; precisão abaixo de 1 ms). O `AnalyserNode` do medidor não serve para isso: ele é lido no `requestAnimationFrame` (~16 ms) e não diz em que amostra o pico aconteceu.
- **Apito:** tom fixo, detectado no microfone com Goertzel na frequência dele. O instante zero (`t0`) é o início do apito **como o microfone ouviu**, o que anula a latência de saída, inclusive com caixa Bluetooth.
- **Disparo:** envelope de ~1 ms; conta quando passa do limiar **e** sobe muito rápido (tiro tem subida curtíssima; voz e passos não). Depois vem o **tempo morto**, para não contar eco nem o rebote do microfone saturado. Hipótese: 40 a 80 ms, decidido na Etapa 1. Splits de atletas rápidos ficam perto de 0,1 s, então o tempo morto não pode chegar perto disso.
- **Sem apito detectado:** usa o instante agendado mais `atrasoDeSaida()` e marca `inicio: "estimado"`.
- **Áudio guardado:** Opus a 64 kbps dá ~8 KB/s, então 20 s ocupam ~160 KB. Serve para revisar, reprocessar e auditar.

## 6. Formato JSON v1

Só os instantes dos disparos são guardados, em ms desde o apito. Splits, total e HF são **derivados**. O armazenamento local guarda o **mesmo documento** que é compartilhado, então exportar é copiar.

```json
{
  "formato": "nicska/1",
  "app": "0.1.0 (a1b2c3d)",
  "atirador": { "id": "6f1c…", "nome": "Atirador" },
  "divisao": "Production",
  "percurso": { "id": "3e9a…", "nome": "Bill Drill", "disparos_minimos": 6, "pontos_maximos": 30 },
  "tentativas": [
    {
      "id": "b7d2…",
      "data": "2026-11-21T20:15:03-03:00",
      "atraso_ms": 2310,
      "inicio": "detectado",
      "disparos_ms": [1480, 1730, 1975, 2210, 2460, 2700],
      "editada": { "apagados": 0, "inseridos": 0 },
      "pontos": { "A": 5, "C": 1, "D": 0, "M": 0, "NS": 0, "procedimentais": 0, "fator": "minor" },
      "detector": { "versao": 1, "sensibilidade": 0.6, "tempo_morto_ms": 60 },
      "audio_sha256": "9c4e…"
    }
  ]
}
```

O exemplo dá: 1º disparo **1,48 s**; splits 0,250 / 0,245 / 0,235 / 0,250 / 0,240; total **2,70 s**; pontos 5×5 + 1×3 = 28; HF = 28 ÷ 2,70 = **10,37**.

- `pontos` é opcional: só tempo também vale.
- **Nada de dado sensível:** sem número de série da arma, sem CR ou documento; só apelido.
- Versão maior nova (`nicska/2`) = formato incompatível. Campos novos dentro de `nicska/1` são ignorados por versões antigas.

## 7. Ranking e confiança

- **Tempo puro** só compara o mesmo percurso e quando todo acerto vale igual (drill "todos A").
- **Hit factor** = pontos ÷ tempo. Major: A5, C4, D2. Minor: A5, C3, D1. Miss, no-shoot e procedimental valem −10 cada. Na prova, a pista vale (HF ÷ melhor HF) × pontos máximos.
- **Separar por divisão** (Production, Standard, Open…).
- **Confiança:** JSON é texto e qualquer um edita. Assinar no app não resolve, porque a chave fica no aparelho de quem quer trapacear. As opções são:
  - ranking entre amigos ou clube, com confiança;
  - marcar tentativas editadas ou com início estimado;
  - subir o áudio para auditoria (o `audio_sha256` amarra áudio e tentativa);
  - validação por um RO ou clube.

## 8. Riscos

| Risco | Mitigação |
|---|---|
| `AudioWorklet` não funcionar bem no WebView | testar cedo (Etapa 2); plano B em Rust nativo |
| Tiros das baias vizinhas | limiar relativo, celular perto do atirador, revisão manual |
| Eco em baia coberta | tempo morto calibrado |
| Microfone saturado | usar só o início do tiro, nunca a intensidade |
| Apito fraco (abafador passivo, estande barulhento) | volume máximo, caixa Bluetooth (o apito detectado no microfone compensa o atraso) |
| Perder dados ao limpar o app | backup em JSON (Etapa 5) |
| Divergir do biblioteca-musical nas peças irmãs | lista de peças irmãs (seção 3); portar correções à mão |
| Trocar o identificador depois de publicar | decidir D3 na Etapa 0 |

## 9. Critérios de aceitação da fase 1

- **vitest:** impulsos sintéticos detectados a ±1 ms; eco 30 ms depois não conta; dois disparos a 100 ms contam dois; a máquina de estados do timer cobre cancelar em cada estado.
- **No estande, contra um timer comercial:** mesmo número de disparos em pelo menos 95% das tentativas e diferença de até 10 ms por disparo. As metas serão confirmadas com os dados da Etapa 1.
- **Latência anulada:** com caixa Bluetooth, o 1º disparo medido não muda mais que ~10 ms em relação ao alto-falante do celular.
- **Revisão:** apagar ou inserir um disparo recalcula na hora e marca a tentativa como editada.
- **Comparação:** 3 sessões comparadas offline.
- Nada sai do aparelho sem a pessoa mandar.

## 10. Pesquisar antes de construir

- Shot timers que já existem, em app e dedicados (AMG Lab Commander, CED7000): frequência e duração do apito, atraso, sensibilidade, tempo morto, o que fazem bem e onde falham.
- Regras atuais da IPSC (sinal de início, pontuação) e da CBTP.
- `AudioWorklet` no WebView do Android via Tauri e o carregamento do worklet no build estático do SvelteKit.
- Abrir no app um `.json` recebido pelo WhatsApp (*intent-filter* no Tauri Android, tipo MIME real que o WhatsApp manda).
- Registros de marca (INPI, USPTO, EUIPO) e domínios para "Nicska", que a pesquisa de nome não conseguiu consultar.

## 11. Perguntas em aberto

1. **D3:** qual identificador do app?
2. **Uso principal:** treino sozinho (celular no bolso, cinto ou mesa) ou com alguém segurando, como o RO na prova?
3. **Atraso:** aleatório 1–4 s configurável? Ter também um modo "apito imediato"?
4. **Pontuação** já na fase 1, ou só tempo?
5. **Divisões e armas:** lista fixa da IPSC ou texto livre?
6. **Áudio:** guardar sempre ou só até salvar a tentativa?
7. **Site:** ranking público ou só por grupo ou clube, com convite?
8. **iOS:** quando? É a mesma questão da conta Apple do biblioteca-musical.

## 12. Identidade visual

- **Texto sempre latino:** "Nicska" no código, na loja, no README e no JSON. Cirílico só como desenho.
- **Proposta:**
  - a marca escrita "NICSKA" em latim; se houver assinatura em cirílico, a grafia certa do som é **Ниска** (não "Ничка", que seria "Nítchka");
  - **o ícone provisório com a letra Ч não combina mais**: o Ч é o som "tch", que o nome não tem. A trocar (decisão em aberto: N latino, mira ou cronômetro dentro do anel de alvo).
- **Evitar o "falso cirílico"** (И no lugar de N, Д no lugar de A). Quem lê russo enxerga outras letras ("ИICSKД" vira algo como "iicskd"), o estilo virou clichê e, se for parar no nome como texto, quebra a busca e o leitor de tela.
- No SVG da marca, converter o texto em curvas e pôr `aria-label="Nicska"`.
- Dose pequena: num app de tiro, estética russa demais pode soar militar para parte do público.

## 13. Depois (fora deste plano)

- Par time (segundo apito).
- Tiro em seco.
- Marcar transição e recarga automaticamente.
- Anunciar o tempo por voz no fim da tentativa.
- Exportar CSV.
- QR do percurso.
- iOS.

## 14. Primeira sessão de trabalho

1. Etapa 1, hoje: separar o celular com o biblioteca-musical para gravar no próximo treino e pedir emprestado um timer comercial.
2. Decidir D3 (identificador).
3. Etapa 0: copiar, renomear, remover e deixar o CI verde, numa PR só ("Base limpa"). Depois abrir uma PR por etapa, com o Claude Code Review como hoje.
