# Roteiro de teste no estande (Etapa 7)

Valida a fase 1 com **um timer comercial ao lado**. Os critérios são os da seção 9 de [`roadmap-desenvolvimento.md`](archive/roadmap-desenvolvimento.md):

- **Contagem:** mesmo número de disparos que o timer comercial em pelo menos **95%** das tentativas.
- **Tempo:** diferença de até **10 ms** por disparo.
- **Latência anulada:** com caixa Bluetooth, o 1º disparo medido muda no máximo ~**10 ms** em relação ao alto-falante do celular.
- **Revisão:** apagar ou inserir um disparo recalcula na hora e marca a tentativa como editada.
- **Comparação:** 3 sessões comparadas offline.
- Nada sai do aparelho sem a pessoa mandar.

As metas serão confirmadas com os dados da Etapa 1 ([`calibracao.md`](calibracao.md)).

## Antes de ir

1. Instalar o APK mais recente (o APK da última release do GitHub; ver [`apk-de-teste.md`](apk-de-teste.md)). Anotar o **commit** (nome do arquivo e linha "Versão" em Ajustes).
2. Conferir a bateria e deixar o volume de mídia no máximo.
3. No app, aba Timer: criar um percurso para o teste (por exemplo "Estande 1") e deixar escolhido.
4. Levar caneta e papel (ou o celular de apoio) para anotar o timer comercial **tentativa a tentativa, na ordem**.

## Como registrar cada tentativa

1. Pôr o **timer comercial no mesmo apito**: ele e o Nicska precisam partir do mesmo sinal. A forma mais simples é o **comercial dar o sinal** e o Nicska ouvir (o app detecta o apito pelo microfone), ou o contrário. Anote qual dos dois deu o sinal.
2. Atirar. Anotar do timer comercial: cada disparo em segundos desde o sinal (a tela dele mostra o tempo de cada tiro; se só mostra splits, some-os).
3. No Nicska, olhar o resultado e tocar em **Salvar**. A ordem das tentativas salvas no percurso é a ordem do papel.
4. Se precisar corrigir um disparo falso, **apague na revisão** antes de salvar e anote no papel que foi corrigido (a tentativa fica marcada como editada).

## Tarefas

| # | Tarefa | Tentativas | O que anotar |
|---|---|---|---|
| 1 | **Treino simples**: percurso curto | 10 | contagem de disparos dos dois |
| 2 | **Splits rápidos**: *Bill Drill* (6 disparos) | 5 | diferença por disparo |
| 3 | **Baia vizinha atirando** | 5 | disparos falsos do Nicska (os do vizinho) |
| 4 | **Baia coberta (eco)** | 5 | se o eco virou disparo |
| 5 | **Latência anulada**: 3 com a **caixa Bluetooth** e 3 com o **alto-falante do celular** (grupos `bluetooth` e `celular`) | 6 | 1º disparo de cada |
| 6 | **Revisão**: apagar um disparo e inserir outro | 1 | total recalculou? marcou "editada"? |
| 7 | **Tela bloqueada**: armar, bloquear a tela e atirar | 3 | a notificação "Parar" apareceu? gravou? |
| 8 | **Sessões**: repetir o treino simples em outro dia (3 dias) e abrir os gráficos | 3 sessões | a comparação abriu offline? |

Em cada tarefa, anote também onde o celular ficou (bolso, cinto, mesa) e a distância até o atirador.

## O que conferir no próprio aparelho (Etapas 2 e 3)

Em **Timer → Ajustes → Diagnóstico da última escuta** (aparece depois de uma tentativa):

- **Filtros do microfone desligados: sim.** Se disser "NÃO", o aparelho manteve eco, ruído ou ganho automático ligado: anotar o modelo e o Android.
- **Taxa de amostragem** (esperado 48000 ou 44100 Hz) e **latência de saída** (com a caixa Bluetooth deve ser bem maior: 100 a 300 ms).
- Resultado com aviso "início estimado": o apito não foi ouvido no microfone (volume baixo, abafador, fone). Anotar quando acontece.

Também anotar: **o apito é ouvido com o abafador?** E o **envio do áudio** (botão "Enviar áudio") para WhatsApp, Telegram, Signal e Messages: chegou como áudio, nota de voz ou documento? E as **batidas** (Ajustes do Timer): funcionam com o celular onde você o deixa?

## Comparar com o timer comercial

1. No app: **Histórico → Backup → Exportar backup** e leve o `.json` para o computador (WhatsApp, e-mail...). O backup não leva áudio.
2. Copiar `docs/modelo-timer.csv` para `docs/privado/` (fora do Git) e preencher: uma linha por tentativa, **na ordem em que foram salvas** (a 1 é a mais antiga). `grupo` é livre (`celular`, `bluetooth`, `vizinho`...). `disparos_s` são os tempos do timer comercial em segundos, separados por espaço, com vírgula ou ponto:

   ```
   n;grupo;disparos_s
   1;celular;1,48 1,73 1,98 2,21
   2;bluetooth;1,50 1,75 2,00 2,24
   ```

3. Rodar:

   ```bash
   python3 tools/comparar-com-timer.py nicska-backup-AAAA-MM-DD.json docs/privado/estande.csv --percurso "Estande 1"
   ```

   Sai a diferença por disparo (app − timer), quantas tentativas têm a mesma contagem, o maior desvio e o 1º disparo médio por grupo. O comando sai com 0 se os dois critérios (95% na contagem e ±10 ms) passam, e com 1 se não.

## Depois

- Registrar os números resumidos em [`calibracao.md`](calibracao.md) (números, não impressões) e a tabela por tentativa em `docs/privado/`.
- Se o detector errou, mandar o **backup** e dizer **quais tentativas**: com o áudio guardado no aparelho (Histórico → Ouvir ou Enviar áudio) dá para reprocessar com outros limiares e escolher os padrões com dados.
- Os padrões de sensibilidade (0,6) e tempo morto (60 ms) só mudam com esses números.
