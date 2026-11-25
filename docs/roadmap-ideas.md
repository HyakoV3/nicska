# Nicska — roadmap de ideias

Ideias ainda não decididas ou só parcialmente feitas. Nada aqui está prometido: cada uma vira trabalho (e item de [`roadmap-pendencias.md`](roadmap-pendencias.md)) só depois de o responsável aprovar. O que já está feito vai para [`archive/roadmap-implementadas.md`](archive/roadmap-implementadas.md). Atualizado em 2026-11-23.

## Estado de cada ideia

| Ideia | Estado | O que falta |
|---|---|---|
| I-01 batidas | **feita** (APK 019) | validar no aparelho (a taxa real do `devicemotion` ainda não é registrada pelo app); batidas pelo microfone; vibração "entendi" já é distinta no código (80 ms × 250 ms × 40-60-40), falta sentir no aparelho se a de 80 ms emenda na de 250 ms; **batidas com a tela bloqueada** (decisão) |
| I-01 fala ("standby" por voz) | aberta, grande | só com módulo nativo e modelo offline (Vosk?) |
| I-02 áudio Ogg/Opus | **feita** | testar WhatsApp, Business, Telegram, Signal |
| I-03 voz "Standing by" | **feita** (voz Spruce seca); **vibração 3/2/1 feita** (2026-11-24) | licença da voz; volume com abafador; "Reload and Standing By" (padrão desligado); "voz normal" como opção (o **bipe já é opção**: `standbyBipe`; o aviso "só em treino" já existe) |
| I-04 tempos sobre o vídeo | **feita pelo caminho do vídeo gravado** (V1 a V3: overlay + exportar "Com os tempos") | importar vídeo de fora e rodar o `detector.ts` nele; exportar `.srt`/`.ass` |
| V4 quadro a quadro e comparação | aberta | WebCodecs; medir contra o detector |
| Restos do vídeo | abertas | 4K (depende do S1); posição ajustável do overlay; tela cheia nativa do `<video>` perde o overlay; vídeos órfãos; retenção apagar o recém-salvo; trocar `mp4-muxer` por `mediabunny` (MPL-2.0, decisão sua); avatar viajar (P0b: depende de CONS-014, CSP ativa e validador de cabeçalho) |
| Varredura "Testar apito" | aberta, só se o apito for fraco | medir aliasing do `tanh`; apito e detector já aceitam outra frequência por parâmetro, falta a preferência e a tela |
| Apito com mais de uma baia ativa | parcial (janela do apito feita) | avaliar no estande; é validação de campo, não ideia |
| Histórico: editar itens da tentativa | parcial (a pontuação já se edita no Histórico) | trocar percurso e outros campos depois de salva |
| Nota de desempenho estilo fliperama (S, A, B, C, D) | aberta | derivar do HF ou dos seus tempos |
| Parar a gravação sem segurar 1 s (ideia do mantenedor, 2026-11-24) | aberta, só ideia | hoje o botão exige segurar ~1 s para parar com a tentativa correndo (evita parar sem querer). A dúvida levantada: isso pesa na velocidade? Pelo código, não: o `Segurar` só roda com o dedo no botão e só mexe na barra dele. Alternativas a avaliar: toque duplo, deslizar para confirmar, ou toque simples com desfazer. Se o diagnóstico de desempenho mostrar travada só no fim da fase "correndo", reavaliar |
| Detalhes de interface | abertos | trilha preenchida do slider; Salvar fixo embaixo; acordeão exclusivo no resultado (o `Cartao` já aceita `name`, falta usar); ícone monocromático do Android (**regrediu**: o `ic_launcher.xml` atual não tem `<monochrome>`); SVG da fase 4 e ícone da fase 3 em quadrado |

> **Revisão pedida ao Opus 5 (2026-11-23):** conferir cada ideia contra o código e as docs (já atendida, parcial ou do zero) e anotar o resultado na seção "Revisão das ideias (Opus 5, 2026-11-23)" no fim deste arquivo.

---

# Ideias (rascunho, fora do roadmap)

Ideias ainda não decididas. Nada aqui está prometido: cada uma vira etapa em `roadmap-desenvolvimento.md` só depois de o responsável aprovar.

## I-01 — Ativar o Standby sem tocar na tela (fala ou batidas)

**Problema.** No estande a pessoa está com a pistola nas mãos, o celular preso ao corpo ou apoiado, e abafador de ruído. Apertar o botão grande atrapalha a preparação.

**Ideia.** Além do botão, o Standby pode ser disparado por:
1. **Fala:** dizer "standby" (a palavra que o RO usa).
2. **Batidas:** uma pancada dupla ou tripla no celular (ou perto dele).

Ao reconhecer o comando, o app faz o mesmo que o botão: sorteia o atraso (1 a 4 s) e dá o apito. Vibração curta confirma que entendeu, já que a pessoa usa abafador.

### Batidas

- **Melhor com o acelerômetro** (sensor de movimento do Android) do que com o microfone: não grava nada, gasta pouco e não confunde com o tiro do vizinho. Precisa de uma ponte nativa pequena (`NkSensores`).
- **Com o microfone** também dá: o detector de início de som que já existe acha a pancada. Serve se o celular estiver apoiado sem encostar no corpo.
- **Padrão para valer:** 2 (ou 3) pancadas com intervalo de 120 a 1000 ms entre elas e 600 ms de silêncio para confirmar (é o que o código usa, `batidas.ts:19-23`), e silêncio logo depois. Uma pancada solta, ou um padrão fora desse ritmo, é ignorado. O número de pancadas (2 ou 3) é configurável.
- Só vale no modo "aguardando comando", nunca durante a escuta de uma tentativa.

### Fala

- O reconhecimento de voz do Android (`SpeechRecognizer`) depende de rede ou de modelo baixado, e no WebView a Web Speech API não é confiável. Para funcionar **offline** o caminho mais sólido é uma biblioteca de palavra-chave local (por exemplo Vosk, com modelo pequeno) rodando num módulo nativo. Antes de construir, pesquisar o que já existe (regra "não reinventar a roda").
- Ruído de estande (tiros, vento, abafador) piora muito o reconhecimento. Provavelmente só funciona bem fora da linha de tiro ou com fone com microfone.
- Idiomas: "standby" é a palavra do IPSC em qualquer língua, então um modelo só da palavra-chave basta; não precisa reconhecer frases.

### Cuidados

- **Fala (se um dia vier) = microfone aberto o tempo todo** no modo "aguardando comando": bateria, privacidade (nada é gravado nem sai do aparelho; dizer isso em Ajustes e no "Sobre") e o indicador de microfone do Android ficará aceso; por isso opt-in e com limite de tempo. **As batidas não usam microfone** (acelerômetro), mas mantêm a **tela acesa** enquanto esperam, então também têm limite: **10 minutos** (feito; recomeça ao usar o timer).
- **Falso positivo é pior que falso negativo.** Um Standby sem querer dá um apito no meio da linha. Preferir exigir o padrão completo e confirmar com vibração.
- **Tiros de baias vizinhas** soam como batidas no microfone: mais um motivo para o acelerômetro ser o padrão.
- Acessibilidade: ajuda quem tem dificuldade de tocar a tela, então vale também fora do estande.

### Minha opinião

Faz sentido, e **as batidas valem mais que a fala**: são baratas, offline, funcionam com abafador e com barulho. Sugestão de ordem:

1. **Batidas pelo acelerômetro** (2 ou 3, configurável), com vibração de confirmação.
2. Batidas pelo microfone como alternativa.
3. **Fala** só depois, se ainda fizer falta, porque pesa mais (modelo offline, ruído, bateria) e rende menos no estande.

### Estado (2026-11-22)

**Batidas: implementadas, falta o teste no aparelho.** Ajustes do Timer → "Iniciar com batidas no celular": Desligado, 2 ou 3 batidas. Usa o acelerômetro (`devicemotion` da WebView), sem microfone: `src/lib/batidas.ts` (detector puro, 16 testes com sequências inventadas) e a ligação em `Timer.svelte`. Regras: pico de mais de 7 m/s² sobre a média lenta; intervalo de 90 a 600 ms entre batidas; 350 ms de silêncio confirmam o padrão (bater a mais cancela); só vale com o timer parado, a aba aberta e a **tela ligada** (a WebView não lê sensores com a tela apagada; o app pede para a tela não apagar enquanto espera); vibra 80 ms ao entender; se o aparelho não mandar o sensor em 2 s, avisa e deixa o botão. Testado no Chrome com eventos inventados (2 batidas iniciam, 1 não). **Falta calibrar no aparelho:** o limiar de 7 m/s² e o ritmo (celular na mão, no bolso, no cinto, em cima da mesa).

**Fala: não implementada, de propósito.** A fala exige código nativo (o `webkitSpeechRecognition` consta na WebView, mas na prática depende do serviço do Chrome e não foi testado; o `speechSynthesis` não existe na WebView) (Kotlin) e um motor de reconhecimento **offline**: o `SpeechRecognizer` do sistema para a cada poucos segundos, apita ao reiniciar e depende do pacote de voz instalado; uma biblioteca de palavra-chave local (por exemplo Vosk, modelo pequeno) é mais firme, mas traz uns 40 MB e disputa o microfone com a escuta. Não dá para validar isso aqui sem o aparelho, e o ruído do estande piora muito o reconhecimento. Decidir depois de testar as batidas no estande.

### Perguntas em aberto

- O celular fica onde durante a tentativa (bolso, cinto, tripé)? Isso decide se a batida vai no aparelho ou perto dele.
- Dupla ou tripla como padrão? (Dupla é mais fácil de fazer sem querer.)
- A fala vale a complexidade, ou as batidas já resolvem?
- ~~Por quanto tempo o modo "aguardando comando" pode ficar ligado de uma vez?~~ Decidido: 10 min, depois pede para usar o botão (revisão de 2026-11-22).

## I-02 — Enviar o áudio da tentativa como Ogg/Opus (trazido do BibliotecaMusical)

**Origem.** `BibliotecaMusical/docs/ideia-enviar-audio-por-app.md`. Lá já foi implementado (PR #133) e **funcionou no aparelho do responsável** (2026-11-22). O Nicska herdou o `compartilhar.ts` **antes** dessa melhoria, então ainda envia o áudio como `.webm`.

**Problema.** O áudio da tentativa é Opus dentro de WebM (`audio/webm;codecs=opus`), que o `MediaRecorder` do WebView grava. Pela folha de compartilhar do Android:
- `.webm` → o WhatsApp **recusou** ("formato não compatível") no aparelho do responsável. Provável causa (não confirmada): o Android deduz o MIME pela extensão e `.webm` vira `video/webm`.
- `.weba` → o WhatsApp **aceitou, mas como documento**, não como áudio (observado no aparelho; provável causa, não confirmada: a extensão não está na tabela de MIME e vira `application/octet-stream`).
- Trocar só o nome não resolve: é preciso o conteúdo certo **e** a extensão certa.

**Solução que funcionou.** Guardar WebM/Opus como hoje e, **na hora de enviar**, **remuxar sem reencodar** (só trocar a caixa) para **Ogg/Opus**, em TypeScript. Entrega `.ogg`, com o `type` do Intent `audio/ogg` **sem parâmetros**. Um formato só: sem tabela de apps nem lista de destinos. Sem perda, mesmo tamanho, funciona do Android 7 em diante (o `MediaMuxer` Ogg só existe no API 29+), e é testável no Vitest. Se o remux falhar, envia o original.

### Roadmap (o que o BibliotecaMusical fez, e o que trazer)

1. **Copiar** do BibliotecaMusical: `src/lib/webm.ts` (lê o WebM: `OpusHead` e a lista de pacotes com tempo), `src/lib/ogg.ts` (escreve o Ogg: páginas, CRC, `OpusHead`/`OpusTags`, granule; função `webmParaOgg`), `tests/ogg.test.ts` com `tests/fixtures/opus.ts` (duas gravações de 0,5 s em base64) e o trecho `prepararOgg` do `compartilhar.ts`.
2. **Ligar no envio:** ao compartilhar um áudio WebM/Opus, converter; nome `.ogg`; se falhar, enviar o original. Atualizar `nomeDoArquivo` (hoje `nicska-AAAA-MM-DD-HHMM.webm`).
3. **Ponte Kotlin** (`PonteCompartilhar.kt`): o `type` do Intent fica `audio/ogg` sem `;codecs=opus` (o Android compara o tipo por igualdade com o que os apps declaram).
4. **Apertar o `file_paths.xml`:** só `cache-path` (o envio não precisa de `external-path "."`, que expõe todo o armazenamento externo).
5. **Testar no aparelho:** WhatsApp (e Business), Telegram (pode virar nota de voz: não confirmado), Signal e Messages. Anotar: áudio, nota de voz ou documento.
6. **Gravações longas** (10, 30 e 60 min): tamanho, tempo do remux e memória. A 64 kbps são ~480 KB por minuto. Uma tentativa de tiro dura segundos, então aqui isto pesa pouco.
7. **Opcional:** `.m4a`/AAC com `MediaCodec`, só se algum destino recusar Ogg.

### Lições da revisão de lá (já valem para cá)

- Fechar a página Ogg por 255 valores de lacing, não só por contagem de pacotes.
- Validar o `OpusHead` e o TOC de cada pacote; descontar o `DiscardPadding`.
- Conferir que o `OpusHead` sai com **1 canal** (o `channelCount: 1` é pedido, não garantido).
- O WebM do Chrome pode vir com `BlockGroup` em vez de `SimpleBlock` e clusters de tamanho desconhecido: cobrir com fixtures **reais** (aqui, gravações do próprio app).

### O que muda para o Nicska

- **Para que serve aqui:** mandar o áudio de uma tentativa a um instrutor ou ao grupo do clube, para comparar o tiro ouvido com os tempos marcados. É diferente do **backup em JSON** (Etapa 8), que leva só números.
- **Onde entra:** botão "Enviar áudio" na tentativa (revisão e Histórico), usando o `compartilhar.ts` que já existe.
- **Privacidade:** nada sai do aparelho sem a pessoa escolher enviar; o áudio de estande pode ter vozes de outras pessoas, então o envio é sempre uma ação explícita.

### Estado

**Implementado (2026-11-22)**, falta o teste no aparelho. Passos 1 a 4 feitos: `webm.ts`/`ogg.ts` copiados com os testes e as fixtures; o envio converte WebM/Opus para Ogg e cai no original se falhar; o `type` do Intent já sai sem parâmetros (a ponte Kotlin é igual à de lá); `file_paths.xml` só com `cache-path`. Botão **Enviar áudio** na revisão e no Histórico. O áudio real gravado pelo app (Opus do Chrome) foi convertido, abre no `ffprobe` e decodifica no `ffmpeg`. **Falta (você no aparelho):** passo 5 (WhatsApp, Telegram, Signal, Messages: áudio, nota de voz ou documento) e conferir que o Ogg sai **mono** (o microfone falso do Chrome grava estéreo; o do celular costuma ser mono).

## I-03 — O celular diz "STAND BY" (voz de fliperama) e depois apita

**Origem.** Ideia do responsável (2026-11-22). Hoje, ao apertar Standby, o app fica em silêncio durante o atraso sorteado (1 a 4 s) e só então apita. Falta um sinal claro de que **começou**.

**Ideia.** Ao apertar Standby (ou dar as batidas), o celular **fala "STAND BY"**, e só depois de a voz terminar corre o atraso sorteado e vem o apito. É o que o RO faz no estande: comanda "Standby" e o sinal vem entre 1 e 4 s depois (a única regra da IPSC sobre o tempo, e ela é uma recomendação: "should", regra 8.3.3). Na tela, "STAND BY" grande durante a espera (o texto de estado já existe; aqui ele vira o destaque), e uma vibração curta no início.

**Voz.** O responsável gosta da voz robótica do anunciador do **Metal Slug**. Dá para chegar perto **sem copiar o áudio do jogo** (é material protegido da SNK):
- O que dá o "efeito fliperama": voz grave e áspera, amostra digital de baixa qualidade. Dá para imitar com uma voz sintetizada ou gravada e **processada**: taxa de amostragem baixa (8 a 11 kHz), 8 bits (efeito *bitcrusher*), um pouco de distorção e de realce nos médios, e talvez modulação em anel leve.
- **Caminho A, voz gravada** (melhor): o próprio responsável, ou alguém do clube, grita "STAND BY" num microfone; o `tools/` do repositório aplica os efeitos e gera um arquivo pequeno (Opus ou Ogg, uns 10 a 20 KB). Sem problema de licença e com a cara do clube.
- **Caminho B, voz sintetizada:** um TTS offline do computador (por exemplo o espeak-ng) gera a frase e o mesmo script aplica os efeitos. Também vira arquivo pronto.
- **Não usar** o `speechSynthesis` do WebView: a voz depende do celular, muda de aparelho para aparelho, não passa pelos nossos efeitos nem pelo relógio do áudio. O arquivo pronto toca no mesmo `AudioContext` do apito, então o instante em que a voz acaba e o atraso começa é exato.
- **Mais de uma opção em Ajustes:** voz robô (padrão), voz normal, só um bipe curto, silêncio (só a tela). E, se quiser parte do ritual da IPSC: "Are you ready?" e "Standby". **Nunca "Load and make ready"** (ver a revisão abaixo: mandar carregar a arma por um app é risco de segurança, sobretudo no treino em seco).
- **Volume:** a voz precisa ser ouvida com o abafador, como o apito: mesmo cuidado de nível (pico perto do fundo de escala).
- **Idiomas:** "STAND BY" é o comando do esporte em qualquer língua; um arquivo só serve aos três idiomas do app.

**Cuidados técnicos.**
- **A voz não pode enganar o detector.** O microfone já está ligado e a voz do próprio celular entra nele. As consoantes ("S", "T", "B") têm subida rápida e podem parecer um tiro, e a voz tem energia perto de 2700 Hz. Soluções: (1) o detector **ignora tudo até o fim da voz** (o app sabe o instante exato em que ela termina), e (2) um teste que roda o detector sobre o arquivo da voz e exige **0 apitos e 0 disparos**.
- **A voz não entra na contagem do tempo.** O instante zero continua sendo o apito detectado no microfone; a voz só vem antes.
- O atraso sorteado passa a contar **depois** da voz (a espera de 1 a 4 s fica como a regra pede, entre o comando e o sinal).
- Com fone ou caixa Bluetooth a voz sai neles também, e o aviso de início estimado continua valendo.

**Estado (2026-11-22): a versão mínima está feita** (sem a voz). Ao apertar Standby, ou ao dar as batidas, a tela mostra **"STAND BY" grande e parado** (nada pisca; igual nos três idiomas) durante a espera, e o celular **vibra uma vez, longa (250 ms)**. Em Ajustes do Timer, "Aviso de que o Standby começou": **vibrar** (vem ligado) e **bipe curto** (vem **desligado**, em 1000 Hz e 0,15 s, tom e volume diferentes do apito, com aviso de que pode ser confundido com o sinal de partida: só em treino, nunca perto de outra baia ativa). O atraso sorteado de 1 a 4 s **conta depois do aviso** (`Dependencias.avisar` devolve a duração). Se o aviso falhar, a tentativa segue sem ele. Testes: o detector não toma o bipe pelo apito; o timer agenda o apito em aviso + atraso; cancelar durante o aviso não agenda nada. **Falta:** o arquivo de voz (caminho A ou B), com a margem de ~300 ms depois dele e o teste de 0 apitos e 0 disparos; a opção de voz em Ajustes; e ouvir no aparelho se a vibração de 250 ms é percebida com o celular no bolso ou no cinto.

**Voz sintetizada: amostras prontas (2026-11-22).** `tools/gerar-voz-standby.py` gera a voz com o **espeak-ng** (sintetizador de formantes, robótico por natureza) e a processa com o **ffmpeg** (taxa baixa, 8 bits, realce nos médios, saturação, compressor e limitador): 3 variantes, **A sargento** (grave, 8 kHz, 8 bits), **B robô** (mais agudo, 6 bits, mais sujo) e **C rádio** (faixa estreita, rouco). Cada uma tem de 3 a 5 KB em Opus (1,1 a 1,3 s) e fica a 0 dBFS de pico e uns −11 dBFS de RMS. Medido com o detector (sobre a voz, com silêncio em volta): **0 apitos** e a fração de tom em 2700 Hz no máximo 0,08 (o limite do detector é 0,3); ele vê **3 "disparos"** por causa das consoantes ("St", "b"), que o timer descarta por virem antes do instante zero. Falta **ouvir e escolher** (as amostras são geradas por `tools/gerar-voz-standby.py`) e ligar no app.

**Rodada 2 (feedback do responsável: "senti falta do SSS do começo no B; reverb e eco vão melhorar").** B passou a 16 kHz com mais agudos (realce em 3,5 kHz e em 5,5 kHz): a energia acima de 3 kHz nos primeiros 200 ms subiu de −24 para −15 dB. Todas as variantes ganharam **eco** (repetições a 150 e 300 ms, 40% e 20%) e **reverberação** (convolução com uma resposta ao impulso sintética de 0,7 s), ambos por baixo da voz seca; o resultado dura de 1,4 a 1,6 s (a cauda conta como parte do aviso). `--sem-efeitos` volta à voz seca. Medido de novo: 0 apitos, fração de tom no máximo 0,08. Arquivos `voz-standby-*-v2-eco-reverb.ogg`.

**Perguntas em aberto.** ~~Gravar a voz ou sintetizar?~~ Sintetizar (decisão de 2026-11-22). Qual variante? O responsável quer escolher a frase (só "STAND BY" ou a sequência)? A tela deve piscar ou só mostrar o texto grande (acessibilidade: nada de piscar rápido)?

### Fontes (para esta e para a I-04)

O responsável quer fontes no estilo do Metal Slug no app e nos tempos sobre vídeo. As letras do jogo são arte própria da SNK (não dá para usar). Fontes **livres** próximas do clima de fliperama ou militar, todas da Google Fonts e, até onde sei, sob a **SIL Open Font License** (**confirmar a licença de cada uma antes de embutir**, e embutir o arquivo no app, sem carregar da internet):
- **Press Start 2P**: pixel de fliperama clássico, ótima para números.
- **Silkscreen** e **VT323**: pixel mais fino, boa para tempos e tabelas.
- **Black Ops One**: estêncil militar, boa para títulos ("STAND BY").
- **Bungee** e **Russo One**: pesadas e de impacto, para o resultado grande.

**Cortar para no máximo duas** (revisão): uma pixel para os números (Press Start 2P ou VT323) e uma de título (Black Ops One), cada uma com o `OFL.txt` na tela de licenças e os acentos de pt e es conferidos (ç, ã, ñ). Para números que mudam (o tempo de cada disparo) vale uma fonte com **dígitos de largura fixa**, para o texto não dançar: confirmado só para as monoespaçadas e pixel; Black Ops One, Bungee e Russo One não foram conferidas. Também testar a leitura com a fonte do sistema a 200% e em alto contraste (regra do projeto).

## I-04 — Tempos desenhados sobre o vídeo (só registrado)

O responsável pretende, mais adiante, **criar os tempos em cima de um vídeo** da tentativa (cada disparo marcado no instante certo, o total e os splits aparecendo na tela). Usaria as fontes da seção acima. Ainda é só uma intenção: antes de rascunhar precisa decidir se o vídeo é gravado pelo app ou importado, e se o resultado é exportado como vídeo ou só visto na tela. Entra aqui para não se perder.

## Sobre ficar mais alto com "outra frequência harmônica" do 2700 Hz

**Já está feito, na prática.** Uma onda quadrada é a fundamental mais as harmônicas ímpares (3×, 5×, 7×...). Ao saturar a senoide (APK 005) o apito virou quase quadrado, e é isso que o deixou mais forte: acrescentou 8100 Hz, 13500 Hz e assim por diante. Medido: pico em 0 dBFS e RMS em −0,8 dBFS, ou seja, a menos de 1 dB do teto digital.

**Acrescentar mais uma harmônica não soma volume.** O pico não pode passar de 0 dBFS; um terceiro componente só entra tirando energia dos outros (ou estoura). Os ganhos possíveis estão fora do arquivo de áudio:
1. **A frequência certa para o alto-falante.** O ouvido é mais sensível entre 2 e 5 kHz, mas o alto-falante de celular costuma ter um pico de resposta numa faixa só. Um tom de 2000 a 3500 Hz no pico dele pode soar mais alto (**hipótese, de 3 a 6 dB, a medir**). Por isso a ideia de uma **varredura em Ajustes** ("Testar apito": toca de 1500 a 4000 Hz e a pessoa escolhe a mais forte), com o detector procurando a frequência escolhida.
2. **Uma componente em 1350 Hz (metade)** pode ajudar, porque o alto-falante do celular costuma entregar melhor as médias que as agudas, mas o apito mudaria de timbre, e o detector continuaria achando a fundamental de 2700 Hz. Só vale testar de ouvido no aparelho.
3. **Caixa externa** (Bluetooth): é a única mudança grande de verdade (**hipótese**, mais de 10 dB, a medir); o apito detectado no microfone já compensa o atraso dela.
4. Um tom que **alterna** entre duas frequências (sirene) chama mais a atenção sem ser mais alto, mas foge do timer padrão.

(Na pergunta, "2700 Mhz" é 2700 Hz.)


## Revisão das ideias (Opus 5.5, 2026-11-22)

Revisão feita por um subagente, sem editar nada; o que dá para conferir no código foi conferido aqui. **[C]** confirmado, **[NC]** não confirmado.

### Mudam a decisão

1. **O detector aceita qualquer tom como apito durante a espera. [C, conferido em `src/lib/timer.ts:180-181`]** Um tom parecido com 2700 Hz (a voz da I-03, o timer de uma baia vizinha) vira o instante zero errado e todos os tempos saem falsos. **Correção, antes da I-03:** só aceitar o apito numa janela em volta do instante agendado (de uns 50 ms antes até `ESPERA_DO_APITO_MS` depois). Com a voz, somar uns 300 ms depois do fim do arquivo (reverberação). Resolve a voz e o vizinho de uma vez.
2. **Cortar o "Load and make ready" da I-03. [C o texto da regra; o risco é avaliação do revisor]** O comando manda carregar a arma; no treino em seco a regra básica é não ter munição por perto, e no tiro real o comando é do RO sob supervisão (IPSC 8.3.1). No máximo "Are you ready?" e "Standby".
3. **Risco no estande: o apito ou a voz do celular podem soar como comando de outra baia. [NC, é risco operacional]** Falta: aviso "só para treino, não usar em prova nem com outra baia ativa"; voz desligada por padrão com gente perto (ou só um bipe curto); **uma batida ou o botão durante a espera cancela a tentativa**; e atenção ao falso positivo das batidas (um apito inesperado enquanto a pessoa ainda prepara a arma é o pior caso).
4. **Batidas: o `devicemotion` da WebView entrega até ~60 Hz (amostras a cada ~17 ms). [C em parte; o valor atual exato NC]** Uma batida de dedo dura poucos ms e o pico pode cair entre duas amostras, então o limiar de 7 m/s² pode ficar errático (celular no bolso, no cinto, na mesa). Mexer na arma, no coldre ou no carregador também passa de 7 m/s² com o celular no corpo. **Antes de calibrar, medir a taxa real** (`e.interval` ou a diferença de `timeStamp`) no aparelho.
5. **A própria IPSC usa toques como comando. [C, regra 8.3.9.1]** Para atirador com deficiência auditiva: 3 toques no ombro = "Are you ready?", 2 = "Standby", 1 = sinal de partida. Então **2 batidas = Standby** combina com a regra. Sugere também um **modo de vibração 3/2/1 para surdos** (o início fica estimado, porque o t0 é o instante agendado).

### Contradições a resolver

- O texto de I-01 dizia 150 a 600 ms entre batidas e o código usa 90 a 600 ms (texto corrigido acima).
- Os "Cuidados" da I-01 falam de microfone aberto e limite de 10 min; a implementação usa o acelerômetro e **não tem limite de tempo**: o `wakeLock` mantém a tela acesa indefinidamente enquanto o timer está parado e as batidas ligadas (bateria; no bolso, um toque sem querer). **Decidir o limite.**
- Duas vibrações parecidas (início da I-03 e "entendi" da I-01): definir padrões distintos.
- A **varredura de frequência** muda o detector e pode atrapalhar a convivência com outros timers do estande: é decisão aberta, não detalhe.
- "Voz normal" em Ajustes pede outro arquivo de áudio: decidir quantos arquivos.
- Perguntas que faltam: a voz toca com fone (o t0 fica estimado)? O que acontece se a batida vier durante a voz? A UI deve deixar claro que o atraso de 1 a 4 s conta depois da voz.

### Correções menores

- **I-02:** "`.webm` vira `video/webm`" e "`.weba` vira `application/octet-stream`" são [NC]; vale reescrever como "observado no aparelho". O limite de 16 MB é da API Cloud do WhatsApp, não da folha de compartilhar (pode sair). "Telegram vira nota de voz" é [NC] até o teste. Se a conversão falhar, enviar o `.webm` original vai ser recusado pelo WhatsApp: **melhor avisar a pessoa** do que enviar algo que falha.
- **Fontes:** as seis estão em `ofl/` no repositório google/fonts [C]; basta incluir o `OFL.txt` de cada uma na tela de licenças. Dígitos de largura fixa: confirmado só para as monoespaçadas e pixel; para Black Ops One, Bungee e Russo One [NC] (ver a tabela OpenType). Conferir acentos de pt e es (ç, ã, ñ). **Cortar para no máximo duas** (uma pixel para os números, uma de título).
- **Harmônicas:** o `tanh` tem aliasing possível (a 48 kHz a 17ª harmônica dobra para 2100 Hz e a 19ª para 3300 Hz, perto da banda do detector); a amplitude é baixa e o `oversample` atenua, mas é conta do revisor: **medir no espectro**. O abafador passivo atenua mais os agudos, então as harmônicas de 8 a 13 kHz quase não chegam a quem o usa: favorece testar uma fundamental mais baixa. Os ganhos "3 a 6 dB" e "mais de 10 dB" estão sem fonte: **hipóteses a medir**.
- **I-04:** caminho mais simples, **importar o vídeo e rodar o mesmo `detector.ts` na trilha de áudio dele** (apito e tiros saem do próprio vídeo, sem sincronizar nada). Começar exportando uma legenda `.srt` ou `.ass` com os splits. Gravar vídeo no app ou exportá-lo já com os tempos desenhados é bem mais caro.

### Ordem sugerida

1. Testar no aparelho o que já está feito (Ogg mono, taxa real do `devicemotion`, limiar das batidas nas 4 posições). Pequeno.
2. **Janela do apito em volta do instante agendado** (com teste). Pequeno; vale sozinha contra o timer do vizinho e é pré-requisito da I-03.
3. Limite de tempo para "aguardando batidas" e cancelar por batida ou botão durante a espera. Pequeno.
4. **I-03 mínima:** "STAND BY" grande na tela, vibração e bipe curto opcional; depois o arquivo de voz, com o teste de 0 apitos e 0 disparos e o aviso de uso só em treino. Médio.
5. Uma fonte pixel para os números. Pequeno.
6. Varredura "Testar apito", só se o apito se mostrar fraco no estande. Médio.
7. Modo de vibração 3/2/1 para surdos. Pequeno a médio, opcional.
8. Fala: em espera. Grande.
9. I-04: só registrada.

**Cortar:** "Load and make ready", a componente de 1350 Hz (muda o timbre sem ganho provado), a sirene e a lista de seis fontes.


### O que da revisão já foi aplicado (2026-11-22)

- **Janela do apito (achado 1): feito.** O timer só aceita como apito o tom que começa de 50 ms antes do instante agendado até 1,5 s depois da chegada esperada ao microfone. Fora disso o tom é descartado e o detector **volta a procurar** o apito de verdade (`reabrirApito`, sem repetir o mesmo tom que ainda toca). Testes no `timer.test.ts` e no `detector.test.ts`. Isto também protege hoje contra o timer de uma baia vizinha.
- **Cancelar por batida (achado 3): feito.** Com as batidas ligadas, **uma batida** (depois de 0,8 s de graça, para o motor de vibração e o toque do início não cancelarem) ou o botão cancela durante a espera antes do apito. Vibração de início (1 × 80 ms) diferente da de cancelar (2 × 40 ms).
- **Limite de 10 min nas batidas e a tela acesa (contradição 2): feito.**
- **Aviso quando o áudio vai como `.webm`: feito.** Se a conversão para Ogg falha, o envio segue com o original e o app **avisa** que apps como o WhatsApp podem recusá-lo.
- **Textos corrigidos:** intervalo das batidas, "Load and make ready" cortado, regra de 1 a 4 s como recomendação, as afirmações não confirmadas sobre MIME, o limite de 16 MB (tirado), os ganhos em dB (agora hipóteses), as fontes (duas no máximo).
- **Ainda não feito (fica para quando a I-03 começar):** o aviso "só para treino" e a voz desligada por padrão com gente perto; a margem de ~300 ms depois do fim do arquivo de voz; o modo de vibração 3/2/1 para surdos (IPSC 8.3.9.1); a medição do espectro do apito (aliasing do `tanh`) e a medição da taxa real do `devicemotion` no aparelho.

### Pesquisa de vozes "stand by" prontas (2026-11-22)

Busca na web por falas "stand by" livres, para comparar com a voz sintetizada. **Resultado: não achei nenhuma fala "stand by" livre pronta e confirmada.** O que apareceu:

| Fonte | Licença | Tem "stand by"? | Observação |
|---|---|---|---|
| Lentikula, *Sci-Fi Voice Lines* (itch.io) | **CC0** (lido na página) | não consta: a página não lista as falas | 50 falas robóticas (25 femininas, 25 masculinas), WAV 48 kHz 24 bits, 19 MB, preço livre (pode ser 0); só baixando para ver |
| OpenGameArt, *robot voice pack*, *Voiceover Pack* (Kenney), nó 78368 (anunciador de luta) | CC0 segundo a busca | **não confirmado** | as páginas deram **403** ao meu leitor: abrir no navegador |
| VoiceBosch, *DROID Announcer* | **CC-BY-SA 4.0** | não confirmado | exige atribuição **e** compartilhar igual: complica o uso em app MIT |
| MediaMusicNow, *Uppbeat* ("Standby military radio voice") | pago ou licença própria (Uppbeat não verificada: 429) | sim, mas voz de rádio militar, não de fliperama | crédito ou assinatura para baixar |
| Freesound | varia por arquivo (CC0, CC-BY, CC-BY-NC) | busca não achou; pede login | BY-NC **não serve** (uso comercial); BY exige crédito |
| Metal Slug (a voz que o responsável citou) | **SNK, protegida** | "Mission Start!" etc. | o dublador não é confirmado (fontes divergem); **não usar** |

Conclusões: (1) CC0 serve sem condição; CC-BY serve com crédito na tela de licenças; BY-SA e BY-NC não. (2) Nenhuma voz pronta é "STAND BY" de fliperama; a **voz sintetizada** do `tools/gerar-voz-standby.py` é original, sem licença de terceiros e já soa certa para o estilo. (3) Se quiser uma segunda opinião de timbre, o pacote CC0 da Lentikula pode ser baixado para ouvir e para ver se tem falas aproveitáveis ("ready", "standby").


### Vozes neurais do responsável (2026-11-22)

O responsável trouxe 4 gravações de tela (WAV 192 kHz, 24 bits, estéreo, ~3 s) de **duas vozes neurais, "Spruce" e "Ember"**: uma diz **"Standing By"** e a outra **"Reload and Standing By"** (pelas durações há 2 curtas, ~0,6 s, e 2 longas, ~1,3 a 1,5 s; a associação voz × arquivo foi **inferida pela hora das gravações** e precisa de confirmação).

- **Corte:** `tools/recortar-voz.py` converte para mono 48 kHz, acha a fala pelo envelope (piso de ruído + 10 dB, nunca abaixo de 40 dB sob o pico), corta 8 ms antes do ataque e deixa 80 ms de cauda com fade de cosseno, e leva o pico a −1 dBFS (as vozes ficam no mesmo nível). A primeira tentativa errou: uma gravação tinha um **estalo de 28 ms meio segundo antes da voz** e o corte começou nele; agora a fala é o **trecho de maior energia** (pausas de até 150 ms dentro da frase ficam juntas).
- **Eco e reverb** (`--efeitos leve|marcante`, **dois ajustes**: *leve* = eco 150/300 ms a 40%/20% e sala de 0,7 s; *marcante* = baia coberta de estande: três repetições a 210/420/630 ms (50%, 30%, 15%), sala de 1,1 s e mistura de 0,6, com 1,2 s nas curtas e 1,9 a 2,0 s nas longas; os arquivos da pasta `neurais/` terminam em `-seca`, `-leve` e `-marcante`; a primeira rodada usou o ajuste leve, ainda sob o nome `-eco-reverb`; módulo `tools/efeitos_voz.py`, o mesmo das vozes sintetizadas): aplicados **depois** do corte, com a cauda aparada no fim (o arquivo termina quando o som termina). Para voz neural limpa escolhi o mesmo ajuste suave de antes: eco a 150 e 300 ms (40% e 20%) e reverb de sala média por baixo da voz seca. Duração: 0,9 s (curtas) e 1,6 a 1,8 s (longas).
- **Detector:** sobre as 8 versões (secas e com efeito), com silêncio em volta: **0 apitos**, fração de tom em 2700 Hz no máximo **0,06** (limite 0,3). Aparecem de 0 a 3 "disparos" (consoantes), que o timer descarta por virem antes do instante zero.
- **A conferir antes de embutir no app:** (1) **a licença de uso do serviço** que gerou "Spruce" e "Ember": se permite redistribuir o áudio gerado dentro de um app de código aberto (MIT), inclusive em loja; guardar o termo ou o link em `docs/licencas-de-terceiros.md`. (2) **"Reload"**: é uma ordem de recarregar a arma. Pela revisão, nada que mande carregar deve tocar por padrão (treino em seco, outra baia); se entrar, que seja **opção desligada**, com o aviso de só usar sob supervisão de RO/instrutor.


### Voz ligada no app (2026-11-22)

Escolha do responsável: voz **Spruce** (assumida como `voz1`), **versão seca** (sem eco nem reverb), frase **"Standing by"** (a de 0,7 s; "Reload and Standing By" **não entrou**, pelo risco da ordem de recarregar). O arquivo está em `src/lib/audio/voz-standby.ogg` (3 KB) e toca no início do Standby; **Ajustes do Timer → "Voz dizendo Standing by"** liga e desliga (**vem ligada**; tem precedência sobre o bipe). O aviso dura a voz + **300 ms de folga**, e só depois o atraso sorteado de 1 a 4 s começa a contar; cancelar cala a voz. Se o arquivo não carregar, o Standby segue sem voz. No Chrome de verdade a voz decodifica (995 ms com a folga). **Falta:** a licença do serviço da voz (`docs/licencas-de-terceiros.md`), ouvir no aparelho (volume com abafador) e decidir se "Reload and Standing By" entra como opção.


## Revisão das ideias (Opus 5, 2026-11-23)

Cada ideia da tabela do topo conferida no **código** (não só nas docs). Estado: **atendida**, **parcial** ou **do zero**. Tamanho: **P** (até um dia), **M** (alguns dias), **G** (semana ou mais, ou nativo novo). **[NC]** = não confirmado (precisa do aparelho ou de pesquisa mais funda). A tabela do topo foi corrigida onde estava errada.

| Ideia | Estado | Evidência (arquivo:linha) | Tamanho e dependências | Recomendação |
|---|---|---|---|---|
| I-01 batidas pelo acelerômetro | **atendida** | `src/lib/batidas.ts:8` (limite 10 min), `:12-23` (limiar 7, intervalo **120 a 1000 ms**, silêncio 600 ms); `src/lib/ouvirBatidas.ts:45`; `src/lib/Timer.svelte:78-106` (iniciar e cancelar) | — (falta só o aparelho) | Fazer só o teste de campo; antes, registrar a taxa real do sensor (linha abaixo). |
| I-01 medir a taxa real do `devicemotion` | **do zero** | `ouvirBatidas.ts:31-38` não lê `e.interval` nem a diferença de `timeStamp`; o diagnóstico de `Timer.svelte:107-110` é só da escuta | P; nenhuma | **Fazer antes do teste de campo**: sem isso a calibração do limiar fica no escuro. |
| I-01 vibração "entendi" distinta | **atendida no código** | `Timer.svelte:88` (80 ms), `:101` (40-60-40), `timerDoApp.ts:23` (250 ms) | P se precisar mexer; aparelho | Sentir no aparelho: a de 80 ms vem logo antes da de 250 ms (o aviso sai depois de abrir o microfone, `timer.ts:120`) e uma `vibrate()` nova corta a anterior [NC]; se emendar, tirar a de 80 ms ou trocar por padrão. |
| I-01 batidas pelo microfone | **parcial** (o detector de início de som existe) | `src/lib/detector.ts` (mesma `analisar` do worklet), `revisao.ts:70` | M; microfone aberto na espera (bateria, indicador do Android) e o risco de tiro vizinho que a própria ideia aponta | **Adiar**; só se o acelerômetro falhar no estande. |
| I-01 batidas com a tela bloqueada | **do zero** | nenhum `SensorManager` em `src-tauri/gen/android/.../*.kt`; o `ServicoAudio.kt` é só microfone | G; serviço nativo em primeiro plano lendo o acelerômetro (Android limita sensores em segundo plano), notificação permanente, bateria [NC] | **Adiar** até a decisão do responsável depois do campo. |
| I-01 fala ("standby") | **do zero** | nada de `SpeechRecognition`/Vosk em `src` nem nos `.kt` | G; módulo Kotlin + modelo offline. Bibliotecas prontas: **Vosk** (Apache-2.0, modelo ~40 MB), **sherpa-onnx** keyword spotting (Apache-2.0, com exemplo Android e modelos menores [NC]); **Porcupine** pede chave online (não serve sem `INTERNET`) | **Cortar** por ora (as batidas resolvem o problema); se voltar, avaliar sherpa-onnx antes de Vosk. |
| I-02 áudio Ogg/Opus | **atendida** | `src/lib/compartilhar/arquivo.ts:25-34`, `compartilhar.ts:57`, `res/xml/file_paths.xml` (só `cache-path`) | — | Só o teste nos apps (pendências §1). Mono não é forçado no remux (`escutaNavegador.ts:25` só pede `channelCount: 1`): conferir no aparelho, como já está anotado. |
| I-03 voz e "STAND BY" | **atendida** | `src/lib/audio/voz-standby.ogg`; `apito.ts:145` (`falar`); `preferencias.ts:39` (voz ligada, bipe desligado) | — | Falta só licença e aparelho (pendências §1 e §2). |
| I-03 licença da voz Spruce | **aberta [R]** | `docs/licencas-de-terceiros.md:27-32` | P (ler termos); se não servir, trocar pelo sintetizado de `tools/gerar-voz-standby.py` (já pronto) | **Fazer antes de qualquer publicação**; o plano B já existe, então não bloqueia nada. |
| I-03 volume com abafador | **aberta [R]** | — | aparelho | Teste de campo. |
| I-03 "Reload and Standing By" | **do zero** (arquivo só local) | nada em `src/lib/audio/` | P (arquivo + chave + aviso); decisão [R] | **Cortar**: manda recarregar a arma; a própria revisão de 2026-11-22 desaconselha. |
| I-03 "voz normal" como opção | **do zero** | só um arquivo de voz | P; outro arquivo e um seletor no lugar das duas chaves | **Adiar**; o bipe já cobre "sem voz robótica". |
| I-03 "bipe" como opção | **atendida** | `apito.ts:119`, `TimerAjustes.svelte` (chave `standbyBipe`), `timerDoApp.ts:25` | — | Tirar da lista de abertas (feito na tabela). |
| I-03 aviso "só para treino" | **atendida** | `i18n/pt.ts:198` (`timer.aviso_ajuda`), `:270` e `AvisoVoz.svelte` (aviso único da baia vizinha) | — | Tirar das pendências; resta só a decisão "voz ligada por padrão". |
| I-03 vibração 3/2/1 para surdos (IPSC 8.3.9.1) | **do zero** | só há vibração única (`timerDoApp.ts:23`) | P; o t0 vira o instante agendado, como no modo fone (`esperarApito: false`, `timerPartida.ts:16`) | **Fazer** se houver atirador surdo no clube; barato e combina com a regra. |
| I-04 tempos sobre o vídeo gravado | **atendida** (V1 a V3) | `src/lib/video/overlay*.ts`, `exportacao.ts`, `motorWebCodecs.ts:146` | — | — |
| I-04 importar vídeo de fora e rodar o detector | **parcial** (as peças existem) | `revisaoAudio.ts:5` (`decodeAudioData` aceita a trilha de áudio do vídeo [NC para MP4/AAC do WebView]), `revisao.ts:70` (`reprocessar` sem janela), `video/alinhamento.ts` (`inicioDoVideoMs` = 0 num arquivo só), `video/sincronia.ts` (feito para servir ao importado) | M; seletor de arquivo, limite de tamanho (`lerArquivo.ts`), gravar em `videos`/`videos_pedacos`, montar a tentativa; zero manual quando o apito não for achado | **Fazer depois do campo**: é o que o responsável pediu na I-04 e reaproveita quase tudo. |
| I-04 exportar `.srt`/`.ass` | **do zero** | nenhum `.srt`/`vtt` em `src` | P; os dados já saem de `video/dadosDoOverlay.ts`; reaproveitar o envio de arquivo do `compartilhar.ts` | **Adiar**: com o MP4 "Com os tempos" pronto, a legenda rende pouco; só se alguém editar o vídeo fora. |
| V4 quadro a quadro e comparação | **parcial** (só a base) | `video/capacidades.ts:31` e `video/sincronia.ts:54` (`requestVideoFrameCallback`); `VideoDaTentativa.svelte:83-87` pula ao disparo, mas não anda quadro a quadro; nenhum `VideoDecoder` para leitura | G; para quadro exato, demux + `VideoDecoder`: o **Mediabunny** faz isso pronto (mesma troca do `mp4-muxer`); um passo simples (±1/fps no `currentTime`) é P mas impreciso | **Adiar**; se vier, começar pelos botões ±1 quadro (P) e só depois o Mediabunny. |
| Resto: 4K | **do zero** | `preferencias.ts:154-155` só 1080 e 60 | P no código; depende do relatório do spike S1 | **Adiar** até o S1; provável **cortar** (tamanho, calor, export lento). |
| Resto: posição ajustável do overlay | **do zero** | `PrefsOverlay` (`preferencias.ts:197`) só liga e desliga partes; cantos fixos em `video/overlayLayout.ts`/`overlayLayoutPe.ts` | M; layout de retrato e paisagem com colisões, tela de Ajustes, testes de layout | **Adiar**; o arquivo arquivado promete isso (`ideia-gravar-video.md:116`), mas ninguém pediu de novo. |
| Resto: tela cheia nativa perde o overlay | **aberta, confirmada** | `VideoDaTentativa.svelte:98` usa `controls` nativos; o overlay é irmão do `<video>` no `.palco` | P; padrão pronto: `controlsList="nofullscreen"` + botão próprio com `requestFullscreen()` no `.palco` (Fullscreen API), como os players web fazem | **Fazer**: barato e é um defeito visível. |
| Resto: vídeos órfãos | **aberta, confirmada** | `gravadorDeVideo.ts:136-145` apaga o pendente só se o app seguir vivo; não há varredura na abertura | P; ao abrir, apagar de `videos`/`videos_pedacos` os ids sem tentativa | **Fazer**: vídeo órfão ocupa espaço sem aparecer em lugar nenhum. |
| Resto: retenção apaga o recém-salvo | **aberta, confirmada** | `video/politica.ts:17-28` não protege o mais novo; `gravadorDeVideo.ts:152-157` limpa logo depois de salvar (vídeo maior que o limite some na hora) | P; proteger o id recém-confirmado (ou avisar) e um teste | **Fazer**. |
| Resto: `mp4-muxer` → Mediabunny | **do zero** | `package.json` `mp4-muxer` 5.2.2; o README do pacote o declara obsoleto | M (troca do muxer em `motorWebCodecs.ts`, licença MPL-2.0 [R]) | **Adiar** e juntar com a V4 (o ganho real do Mediabunny é o demux/decode da V4). |
| Resto: avatar viajar (P0b) | **do zero**, bloqueada | `tauri.conf.json:24` `"csp": null`; nenhum `avatar` em `src/lib/documento*`; CONS-014 só parcial (`status.md` da auditoria, arquivo local) | M; CSP ativa (CONS-015, aparelho), validador de cabeçalho, campo no formato, opt-in | **Adiar** até CSP e Etapas 10/11. |
| Varredura "Testar apito" | **parcial** (a infraestrutura aceita outra frequência) | `apito.ts:86` (`agendar(..., frequencia)`), `detector.ts:25` (`frequenciaApito`); sem preferência nem tela | M; preferência, tela de teste, detector e reprocesso com a frequência guardada | **Adiar** até o campo mostrar apito fraco. A **medição do aliasing do `tanh`** é P e dá para fazer já no Chrome (`OfflineAudioContext` + FFT), sem aparelho. |
| Apito com mais de uma baia ativa | **parcial** | `timerFase.ts:27` (janela de 50 ms antes até 1,5 s depois), `timer.ts:39` (`reabrirApito`) | — | **Mover para a validação de campo** (pendências §1); não é ideia nova. |
| Histórico: editar itens da tentativa | **parcial** | pontuação: `ListaTentativas.svelte:67,129`, `escritaDeTentativas.ts:41` (`definirPontos`); trocar percurso, data ou disparos: nada | M; índice por percurso, ranking, sessões, e o id estável que deduplica a importação (uma tentativa mudada e reenviada sobrescreve a do outro lado) | **Fazer só "trocar percurso"** (o erro comum: salvar no percurso errado); disparos continuam na Revisão. |
| Nota S/A/B/C/D | **do zero** | nada em `src`; o HF existe (`tentativa.ts:48`) | P; precisa de referência: melhor HF próprio no percurso ou um HF de referência digitado. Padrão pronto: as faixas de porcentagem da classificação USPSA (GM ≥ 95%, M ≥ 85, A ≥ 75, B ≥ 60, C ≥ 40, D abaixo) [NC para os números exatos] | **Adiar**; se entrar, como "% do seu melhor" com o nome de fliperama, para não parecer classificação oficial. |
| Detalhe: trilha preenchida do slider | **do zero** | `routes/+layout.svelte:75-79`: trilha de cor única | P; WebKit não tem `::-webkit-slider-progress`: o padrão é um `linear-gradient` com uma variável `--pct` atualizada por uma ação Svelte (no Firefox, `::-moz-range-progress`) | **Fazer** (3 sliders). |
| Detalhe: Salvar fixo embaixo | **do zero** | o Salvar está no fluxo da Revisão (`RevisaoAcoes.svelte:119`); a `BarraFixa.svelte:23` só tem Standby/Parar/Nova tentativa | P a M; conflito de espaço com a barra fixa e o teclado aberto (pendências §8) | **Fazer junto** com o teste da barra fixa no aparelho; talvez o Salvar vire a ação principal da própria barra enquanto há o que salvar. |
| Detalhe: acordeão exclusivo no resultado | **parcial** | `Cartao.svelte:7,15` já aceita `name` (acordeão nativo de `<details name>`); `Revisao.svelte:156,173,182` não passam `name` | P | **Fazer** (uma linha por cartão); conferir que a pontuação que abre sozinha não fecha os disparos sem querer. |
| Detalhe: ícone monocromático do Android | **regrediu** | `res/mipmap-anydpi-v26/ic_launcher.xml` sem `<monochrome>` e sem `ic_launcher_monochrome.png` nas pastas `mipmap-*`; o `tools/gerar-icone-do-app-png.py:84-89` gera e repõe, mas o `tauri icon` regravou | P; rodar o gerador de novo | **Fazer**, e corrigir o "feito" do `archive/roadmap-implementadas.md`. |
| Detalhe: SVG da fase 4 | **aberta [R]** | só `design/icone/icone.svg` antigo (README avisa) | P depois que o responsável mandar o SVG | **Fundir** com "Trocar para os ícones SVG do responsável" (pendências §2): é o mesmo item. |
| Detalhe: ícone da fase 3 em quadrado | **aberta, confirmada** | `src/lib/assets/marca-nicska.webp` tem 154 × 192 | P; acolchoar para quadrado (o overlay desenha sem esticar desde o APK 045) | **Fazer** se o quadrado for para outro uso; para o overlay atual não é preciso. |

### Duplicadas e contradições entre as docs

- **Duplicada:** "SVG da fase 4" (aqui) = "Trocar para os ícones SVG do responsável" (`roadmap-pendencias.md` §2). Deixar só nas pendências.
- **Duplicada:** "trocar `mp4-muxer` por Mediabunny" e o decode da V4 são a mesma biblioteca e a mesma decisão de licença.
- **Duplicada:** "Apito com mais de uma baia" é o achado 3 da revisão de 2026-11-22, já tratado pela janela do apito; o que sobra é teste de campo.
- **Contradição:** I-01 (texto da seção, "Batidas" e "Estado") diz **90 a 600 ms** entre batidas e **350 ms** de silêncio; o código usa **120 a 1000 ms** e **600 ms** (`batidas.ts:19-23`). A pendência §1 está certa ("até 1 s, confirmação de 600 ms"). A revisão de 2026-11-22 diz que corrigiu o texto, mas o ritmo mudou de novo no APK 019.
- **Contradição:** `archive/roadmap-implementadas.md` dá o ícone monocromático como feito; o código atual não o tem (ver a tabela).
- **Contradição:** `archive/roadmap-implementadas.md` ("Ação principal fixa") e `roadmap-pendencias.md` §1 falam em "Salvar largo, Descartar 34%, Compartilhar 66%"; hoje o Descartar é a lixeira no fim da pílula de enviar (`RevisaoAcoes.svelte:120-128`) e o Salvar não está na barra fixa.
- **Contradição:** `archive/ideia-gravar-video.md` (decisão 5 e overlay item 6) ainda fala em "treino, não oficial" na marca; o APK 044 tirou esse texto.

### Itens que o código já resolveu, mas as docs ainda listam como abertos

- `roadmap-pendencias.md` §2, "aviso só para treino": existe (`pt.ts:198`, `:270`). Resta só "voz ligada por padrão ou não".
- `roadmap-pendencias.md` §3, CONS-040 ("`icones.json` ainda traz 14 ícones sem uso"): o `icones.json` tem só os 11 ícones usados; já está como feito no `roadmap-implementadas.md`.
- Tabela do topo, I-03: "bipe como opção" já existe (corrigido acima).
- Tabela do topo, I-01: a vibração "entendi" já é distinta (corrigido acima; falta só sentir no aparelho).
- Seção I-02 ("O Nicska ... ainda envia o áudio como `.webm`") e seção I-04 ("só registrado"): os parágrafos de abertura estão velhos; o "Estado" e a tabela do topo valem.
- `archive/roadmap-implementadas.md`: "APKs de teste (001 a 022)" está velho (vai até 046).

### Ordem sugerida (só o que não depende do aparelho)

1. Ícone monocromático de volta (P). 2. Vídeos órfãos e retenção sem apagar o recém-salvo (P). 3. Tela cheia própria com overlay (P). 4. Registrar a taxa do `devicemotion` no diagnóstico (P). 5. Acordeão exclusivo e trilha preenchida do slider (P). 6. Medir o aliasing do `tanh` no Chrome (P). Depois do campo: importar vídeo (I-04, M) e trocar percurso no Histórico (M). Cortar: fala, "Reload and Standing By" e 4K (este até o S1 dizer o contrário).
