# Nicska — o que já foi implementado (sumário)

Resumo curto do que está feito, com o link para o roadmap completo de cada parte. O que **falta** está em [`../roadmap-pendencias.md`](../roadmap-pendencias.md). Data de referência: 2026-11-23. "Feito" quer dizer no código com testes (testes unitários e e2e no Chrome; a contagem atual sai de `npx vitest run`); **validação em aparelho real fica nas pendências**.

| Parte | Estado | Dados básicos | Roadmap completo |
|---|---|---|---|
| Etapa 0 — repositório limpo | feito (menos GitHub/CI) | base copiada do biblioteca-musical, só local | [roadmap-desenvolvimento.md](roadmap-desenvolvimento.md) (Etapa 0) |
| Etapa 2 — motor de detecção | feito no código | Goertzel 2700 Hz, janela do apito, tempo morto, reprocessar o áudio | [seção 5](roadmap-desenvolvimento.md) |
| Etapa 3 — timer e apito | feito | atraso 1 a 4 s, apito saturado, bipe, vibração, "STAND BY" grande | [Etapa 3](roadmap-desenvolvimento.md) |
| Etapa 4 — resultado e revisão | feito | tempo, indicadores, linha do tempo, apagar/inserir disparos, pontuação e HF | [Etapa 4](roadmap-desenvolvimento.md) |
| Etapa 5 — percursos e histórico | feito | IndexedDB v2, sessões, atiradores | [Etapa 5](roadmap-desenvolvimento.md) |
| Etapa 6 — gráficos e comparação | feito | evolução, splits, distribuição, até 3 sessões | [Etapa 6](roadmap-desenvolvimento.md) |
| Etapa 8 — exportar/importar JSON | feito | `nicska-backup/1` e `nicska/1`, dedup por id, abrir/compartilhar pelo Android | [Etapa 8](roadmap-desenvolvimento.md), [FORMATO.md](../FORMATO.md) |
| Etapa 9 — ranking local | feito | HF se todos pontuam, senão tempo; "duvidosas"; filtro de divisão | [Etapa 9](roadmap-desenvolvimento.md), [seção 7](roadmap-desenvolvimento.md) |
| I-01 — batidas (2 ou 3) | feito (ritmo ajustado no APK 019) | acelerômetro, até 1 s entre batidas, cancela com 1 batida, limite de 10 min | [roadmap-ideas.md](../roadmap-ideas.md) |
| I-02 — áudio como Ogg/Opus | feito | remux WebM→Ogg sem reencodar, `audio/ogg`, aviso se cair no `.webm` | [roadmap-ideas.md](../roadmap-ideas.md) |
| I-03 — STAND BY e voz | feito | voz Spruce seca "Standing by" embutida, vem antes do atraso; licença pendente | [roadmap-ideas.md](../roadmap-ideas.md) |
| UX/UI passos 1 a 7 | feito | histórico em abas, Resultado, Timer, Dados em Ajustes, níveis de botão, matriz de larguras | [roadmap-ux-ui.md](roadmap-ux-ui.md) |
| Temas | feito | Normal/Titânio/Telemetria × claro/escuro + Alto contraste AAA; `tools/contraste.py` | [design-tokens.md](../design-tokens.md) |
| Ícone e fonte | feito (PNG provisório) | ícone fase 2 + monocromático; Sora (OFL) só nos dígitos grandes e "STAND BY" | [design/icone/README.md](../../design/icone/README.md), [licencas-de-terceiros.md](../licencas-de-terceiros.md) |
| Barras do Android | feito (APK 017) | `NkTema` (`PonteTema.kt`, `src/lib/barras.ts`): ícones e cor da barra de navegação seguem o tema do app | [roadmap-ux-ui.md](roadmap-ux-ui.md) (UX-19) |
| Ação principal fixa (APK 018) | feito | Standby/Parar/Nova tentativa acima das abas (`BarraFixa.svelte`); Salvar largo, Descartar 34%, Compartilhar 66% | [roadmap-ux-ui.md](roadmap-ux-ui.md) (3.2, 3.3) |

APKs de teste (zips numerados, 001 a 046): [`../apk-de-teste.md`](../apk-de-teste.md).

## Pós-auditoria (2026-11-23)

Feito depois da auditoria 261123 (detalhe por item no `status.md` da auditoria de 2026-11-23, arquivo local; fases em [`../plano-de-acao.md`](../plano-de-acao.md)):

| Parte | Estado | Resumo |
|---|---|---|
| Fases 0 e 1 | feito | primeira tentativa salva com percurso no Resultado, Revisão que não se perde, confirmação ao descartar, Parar em todas as abas, silêncio 15 s, aviso da voz, `VIBRATE` |
| Fase 3 e 4 | feito | `audioComum.ts`; ogg/webm com testes; documento e armazenamento com limites em bytes, BOM, data real e importação atômica; confirmação ao importar; HF com tempo de 2 casas (IPSC 9.2.1.1/9.7.1); duvidosa por disparos mínimos; ids estáveis dos drills; plural com zero |
| Fase 5A | feito | `escuta.ts` sem corrida cancelar/iniciar, worklet cobre furos, apito em `preparando`, trava de tela solta e reposta |
| CONS-023 | feito | escuta interrompida com tiros vira resultado `incompleta` |
| Fase 7B a 7D | feito | CI endurecido, workflows herdados removidos, assinatura de release condicional, release sem `INTERNET`, `allowBackup=false`, `opener` removido; CSP só proposta |
| Fase 8 | feito | WARN do Tezcat em 4 trilhas (Svelte strict 20 FAIL / 85 WARN, score 97,2) |
| Pendentes sem dependência (9A a 9E) | feito | Voltar sobe um nível no Histórico (CONS-030), leitor de tela sem anunciar apito/escuta (033, parcial), dicas de primeiro uso e ajuda de sensibilidade (028), aviso de marcas (018, parcial), arquivo grande recusado antes de ler (045), backup sem indentação e aviso acima de 20 MiB (046), reprocesso repete a janela do apito e o modo fone (024), envelope só com consumidor e SVG decimado (048, parcial: sem Worker), texto do SVG em rem e pares de contraste (053), causa do e2e instável (035: microfone falso do Chrome), 14 ícones de música removidos (040) |

## Vídeo e limpeza (2026-11-23)

Feito depois da auditoria, fora das fases do plano (APK 030 a 046; zips em `apk-de-teste.md`). Validação no aparelho fica nas [pendências](../roadmap-pendencias.md).

| Parte | Estado | Resumo |
|---|---|---|
| Vídeo V1a a V1c | feito | base (IndexedDB v4, `videos`/`videos_pedacos`), captura com dois `MediaRecorder` (áudio intocado para o detector), prévia, Revisão com vídeo e pulo ao disparo |
| Vídeo V2 e V2b | feito | overlay ao vivo e na reprodução (`--u`, retrato e paisagem); tela cheia ao gravar, botão Sair segurando ~1 s; opções em Ajustes (Registro, Qualidade, Retenção, Overlay) |
| Vídeo V3 | feito | exportar "Com os tempos" (WebCodecs + `mp4-muxer`, com recuo para tempo real), erro específico na falha, pílula Vídeo/Áudio/lixeira, marca "Nicska" desligável |
| Interface | feito | Cronômetro (antes Timer), percurso em pílula com sugestões só do digitado, resultado em cartões, sliders gordinhos, doação com texto curto (removida em 2026-11-24) |
| Ícones | feito | ícone fase 2 do app; fase 3 na marca do overlay |
| Calibrar removida | feito | aba, `Gravador`, `ItemGravacao`, `gravador.ts`, `gravacoes.ts`, testes e 37 chaves de i18n; áudio cru da Etapa 1 vem do Cronômetro |
| i18n | feito | 9 chaves sem uso apagadas, depois as da Calibrar; 492 por idioma, as usadas conferidas nos 3 |
| Docs | feito | README, SECURITY, `roadmap-ideas.md` (de volta a `docs/`, com o estado de cada ideia); `ideia-gravar-video`, `revisao-ideia-video` e `ideia-enviar-audio-por-app` arquivados |

## Rodada de 2026-11-24 (7 trilhas, ainda sem APK)

| Parte | Estado | Resumo |
|---|---|---|
| Vibração 3/2/1 | feito | opção em Ajustes do Cronômetro (IPSC 8.3.9.1): 3 toques, 2 e 1 na partida; padrão desligada |
| 4K | feito | 2160p30 a 18 Mbps, opção avançada com aviso e recuo para 1080p; exportação limitada a 1080p |
| Retenção | feito | o vídeo recém-salvo nunca é apagado; espaço mínimo 1 GB, padrão 2 GB (4K de 200 s = 431 MiB) |
| Vídeos órfãos | feito | limpeza ao abrir (sessão anterior e mais de 1 h), botão em Ajustes → Retenção |
| Tela cheia da reprodução | feito | botão próprio no contêiner vídeo + overlay (o nativo só leva o `<video>`) |
| Ícones | feito | monocromático do Android 13+, limpeza do modelo do Tauri, notificação com cronômetro, `design/icone/` na fase 2 |
| Histórico | feito | trocar o percurso de uma tentativa salva; exportar legenda `.srt` |
| Pequenos | feito | taxa do `devicemotion` no diagnóstico, acordeão exclusivo, trilha dos sliders, aliasing do `tanh` medido |

