# Calibração (Etapa 1)

Números, não impressões. Fonte: dois vídeos de treino de 2026-11-21 (WhatsApp, vídeo H.264 30 fps, áudio AAC): `20.08.56` (9 mm) e `20.09.06`
(.22). Áudio extraído em mono 48 kHz (ver `tests/fixtures/README.md`). **Sem gabarito de tiros ainda** (quantos tiros cada vídeo tem, ou o
tempo de um timer comercial): o que está abaixo é o que se vê na onda e no espectro.

## Apito

| Medida | Valor |
|---|---|
| Frequência | **2700 Hz** (bins de 50 Hz; fração do tom na energia do trecho ~0,55 a 0,60) |
| Duração | **~0,5 s** (começa com um transiente saturado; o nível pulsa por causa da compressão do áudio) |
| Atraso até o 1º tiro | 2,5 s (9 mm) e ~1,4 s (.22) |

A IPSC não manda frequência nem duração (só 1 a 4 s entre o "Stand by" e o sinal). Nenhum fabricante consultado publica a do timer (CED7000,
Pocket Pro, Kestrel KST1000 e AMG Lab Commander: só o Pocket Pro cita 1500 Hz, e é especificação do produto). O padrão do app é o que foi medido.

## Tiro

- Subida instantânea e saturada, seguida de **cauda de 0,5 a 1 s** (eco do estande e compressão do áudio).
- Consequência: **limiar fixo mais tempo morto não serve**. Contava 51 a 71 "disparos" por vídeo (a cauda e o ruído dentro dela).
- O detector usa uma **subida sobre a cauda**: o envelope (RMS de 2 ms) tem de passar de 2,2× a cauda de 4 ms atrás, que decai com constante
  de 60 ms, e de um piso de 0,05 (sensibilidade 0,6). Constante de 250 ms perdia o segundo tiro de um par a 100 ms.

## Primeiros resultados do detector (sem gabarito)

| Vídeo | Apito | Eventos de disparo | Observação |
|---|---|---|---|
| 9 mm (20.08.56) | 3,536 s | 18 | 1º tiro em 6,06 s |
| .22 (20.09.06) | 4,300 s | 18 (1 antes do apito, a 1,47 s) | 1º tiro em 5,74 s; o trecho final (31 a 34 s) é mais baixo e parece manuseio |

Pendente: gabarito de tiros, medir subida e pico, duração do eco e menor split real; conferir se o Opus a 64 kbps desloca o início do tiro
(o áudio aqui já é AAC de WhatsApp, mais comprimido que o do app); gravação crua do próprio app.
