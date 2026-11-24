# Nicska — pendências

Tudo o que ainda **não** está feito ou validado (atualizado em 2026-11-23). O que já foi feito está resumido em [`archive/roadmap-implementadas.md`](archive/roadmap-implementadas.md), com links para os roadmaps completos; as ideias em aberto, em [`roadmap-ideas.md`](roadmap-ideas.md). Ao concluir um item, mova-o para lá.

Legenda: **[R]** depende do responsável (decisão, aparelho, conta) · **[C]** é com o Claude · **P1/P2/P3** prioridade.

## Estado atual

As Fases 0 a 5A, 7B a 7D e 8 do plano de ação e a rodada dos pendentes sem dependência (9A a 9E) estão **feitas e na `main`** (APK 028; o vídeo, V1 a V3, entrou depois: APK 032 a 046, ver abaixo e em `apk-de-teste.md`). Item por item da auditoria: `status.md` da auditoria de 2026-11-23 (arquivo local). O que falta está abaixo e depende, em sua maioria, de **você** (aparelho, campo, decisões); o que não depende de ninguém são só os restos dos itens parciais, listados em "Pendentes sem dependência" do `status.md`.

## Plano de ação

O que fazer e em que ordem (fases, trilhas, responsáveis): [`plano-de-acao.md`](plano-de-acao.md). A auditoria que o originou, com os achados e os erros dos próprios relatórios: `00-consolidado.md` da auditoria de 2026-11-23 (arquivo local).

## 1. Validar no aparelho real (o estado e o último APK gerado estão em [`apk-de-teste.md`](apk-de-teste.md)) **[R]**

- [ ] **Roteiro passo a passo com folha de anotação** (escuta com tela bloqueada primeiro, 2 aparelhos, Etapa 1): [`roteiro-de-campo.md`](roteiro-de-campo.md).
- [ ] Compartilhar o áudio como Ogg (WhatsApp, Business, Telegram, Signal) e anotar se vira áudio, nota de voz ou documento (I-02, passo 5).
- [ ] **Batidas** (2 ou 3): ritmo novo (até 1 s entre elas, confirmação de 600 ms, APK 019); limiar de 7 m/s² nas 4 posições do celular; taxa real do `devicemotion`; batida que cancela (graça de 0,8 s).
- [ ] Voz "Standing by" (Spruce, seca) e tela "STAND BY": volume com abafador, não atrapalhar o detector, comportamento com fone/Bluetooth (t0 estimado).
- [ ] Importar/abrir JSON recebido de outro app; ranking com pessoas reais.
- [ ] Redesenho de UX (abas do histórico, Resultado, barra de ação fixa acima das abas; o Descartar hoje é a lixeira na pílula de enviar).
- [ ] Temas (6 paletas + Alto contraste) com o tema do sistema trocando com o app aberto; barras do Android (status e navegação) nas cores do tema (APK 017): confirmar no celular do responsável, onde a barra de baixo era branca; alguns fabricantes forçam essa cor.
- [ ] **Acento = Vermelho Óptico** (playbook v1.1): conferir no celular se o botão principal e o cronômetro ativo (`--tempo-*`, mesma família de cor) não se confundem; reverter é um commit.
- [ ] Vírgula da Sora no cronômetro com um tempo real (UX-20, P3).
- [ ] Trilha 1A da auditoria (CONS-001, 002, 008, 009: percurso no resultado, revisão montada com id estável, confirmação ao descartar, Parar visível em todas as abas): feita no código e coberta pelo e2e (verde na `main`); falta conferir no aparelho.
- [ ] **Spike de vídeo S1/S2/S3** (ferramenta já na `main`, mesclada): instalar o APK, Ajustes, rodapé, Teste de câmera; rodar os 7 passos e colar o relatório. Passo a passo e critérios: [`spike-video.md`](spike-video.md). Decide 1080p, 60 fps, 4K e se a câmera nativa vira necessária.
- [ ] **Vídeo no aparelho (APK 046)**: câmera da prévia emprestada ao gravador; dois gravadores no mesmo microfone sem picotar o detector; pulo ao disparo no quadro certo (deslocamento áudio × vídeo); duração do WebM; tela cheia (barras escondidas, Voltar, segurar 1 s para parar, TalkBack); overlay ao vivo × resultado; **exportar "Com os tempos"** (qual motor roda, tempo e tamanho de 30 s, MP4 no WhatsApp, memória em 3 min); envio do WebM cru no WhatsApp.
- [ ] Etapa 7: validação no estande contra um timer comercial (critérios da seção 9 do roadmap arquivado, `teste-de-uso.md`).

## 2. Decisões do responsável **[R]**

- [ ] **Licença da voz "Spruce"** (serviço neural): ler os Termos e Políticas vigentes sobre redistribuir o áudio em app MIT/loja; sem isso, trocar por TTS de API com licença clara ou voz livre (`licencas-de-terceiros.md`).
- [ ] Voz ligada por padrão ou não (risco: gente perto no estande); aviso "só para treino, não usar em prova nem com outra baia ativa".
- [ ] "Reload and Standing By" entra? (padrão desligado, aviso de treino).
- [ ] **Batidas com a tela bloqueada** (pedido de 2026-11-22): hoje a tela fica acesa (`wakeLock`) e a WebView para o sensor ao bloquear. Para funcionar bloqueada, só com serviço nativo em primeiro plano lendo o acelerômetro (bateria, indicador permanente). Decidir se vale.
- [x] **Calibrar:** aba removida (2026-11-23); o áudio cru da Etapa 1 vem das tentativas normais do Cronômetro ("Enviar áudio").
- [ ] Ícone do app: hoje PNG da fase 2 (gerador `tools/gerar-icone-do-app-png.py`); o ícone monocromático (Android 13+) foi devolvido em 2026-11-24, **conferir no aparelho** (aparece menor que o colorido: zona segura de 66%) e a nova silhueta de cronômetro da notificação.
- [ ] Etapa 10/11: pilha do site, identidade (apelido com código ou conta), privacidade, opção de confiança dos dados (seção 7 do roadmap arquivado).

## 3. Etapa 0: repositório **[R]**

- [ ] Criar `HyakoV3/nicska` no GitHub e fazer o primeiro push **só depois de um MVP** (regra: nicska é sem co-autoria).
- [ ] CI verde (depende do repositório). Os workflows `claude-*` herdados foram removidos (CONS-004); não há mais segredos do Claude Code Review a configurar.
- [x] Ícones de música da interface removidos (CONS-040): `icones.json` tem só os 11 em uso.

## 4. Etapa 1: calibração com áudio real **[R] gravar, [C] analisar**

- [ ] Gravar 10 a 20 tentativas (Cronômetro com áudio cru, ou vídeo) com gabarito (timer comercial ou vídeo a 60 fps ou mais), incluindo baia vizinha, baia coberta, splits rápidos, recarga e transição.
- [ ] [C] `tools/analisar-tentativas.py` (envelope, limiar, tempo morto, Goertzel do apito) com relatório por tentativa.
- [ ] [C] Medir subida e pico do tiro, eco, nível dos vizinhos e o menor split real; conferir se Opus a 64 kbps desloca o início do tiro (senão o app grava PCM).
- [ ] [C] Registrar os números em `docs/calibracao.md`.

## 5. Etapa 2: motor de detecção

- [ ] Fixtures curtas reais da Etapa 1 no Git (WAV mono), testadas contra o gabarito.
- [ ] No aparelho: `AudioWorklet` na WebView, `getSettings()` com filtros desligados, latência de entrada, tela apagada.
- [ ] Plano B (só se o worklet falhar): captura nativa em Rust.

## 6. UX/UI: o que sobrou da auditoria

- [x] **P2 UX-18:** textos fixos em português na interface em inglês/espanhol: corrigido no código (o nome padrão vem de `atirador.padrao` no dicionário; a sugestão "Saque" tem a chave `drill.saque` traduzida nos três idiomas). Falta só rever no aparelho. Histórico em [`archive/roadmap-ux-ui.md`](archive/roadmap-ux-ui.md).
- [ ] **P3 UX-16:** grade de indicadores do Resultado (o 5º fica sozinho na última linha).
- [ ] Capturas que nunca foram feitas: Timer em uso, "STAND BY" grande, Opções do timer aberto, estados vazios e de erro.
- [ ] Testes do perfil não feitos: zoom 400% (**não se aplica à pinça**: ver a decisão abaixo; vale o tamanho de fonte do sistema), teclado, leitor de tela, tamanho real dos alvos de toque, contraste por componente (só os pares de cores foram medidos).
- [x] Mensagens: Apagar de tentativa e Descartar pedem confirmação, e o 2º toque se desarma sozinho em 4 s (CONS-008 e CONS-052, feitos).

- [ ] **Adaptar o kit de auditoria** (kit de perfis de auditoria, arquivo local): trocar os perfis musicais (06 a 11, 13) por perfis do Nicska (detecção de disparos, áudio do microfone, ranking, JSON) e rodar a primeira rodada.

## 7. Ideias abertas

Tudo o que é ideia (fala, V4, restos do vídeo, editar tentativa, nota S/A/B/C/D, detalhes de interface, varredura de frequência, apito com mais de uma baia) está em [`roadmap-ideas.md`](roadmap-ideas.md), com o estado de cada uma. Aqui ficam só as que dependem de ação sua:

- Entrega dos APKs: via GitHub Releases (workflow `release.yml`).
- [ ] **Validar no aparelho (APK 047)**: vibração 3/2/1 (durações dos toques), 4K (esquenta? recua?), tela cheia da reprodução (o `requestFullscreen()` num contêiner pode não funcionar no WebView do Tauri), limpeza de órfãos, trocar percurso, `.srt` no WhatsApp, taxa do sensor. Além disso (seção 1): I-01 batidas, I-03 voz, vídeo V1 a V3.

## 8. Técnicas

- [ ] Barra fixa: conferir no aparelho com teclado aberto e em tablet.
- [x] Feitos em 2026-11-24 (falta só validar no aparelho): taxa do `devicemotion` no diagnóstico, vídeos órfãos limpos ao abrir, retenção que não apaga o recém-salvo (mínimo 1 GB, padrão 2 GB), tela cheia da reprodução com overlay, acordeão exclusivo, trilha dos sliders, aliasing do `tanh` medido (-59 dB sem oversample, < -118 dB com 2x: sem problema), vibração 3/2/1, 4K (avançado, 30 fps, 18 Mbps, recua para 1080p), trocar percurso e exportar legenda `.srt` no Histórico.

## 9. Decisões do mantenedor (registro)

- **2026-11-24: zoom de pinça desabilitado em todo o app, a pedido do mantenedor** (`maximum-scale=1, user-scalable=no` em `src/app.html` e `touch-action: pan-x pan-y` no `html`; na tela cheia da gravação, `touch-action: none`). Motivo: a pinça mudava a escala da câmera e do overlay e atrapalhava os toques durante a tentativa. **Ressalva registrada:** isso contraria a WCAG 1.4.4 (redimensionar texto); fica mitigado porque o app segue o tamanho de fonte do sistema Android e usa `rem`. Se uma revisão de acessibilidade ou a Play Store questionar, a decisão foi do mantenedor, não uma omissão; reverter é voltar o viewport e tirar o `touch-action`.
- **2026-11-24: seleção azul e realce de toque desligados na tela cheia da gravação** (e o realce de toque em todo o app), também a pedido do mantenedor.
- **2026-11-24: botão de doação (PayPal) removido do app, a pedido do mantenedor** (seção em Ajustes, ponte `NkDoacao`/`PonteDoacao.kt`, chaves `doacao.*` e teste). "Qualquer coisa voltamos no futuro": o código está no histórico do Git antes desta data (commit `d00d82a` e anteriores) e no backup local do histórico completo.

