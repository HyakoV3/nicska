# Roteiro de campo (Fase 2 do plano de ação)

Passo a passo para quem for testar, com o **APK da última release do GitHub** e **2 aparelhos**. Complementa [`teste-de-uso.md`](teste-de-uso.md) (Etapa 7, comparação final com o timer comercial) e fecha os itens da seção 1 de [`roadmap-pendencias.md`](roadmap-pendencias.md). Origem dos achados: `00-consolidado.md` da auditoria de 2026-11-23 (arquivo local) (IDs `CONS-nnn`).

Os nomes de controles abaixo são os do app em português (`src/lib/i18n/pt.ts`). O que não deu para confirmar nos arquivos está marcado **(conferir)**: se a tela do APK 023 disser outra coisa, anote o texto real na coluna "observado".

**Como usar a folha:** em cada tabela, preencha "observado" (texto livre ou número), "aparelho" (A ou B) e "passou/falhou" (P ou F). Se falhou, anote o que viu mesmo assim: um F sem descrição não ajuda. Tire foto da folha ao fim de cada bloco.

## 0. Antes de ir

### Segurança no estande (leia primeiro)

- Siga as regras do clube e do RO. **Nunca mexa no app com a arma carregada ou na mão**: arme o Standby com a arma descarregada e segura, ou peça a outra pessoa para operar o celular.
- Celular em lugar seguro e firme (mesa, suporte, bolso fechado). Não o coloque na linha de tiro nem onde um cartucho ou capsula possa atingi-lo.
- Use abafador. O app só é testado em **treino**: não use o Nicska em prova nem com outra baia ativa (o apito e a voz "Standing by" podem ser tomados como comando por quem está perto).
- Os testes de tela bloqueada podem ser feitos **em casa com sons** (palmas, estalo de caneta, estouro de saco de papel) antes de ir ao estande. Faça primeiro assim; só vá atirar de verdade depois.

### Pré-requisitos

| Item | Anotar |
|---|---|
| APK da última release do GitHub (anote a versão e o commit) | Arquivo/commit: |
| Ajustes mostra "Versão {v}" (confirma o que está instalado) | Versão vista: |
| Aparelho A: marca, modelo, versão do Android, versão da WebView | |
| Aparelho B: marca, modelo, versão do Android, versão da WebView | |
| Economia de bateria: A ___ (normal/agressiva) · B ___ (normal/agressiva) | |
| Bateria carregada acima de 80%; volume de mídia no máximo; "não perturbe" desligado | |
| Instalação **nova** (sem versão anterior) em pelo menos um aparelho; o outro pode ser atualização por cima | A: nova/atualização · B: nova/atualização |
| Timer comercial, caneta, papel, fone com fio, caixa Bluetooth, abafador | |
| Percurso para o teste (por exemplo "Estande 1"): **não crie antes**, o bloco 2 testa a primeira vez | |

Onde fica a economia de bateria agressiva é diferente em cada fabricante (Xiaomi, Samsung, Motorola...). Anote o nome da opção usada **(conferir)**: por exemplo "Sem restrições" × "Otimizada" × "Restrita" para o Nicska em Ajustes do Android > Apps > Nicska > Bateria.

---

## 1. Escuta com a tela bloqueada e em segundo plano (CONS-007: o mais importante)

Pergunta: com o Standby armado e a tela bloqueada (ou o app na Home), o microfone continua ouvindo, os disparos entram e o tempo bate? O código assume que o serviço em primeiro plano basta; **isso nunca foi visto num aparelho**. Faça nos 2 aparelhos, em **economia normal e agressiva** (repita as linhas 1.1 a 1.4 em cada combinação, usando as colunas "aparelho" como A-normal, A-agressiva etc.).

Primeiro uso do microfone: o Android pede a permissão de microfone e, no Android 13+, a de notificações. **Conceda as duas** neste bloco (o caso "negada" é do bloco 2).

Em casa (sons) antes do estande: 3 palmas espaçadas de cerca de 1 s no lugar de tiros. No estande: 3 tiros.

| Passo | O que fazer | Resultado esperado | Resultado observado | Aparelho | P/F |
|---|---|---|---|---|---|
| 1.1 | Aba Timer, toque em **Standby**. Espere o apito. Em seguida **bloqueie a tela** (botão lateral) e faça 3 sons espaçados, 5 s a 10 s depois do apito | A notificação "Nicska" com o botão "Parar" aparece e fica na barra enquanto escuta | | | |
| 1.2 | Espere 60 s com a tela bloqueada (conte no relógio), depois desbloqueie | O app volta em "Escutando os disparos" (ou resultado se o silêncio encerrou); sem erro "O áudio foi interrompido" | | | |
| 1.3 | Toque em **Parar** e olhe o resultado | 3 disparos marcados, nos instantes certos (compare com o relógio e com o timer comercial) | | | |
| 1.4 | Aberto o resultado, conferir **1º disparo e total** contra o timer comercial (comercial dá o sinal e o Nicska ouve, ou o contrário; anote qual) | Diferença no máximo ~10 ms por disparo; se maior, anote quanto | | | |
| 1.5 | Repetir 1.1 a 1.3, mas em vez de bloquear, aperte **Home** e abra outro app (por exemplo o navegador) por 60 s | Mesmo resultado do bloqueio | | | |
| 1.6 | Armar, bloquear e **tocar em "Parar" na notificação** (sem desbloquear) | A escuta termina; ao abrir o app, o resultado aparece com os disparos já feitos **(conferir se os disparos aparecem)** | | | |
| 1.7 | Armar, bloquear e **não atirar** durante o tempo de "Parar após silêncio" | Escuta termina sozinha; ao desbloquear, "Tentativa encerrada. Nenhum disparo..." | | | |
| 1.8 | Armar e **esperar a tela apagar sozinha** (sem apertar o botão), atirar, voltar | Igual ao bloqueio manual | | | |
| 1.9 | Armar sem a notificação visível (negue a permissão de notificações nos Ajustes do Android, **só se for fácil**) e bloquear | O serviço roda, mas a notificação e o botão "Parar" não aparecem; a escuta funciona? **(conferir)** | | | |
| 1.10 | Escuta longa: armar e deixar 3 min com a tela bloqueada (sons a cada 30 s) | Todos os sons marcados; anote bateria antes/depois e se o aparelho esquentou | | | |
| 1.11 | **Sem** serviço: Cronômetro (**Começar**), bloquear a tela 30 s, voltar | Anotar se a gravação seguiu ouvindo ou parou (compara o motor do serviço com o da gravação) | | | |

Se 1.2 ou 1.3 falharem (disparos faltando, tempo errado ou app armado mudo), **pare o roteiro e me avise**: é o resultado que decide o desenho do serviço (`ServicoAudio`, `onPause` da WebView; Fase 5B). Anote em que momento a captura parou (marque a hora e o que apareceu na tela).

---

## 2. Primeiro uso e instalação nova (CONS-001, 013, 028)

Use o aparelho com **instalação nova** (ou limpe os dados em Ajustes do Android > Apps > Nicska > Armazenamento).

| Passo | O que fazer | Resultado esperado | Resultado observado | Aparelho | P/F |
|---|---|---|---|---|---|
| 2.1 | Abra o app pela primeira vez. Sem criar nada, olhe a aba Timer | Estado "Pronto"; o percurso para salvar pode ser criado ou escolhido (**conferir** o que a Onda 1 colocou: percurso padrão ou seletor no Resultado) | | | |
| 2.2 | Negue a permissão do microfone ao tocar em **Standby** | Mensagem "O microfone foi negado. Libere a permissão do microfone para o **Nicska** nos ajustes do aparelho." O texto cita **Nicska**, não "Biblioteca Musical" | | | |
| 2.3 | No Cronômetro, toque em **Começar** com o microfone ainda negado | Mensagem de permissão negada, também citando Nicska (no APK anterior citava "Biblioteca Musical") | | | |
| 2.4 | Siga o texto da ajuda (Ajustes do Android > Apps > Nicska > Permissões) e conceda o microfone. Volte ao app e toque em **Tentar de novo** (ou em Standby) | O caminho descrito existe de fato no seu Android; a escuta passa a funcionar | | | |
| 2.5 | Faça a **primeira tentativa** com 2 ou 3 sons e toque em **Parar** | Resultado aparece com os disparos | | | |
| 2.6 | **Salve a primeira tentativa** sem criar nada antes: deve ser possível escolher ou criar um percurso ("Percurso" / "Novo percurso") e tocar em **Salvar** | Salvar habilitado; aparece "Salva no histórico."; a tentativa entra em Histórico, no percurso | | | |
| 2.7 | Abra o app com a tela já bloqueada ao pedir a permissão (apenas observar) | Anotar se algo estranho acontece **(conferir)** | | | |
| 2.8 | O primeiro Standby mostra algum aviso sobre voz/baia vizinha? (ver bloco 5) | Aviso visível e compreensível, ou voz desligada por padrão | | | |
| 2.9 | Uma pessoa que **nunca usou** abre o app e tenta fazer e salvar uma tentativa sem ajuda. Anote onde hesitou | Conseguiu sem ajuda; anote termos que não entendeu | | | |

---

## 3. Trocar de aba, revisar, salvar e descartar (CONS-002, 008, 009)

| Passo | O que fazer | Resultado esperado | Resultado observado | Aparelho | P/F |
|---|---|---|---|---|---|
| 3.1 | Toque em **Standby** e, antes do apito, vá à aba **Histórico** (ou à engrenagem de **Ajustes**) | Ou o Standby é cancelado, ou o botão Parar/Cancelar continua visível; **o apito não pode tocar sem você poder parar** | | | |
| 3.2 | Standby, apito, comece a escutar e troque para **Histórico** e volte | A escuta segue (e dá para parar) ou foi cancelada de forma clara; anote qual | | | |
| 3.3 | Gere um resultado (2 a 3 sons), **sem salvar**, vá ao Histórico e volte ao Timer | A revisão continua lá, com as edições feitas | | | |
| 3.4 | Edite (apague um disparo em **Apagar**, depois "Apagar mesmo?"), salve, vá ao Histórico, volte, edite de novo e salve | **Um só registro** no Histórico (sem duplicata), marcado "editada" | | | |
| 3.5 | Resultado não salvo: toque em **Descartar** uma vez | Pede confirmação (segundo toque ou desfazer); **não descarta no primeiro toque** | | | |
| 3.6 | Resultado não salvo: toque em **Nova tentativa** uma vez | Idem: pede confirmação antes de perder a tentativa | | | |
| 3.7 | Resultado já salvo: **Fechar** ou **Nova tentativa** | Sai sem pedir confirmação | | | |
| 3.8 | Pelo Voltar do Android, dentro do Histórico e dentro de Ajustes | Anote para onde volta (CONS-030) | | | |

---

## 4. Silêncio e recarga (CONS-010)

O padrão do APK 023 deveria ser **15 s** (decisão D1; **conferir** em Opções do timer: "Parar após silêncio"). Antes era 5 s e encerrava a tentativa numa recarga ou deslocamento.

| Passo | O que fazer | Resultado esperado | Resultado observado | Aparelho | P/F |
|---|---|---|---|---|---|
| 4.1 | Abra **Opções do timer**: anote o valor de "Parar após silêncio" | 15 s (ou o que a decisão D1 fixou) | | | |
| 4.2 | Padrão de 15 s: 2 tiros, pausa de ~10 s (recarga), 2 tiros | Os 4 tiros na mesma tentativa, sem encerrar | | | |
| 4.3 | Padrão de 15 s: 2 tiros, pausa de ~20 s | A tentativa encerra depois do silêncio; anote quanto esperou | | | |
| 4.4 | Troque para **5 s** (mínimo: 2 s; máximo: 30 s) e repita 4.2 | Encerra no meio da recarga (comportamento esperado do valor curto) | | | |
| 4.5 | Troque para **30 s** (teto) e atire só 1 tiro | Encerra ~30 s depois; há indicação do tempo restante? **(conferir)** | | | |
| 4.6 | No estande: um percurso real com deslocamento e recarga | Nada encerra antes da hora; anote o tempo de silêncio usado | | | |

---

## 5. Voz "Standing by", vibração e bipe (CONS-011, 012)

Ajustes de aviso em **Opções do timer > Aviso de que o Standby começou**: "Vibrar (uma vibração longa)", "Voz dizendo "Standing by"" e "Bipe curto, de tom diferente do apito". A voz tem precedência sobre o bipe.

| Passo | O que fazer | Resultado esperado | Resultado observado | Aparelho | P/F |
|---|---|---|---|---|---|
| 5.1 | Primeiro Standby de uma instalação nova | Voz desligada por padrão **ou** aviso visível ao armar (D2; **conferir** qual) | | | |
| 5.2 | Voz ligada, volume de mídia no máximo, no estande com abafador | A voz é ouvida pelo atirador? O apito seguinte ainda é detectado? | | | |
| 5.3 | Voz ligada: o detector marcou a voz como disparo? | Nenhum disparo falso por causa da voz | | | |
| 5.4 | Só **Vibrar**, volume mudo (som do aparelho no zero) | Uma vibração longa (250 ms) no início do Standby. Se **não vibrar**: a permissão `VIBRATE` pode estar faltando (CONS-011) | | | |
| 5.5 | Só **Bipe**, com abafador | Bipe ouvido e diferente do apito | | | |
| 5.6 | Com **fone com fio** ligado: Standby | Aviso "Há um fone ligado: o apito sai nele e o microfone não o ouve. O início da tentativa será estimado."; resultado marcado "início estimado" | | | |
| 5.7 | Com **caixa Bluetooth**: Standby, apito, tiros | Anote 1º disparo e "Latência de saída" no Diagnóstico; início estimado? | | | |
| 5.8 | Mesmo teste com abafador no ouvido: o apito do celular é ouvido? Anote a distância | | | | |

---

## 6. Batidas, 2 ou 3 (CONS-019, 020)

Em **Opções do timer > Iniciar com batidas no celular**: "Desligado", "2 batidas", "3 batidas". A tela fica acesa esperando (wake lock) e o sensor não funciona com a tela bloqueada; isso é esperado hoje (ver roadmap, seção 2). Limite de espera: **10 min**.

| Passo | O que fazer | Resultado esperado | Resultado observado | Aparelho | P/F |
|---|---|---|---|---|---|
| 6.1 | Ligue "2 batidas"; app aberto. Bata seco 2 vezes (até 1 s entre elas) | Standby começa; vibração de início | | | |
| 6.2 | Repita com "3 batidas" | Idem | | | |
| 6.3 | Posições, 5 tentativas cada, anote acertos e falsos inícios: **bolso**, **cinto**, **apoiado na mesa**, **na mão** | Anote x/5 por posição | | | |
| 6.4 | Ritmo: batidas lentas (~1 s) e rápidas | Aceita até ~1 s entre elas; mais lento não conta | | | |
| 6.5 | Durante a espera antes do apito: **1 batida** | Cancela (vibra duas vezes curtas); o apito **não** toca | | | |
| 6.6 | Andar/mexer o celular no bolso sem bater | Nenhum início falso (CONS-020) | | | |
| 6.7 | Deixe esperando 10 min | Aparece "As batidas pararam de esperar (10 min sem uso...)". **A tela apaga depois do limite?** Se continuar acesa, é o CONS-019 | | | |
| 6.8 | Antes dos 10 min, vá à Home e volte | A tela continua acesa e o sensor volta? **(conferir)** | | | |
| 6.9 | Sensor indisponível ou permissão negada | "Este aparelho não está enviando o sensor de movimento. Use o botão." / "Sem permissão para o sensor de movimento." **(conferir se aparecem)** | | | |

---

## 7. Arquivos: enviar áudio e abrir JSON (CONS-014, 032)

| Passo | O que fazer | Resultado esperado | Resultado observado | Aparelho | P/F |
|---|---|---|---|---|---|
| 7.1 | Tentativa salva com áudio: no Histórico, **Enviar áudio** para o **WhatsApp** | Anote como chega: **áudio**, **nota de voz** ou **documento** | | | |
| 7.2 | Idem para **WhatsApp Business** | | | | |
| 7.3 | Idem para **Telegram** | | | | |
| 7.4 | Idem para **Signal** | | | | |
| 7.5 | O destinatário consegue **ouvir** o arquivo (Ogg)? | Toca no app de destino. Se aparecer "O áudio foi enviado como foi gravado (WebM)...", o app destino pode recusar | | | |
| 7.6 | Histórico > **Exportar backup** (ou "Compartilhar este percurso e as minhas tentativas") e envie o `.json` ao outro aparelho | Arquivo sem áudio; o texto avisa que leva seu nome? **(conferir)** | | | |
| 7.7 | No aparelho que recebeu, com o **app FECHADO** (removido dos recentes): toque no `.json` recebido e escolha o Nicska | Partida a frio: o app abre e importa (ou pergunta); anote se o arquivo se perdeu | | | |
| 7.8 | Com o app **ABERTO**: toque no `.json` recebido e escolha o Nicska | Idem, sem duplicar | | | |
| 7.9 | Importe o **mesmo arquivo de novo** | "Importado: ... ({j} já existiam)": nada duplica | | | |
| 7.10 | Backup com o BOM do Windows (se tiver um) e arquivo inválido | Falha com mensagem clara, sem travar (**conferir**) | | | |
| 7.11 | Ranking com a tentativa da outra pessoa (aba Histórico > Ranking, após importar) | Aparece com "{n} com início estimado ou editadas" quando for o caso | | | |

---

## 8. Aparência e barras do sistema (CONS-031, 034)

Ajustes > Aparência > **Modo** (Automático/Claro/Escuro/Alto contraste) e **Estilo** (Normal/Titânio/Telemetria). As "6 paletas" são claro/escuro × os 3 estilos; o **Alto contraste** tem cores próprias.

| Passo | O que fazer | Resultado esperado | Resultado observado | Aparelho | P/F |
|---|---|---|---|---|---|
| 8.1 | Para cada uma das 6 paletas e o Alto contraste: barra de **status** (em cima) | Cor combina com o app; ícones legíveis | | | |
| 8.2 | Idem a barra de **navegação** (embaixo), com **gestos** | Cor do tema, sem faixa branca | | | |
| 8.3 | Idem com **3 botões** (Ajustes do Android > Sistema > Navegação) | Idem | | | |
| 8.4 | Modo "Automático": troque o tema do sistema com o app aberto | O app acompanha na hora | | | |
| 8.5 | Botão principal (acento) e cronômetro ativo no vermelho: se confundem? | Distinguíveis (CONS-034); anote | | | |
| 8.6 | Fonte do sistema em **200%** (Ajustes do Android > Tela > Tamanho da fonte, máximo) | Textos legíveis, nada cortado, botões alcançáveis | | | |
| 8.7 | Celular **deitado** (paisagem), barra fixa (Standby / Parar) | Duas barras fixas não escondem o conteúdo; ainda dá para rolar | | | |
| 8.8 | **Teclado aberto** (campo "Nome do percurso" ou "Seu nome no backup") | A barra fixa não cobre o campo; anote | | | |
| 8.9 | Voltar com gesto e com botão em cada tela | Anote comportamento | | | |
| 8.10 | Sol/luz forte: legibilidade do cronômetro e do "STAND BY" | Legível | | | |

---

## 9. Precisão: Etapa 1 (CONS-006)

Objetivo: **10 a 20 tentativas** gravadas com áudio cru, cada uma com o gabarito do timer comercial. Isso alimenta `tools/analisar-tentativas.py`, [`calibracao.md`](calibracao.md) e as fixtures. Use a aba **Calibrar**: toque em **Gravar** antes do sinal e em **Parar** depois do último tiro. As gravações ficam em "Gravações guardadas" (**Ouvir**, **Enviar**, **Apagar**).

### Protocolo de cada tentativa

1. O timer comercial ao lado, ligado e pronto. Anote **quem dá o sinal** (comercial ou celular; o app Nicska grava o áudio cru junto da tentativa).
2. **Começar** no Cronômetro do Nicska; celular no lugar combinado (anote: bolso, cinto, mesa, distância à arma).
3. Sinal do timer comercial, atire.
4. **Parar** a tentativa. Anote do comercial: **1º disparo**, **cada split** e **total**.
5. Anote na folha o horário exato da tentativa no Histórico, para ligar o arquivo à linha da folha. 
6. Ao fim, **Enviar** cada gravação para o computador e salve como `AAAA-MM-DD_NN_caso_aparelho.ogg` (ou o formato que o app entregar), onde NN é o número da folha e caso é uma das siglas abaixo. Guarde a folha escaneada com o mesmo prefixo. **Áudio e gabarito não vão para o Git** (ficam em `docs/privado/`, fora do Git).

Casos difíceis a cobrir (mínimo): **N** normal (5 ou mais), **V** baia vizinha atirando (3), **C** baia coberta/eco (3), **S** splits rápidos (Bill Drill, 3), **R** com recarga (3), **T** transição entre alvos (3).

| N.º | Caso (N/V/C/S/R/T) | Aparelho e posição | Timer comercial: 1º disparo | Splits do comercial | Total comercial | Nome do arquivo | Observado (disparos extras ou faltando) | P/F |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |
| 4 | | | | | | | | |
| 5 | | | | | | | | |
| 6 | | | | | | | | |
| 7 | | | | | | | | |
| 8 | | | | | | | | |
| 9 | | | | | | | | |
| 10 | | | | | | | | |
| 11 a 20 | (use o verso) | | | | | | | |

Depois, para **3 a 5 dessas** tentativas, repita com o **Timer** do app e compare o resultado com o comercial (1º disparo, splits, total), como em [`teste-de-uso.md`](teste-de-uso.md). Em **Opções do timer > Diagnóstico da última escuta** anote a taxa de amostragem, "Filtros do microfone desligados" (sim/NÃO) e a latência de saída.

| Passo | O que anotar | Resultado observado | Aparelho |
|---|---|---|---|
| 9.A | Diagnóstico: taxa (48000 ou 44100) e filtros desligados sim/NÃO | | |
| 9.B | O apito do celular é ouvido pelo microfone com abafador? Distância máxima | | |
| 9.C | O primeiro tiro após o apito ficou mascarado pelo próprio apito? (CONS-021) | | |
| 9.D | Baia vizinha: quantos disparos falsos por tentativa? | | |
| 9.E | Baia coberta: o eco virou disparo? | | |
| 9.F | Menor split real que o app separou (e o comercial) | | |

---

## 10. Como devolver os resultados

- **Folha:** foto legível de cada página (ou este arquivo preenchido, ou uma planilha com as mesmas colunas). Nome: `roteiro-AAAA-MM-DD-aparelho.jpg`.
- **Áudios da Etapa 1** (bloco 9) e **backup JSON** (Histórico > Exportar backup, sem áudio) por um meio à sua escolha; para tentativas onde o detector errou, diga **quais** tentativas.
- Anote também: modelo e Android dos 2 aparelhos, modo de economia de bateria e **qualquer coisa estranha**, mesmo sem passo correspondente.
- Se o bloco 1 falhar, avise **antes** de seguir, para eu ajustar o serviço.

### O que cada bloco fecha

| Bloco | Achados que o resultado fecha ou decide |
|---|---|
| 1 Tela bloqueada | **CONS-007** (decide a Fase 5B: `ServicoAudio`, `onPause`/`onResume`); CONS-047 (wake lock do serviço), CONS-033 em parte (TalkBack) |
| 2 Primeiro uso | **CONS-001**, **CONS-013**, CONS-028 |
| 3 Trocar de aba, salvar, descartar | **CONS-002**, **CONS-008**, **CONS-009**, CONS-030 (Voltar), CONS-029 |
| 4 Silêncio | **CONS-010** (decisão D1) |
| 5 Voz, vibração, bipe | **CONS-011**, **CONS-012** (decisão D2), CONS-033 em parte |
| 6 Batidas | **CONS-019**, **CONS-020** |
| 7 Arquivos | **CONS-032**, CONS-014 (confirmar importação), CONS-044 (BOM) |
| 8 Aparência e barras | **CONS-031**, **CONS-034**, CONS-053 em parte |
| 9 Precisão | **CONS-006**, CONS-021, CONS-049; base de CONS-036 (fixtures) e da decisão D4 |

Itens que este roteiro **não** cobre (seguem no consolidado em "O que ficou sem verificar"): TalkBack, zoom 400%, bateria/temperatura em 30 min (só 1.10), `bmgr`/`allowBackup` (CONS-017), R8 e WebView mínima (minSdk 24), ranking com pessoas reais em quantidade, termos da voz (CONS-003).
