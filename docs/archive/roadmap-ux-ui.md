> **Arquivado (2026-11-22).** Passos 1 a 7 e o ajuste da barra de ação fixa foram concluídos. O que ficou aberto está em [`../roadmap-pendencias.md`](../roadmap-pendencias.md). Resumo em [`roadmap-implementadas.md`](roadmap-implementadas.md).

# Roadmap UX/UI do Nicska

> Auditoria feita com o perfil **Lead Product Designer / UX Architect** (2026-11-22). **Fases 0 a 2: inventário, diagnóstico e proposta.** Nada foi implementado: nenhuma mudança de código antes da aprovação dos blocos da seção 6.
> Escopo: interface, arquitetura da informação, navegação, acessibilidade. Não toca regras de negócio, fórmulas, áudio nem dados guardados.

## 0. Base e limites da análise

**Base:** 11 capturas geradas pelo teste de ponta a ponta (`NK_FOTO=pasta npm run test:e2e`), em Chrome sem som, português, **390 × 800 CSS px** (resolução dupla), página inteira, com **dados sintéticos** (um percurso "Bill Drill" e duas pessoas inventadas no ranking). Não estão no repositório (geradas sob demanda).

**Limites (o que NÃO foi verificado):**
- Não medi contraste, tamanho real dos alvos de toque, foco nem teclado: são hipóteses.
- A **barra de abas embaixo aparece no meio das imagens**: é efeito da captura de página inteira (a barra é fixa). **Não é prova de sobreposição**; precisa ser conferida no aparelho (UX-01).
- "Fonte 200%" foi simulada com `font-size: 200%` na raiz, o que não é igual ao zoom do navegador nem à fonte do sistema do Android.
- Só 390 px de largura (e 800 × 390 deitado, nos gráficos). Faltam 320, 360, 430, 768, 1024 e 1440.
- Nenhuma pesquisa com usuários: nada abaixo é "comprovado", só observado ou hipótese.

## 1. Inventário (Fase 0)

| Tela | O que tem hoje | Observado em |
|---|---|---|
| Timer, sem percurso | Cabeçalho do resultado vazio (`–,––`), formulário "Criar percurso" (nome, disparos, 4 sugestões), botão **Standby** | 02 |
| Timer, resultado | Tempo grande, 5 indicadores, linha do tempo (forma de onda + cursor), tabela de disparos (ouvir/apagar), "Reprocessar o áudio" (sensibilidade, tempo morto), Pontuação (opcional), **Salvar**, **Nova tentativa**, **Descartar**, "Ajustes do timer" | 03, 04 |
| Histórico, lista | Lista de percursos + bloco **Backup** (nome, Exportar, Importar) | 05 |
| Histórico, percurso aberto | ← Todos os percursos, título, **Compartilhar**, **Editar**, **Ranking** (só se há outra pessoa), 4+ gráficos, comparar até 3 sessões, **todas as sessões com todas as tentativas** (Pontuação, Ouvir, Apagar em cada), **Apagar percurso** | 06, 07, 08 |
| Calibrar | Provisória (Etapa 1); **não capturada** | — |
| Ajustes | Aviso de independência, Aparência, Idioma, Sobre, Créditos | 01 |
| Fora das capturas | Timer em uso (Standby grande, escuta), Ajustes do timer (voz, vibração, bipe, batidas, atraso), diagnóstico | — |

Navegação: abas **Timer / Histórico / Calibrar** embaixo; engrenagem no topo leva a **Ajustes**.

## 2. Diagnóstico (Fase 1)

Severidade P0 a P3 e confiança conforme o perfil. "Evidência" aponta a captura.

| ID | Evidência | Problema | Consequência | Prioridade | Confiança |
|---|---|---|---|---|---|
| UX-01 | Todas as capturas longas: a barra de abas cai no meio da imagem | **Descartado (passo 1, 2026-11-22):** era efeito da captura de página inteira. Medido no Chrome (390 × 800) e visto no emulador Android 17: no fim da rolagem o conteúdo termina ~24 px acima da barra | Nenhuma | ~~P0~~ fechado | Alta |
| UX-02 | 06/07: uma página só com ← Todos, Compartilhar, Editar, Ranking, 4 gráficos, comparação e todas as sessões (≈ 4.800 px de altura com 13 tentativas, a 390 px) | Detalhe do percurso é uma página infinita; o que o usuário quer (suas tentativas, comparar) fica enterrado | Alto esforço de rolagem e baixa encontrabilidade; cresce a cada tentativa | P0 | Alta |
| UX-03 | 03: "Salvar" (azul cheio) e "Nova tentativa" (azul cheio, **maior**) lado a lado em hierarquia; "Descartar" igual a qualquer botão neutro | Duas ações primárias concorrendo; a destrutiva sem distinção | Salvar esquecido (a tentativa se perde ao tocar "Nova tentativa") ou descarte por engano | P0 (a confirmar o que acontece ao tocar Nova tentativa sem salvar) | Média |
| UX-04 | 03: depois da lista de disparos vêm "Reprocessar o áudio" (sensibilidade, tempo morto) e só então Pontuação e as ações | Ferramenta rara e técnica empurra para baixo a pontuação e o Salvar | O fluxo comum (ver, pontuar, salvar) fica com ruído | P1 | Alta |
| UX-05 | 06/07: cada tentativa traz 3 botões (Pontuação, Ouvir, Apagar), repetidos 13 vezes | Muitos controles iguais e a ação destrutiva colada às outras | Toque errado em Apagar; poluição visual | P1 | Alta |
| UX-06 | 07: coluna **HF** do ranking cortada (aparece "6,25" pela metade) com o título "HF" colado | A tabela rola na horizontal sem pista visual | Dado importante escondido em 390 px | P1 | Alta |
| UX-07 | 08 (fonte 200%, **simulada** no Chrome): "Nicska" quebra em "Nic / ska", "Calibrar" corta. **No emulador Android com fonte do sistema 2,0** (capturas do emulador, não versionadas): o nome cabe em uma linha, as 3 abas cabem (a "Calibrate" fica a ~30 px da borda), "Timer settings" quebra em 2 linhas sem problema, e os botões Exportar/Importar quebram o rótulo em 2 linhas | A simulação exagerou; no Android real o reflow funciona. Resta a aba "Calibrar" apertada e o ranking/tabelas, **ainda não vistos no emulador** | Baixo no que foi visto | **P2** (rebaixado) | Média |
| UX-08 | 02: o formulário "Criar percurso" ocupa a tela e o botão **Standby** fica abaixo dele | Configuração (rara) acima do uso (frequente) | Quem só quer disparar um tempo rola para achar o botão | P1 | Média |
| UX-09 | 06: gráficos de linha com **1 sessão** (um ponto solto) e "Distribuição dos splits" com 3 picos ligados por linha | Gráficos sem sentido com pouco dado; histograma desenhado como linha sugere tendência entre classes | Interpretação errada ou confusão | P1 | Média |
| UX-10 | 05: **Backup** (nome, exportar, importar) dentro de Histórico; Ajustes não tem dados; o timer tem "Ajustes do timer" dentro do Timer | Três lugares com o nome "Ajustes"/configuração e dados espalhados | Quem procura "backup" ou "voz" não sabe onde | P1 | Média |
| UX-11 | 05: rótulos "Exportar backup" e "Importar backup" ficam em alturas diferentes (um `button`, outro `label`) | Mesmo papel, aparência levemente diferente | Inconsistência visível | P2 | Alta |
| UX-12 | Botões "Apagar", "Apagar percurso", "Descartar" em tom neutro (borda cinza) | Sem cor/ícone de perigo | Ação destrutiva pouco identificável (a de percurso tem confirmação; as outras, não confirmei) | P1 | Média |
| UX-13 | 03: textos "1 **disparos** apagados e 1 inseridos" e "(1 **tentativas**)" no seletor de comparação | Plural errado em mais lugares (o do Histórico já foi corrigido) | Acabamento | P2 | Alta |
| UX-14 | 04/06: HF com 4 casas ("6,2500", "0,0000") e 2 casas em outros lugares (ranking "6,25") | Formato diferente do mesmo número | Dúvida se são valores diferentes | P2 | Alta |
| UX-15 | 07: **Ranking** vem antes de Gráficos e depois dos botões Compartilhar/Editar | Ordem sem lógica de tarefa; Editar percurso (rara) entre o ranking e os gráficos | Ruído | P2 | Média |
| UX-16 | 03: 5 indicadores em grade de 2 colunas, o último sozinho | Grade desequilibrada; "Total" repete o número grande acima | Redundância | P3 | Alta |
| UX-18 | Emulador em inglês (02 e fonte grande): a sugestão **"Saque (1 disparo)"** e o nome padrão **"Atirador"** continuam em português | Texto fixo fora do dicionário de idiomas | Mistura de idiomas na interface em inglês e espanhol | P2 | Alta |
| UX-19 | **Corrigido (2026-11-22, APK 017):** ponte `NkTema` (PonteTema.kt + `src/lib/barras.ts`): mede o `--fundo` real e liga os ícones claros ou escuros das barras do sistema e pinta a barra de navegação (início/voltar) com a cor do app; confere no emulador em escuro (Telemetria) e claro (Normal), com navegação por 3 botões. Antes: o relógio e os ícones da **barra de status** do sistema ficavam escuros sobre o fundo escuro, e a barra de baixo ficava branca | A cor dos ícones da barra de status segue o tema do SISTEMA, não o do app; com "Automático" não aparece, mas ao forçar Escuro com o sistema claro (ou o inverso) some | Hora e bateria ilegíveis | P1 | Alta (visto) |
| UX-20 | Fonte Sora no placeholder `–,––` do cronômetro: a vírgula vira um traço inclinado e fica estranha | Só o glifo da vírgula na fonte; os números reais saem normais | Acabamento (a conferir com um tempo real no aparelho) | P3 | Média |
| UX-17 | Não capturado: Calibrar, Timer em uso, Ajustes do timer, estados vazios e de erro | Não dá para avaliar | — | — | — |

**O que já funciona (preservar):** cabeçalho simples; número grande legível; abas com rótulo de texto; Ajustes com disclosure consistente; gráficos com legenda de cor + marcador + traço e "Ver como tabela"; azul como cor de ação; nenhum estouro horizontal da página em 390 px (a rolagem só aparece dentro da tabela do ranking); marcação de tentativas "estimado/editada" no ranking.

## 3. Proposta estrutural (Fase 2)

Princípio: **mover e agrupar, sem remover** nenhuma função. Tudo o que existe continua alcançável, só em outro lugar ou recolhido.

### 3.1 Histórico, detalhe do percurso (UX-02, 05, 06, 09, 15)

Quatro seções por **abas internas** (padrão de abas secundárias), com a seleção lembrada:

```text
[← Percursos]   [Bill Drill]                [⋯ menu: Compartilhar · Editar · Apagar percurso]
[Visão geral | Tentativas | Análises | Comparar]

VISÃO GERAL   : melhor tempo · média · nº de tentativas · última (3 indicadores num card)
                1 gráfico: evolução por sessão  ·  link "Ver análises"
TENTATIVAS    : sessões recolhidas (accordion), cada uma: data, nº, melhor
                linha da tentativa: tempo + data/hora + "›" (abre o detalhe com Pontuação · Ouvir · Apagar)
ANÁLISES      : splits de uma tentativa · tempo até cada disparo · distribuição (agrupados por pergunta)
COMPARAR      : sessões (até 3) + tabela  ·  Ranking (só aparece com outras pessoas)
```

- **Preserva:** todos os gráficos, a comparação, o ranking, Compartilhar, Editar, Apagar percurso (agora no menu "⋯", longe do toque comum), "Ver como tabela".
- **Estado com poucos dados:** gráfico de linha só com 2+ sessões; com 1, texto "Faça mais uma sessão para ver a evolução" e os valores em tabela (UX-09). Distribuição: sugerir barras em vez de linha (decisão de **apresentação**; o cálculo não muda).
- **Mobile / desktop:** em largura ≥ ~900 px, Visão geral e Análises em duas colunas; abas viram lista lateral. Breakpoints a definir pelo conteúdo, não por modelo de aparelho.
- **Trade-off:** mais toques para chegar a um gráfico específico (1 toque na aba) em troca de uma página curta e previsível. Risco: quem já gosta de ver tudo de uma vez perde isso. Alternativa mais barata (se as abas parecerem demais): manter a página única, mas recolher as sessões e os gráficos em *disclosures* e mover Compartilhar/Editar/Apagar para o menu.
- **Critério de aceitação:** a tela inicial do percurso cabe em ≤ 2 telas de rolagem com 50 tentativas; Apagar percurso exige 2 passos e não está na linha de ação principal; todos os controles de hoje continuam alcançáveis em ≤ 2 toques.

### 3.2 Resultado da tentativa (UX-03, 04, 12, 16)

```text
[Tentativa encerrada]                       [aviso: início estimado / editada]
[4,00 s]                                     ← valor principal
[1º disparo 2,00 · Disparos 4 · Menor split 0,22 · Maior split 1,38]   ← 1 card, 4 itens
[Linha do tempo + cursor + Ouvir/Inserir]
[Disparos e splits: tabela  (Ouvir · Apagar por linha)]
[▸ Pontuação (opcional)]                     ← disclosure; aberto se já pontuou
[▸ Reprocessar o áudio (avançado)]           ← disclosure, fechado
[Salvar]  ← primária, azul cheia
[Nova tentativa]  ← secundária (contorno azul)
[Descartar]  ← texto/ícone de perigo, separado
```

- **Preserva:** todos os controles, inclusive Reprocessar e a edição de disparos. Só mudam de lugar/ênfase.
- **Mudança de risco:** a hierarquia entre **Salvar** e **Nova tentativa**. Proponho Salvar como primária quando há percurso e a tentativa não foi salva; **Nova tentativa** com contorno. Depois de salvar, **Nova tentativa** vira a primária (a ação seguinte). Isso muda o comportamento de ênfase, não o fluxo.
- **Critério:** em 390 × 800, Salvar, Nova tentativa e Descartar aparecem sem rolar depois da tabela de disparos; Descartar usa cor/ícone de perigo e fica separado por espaço.

### 3.3 Timer, tela inicial (UX-08)

```text
[Pronto]  [–,–– s]  [0 disparo]
[Percurso: Bill Drill ▾]   [+ Novo percurso]      ← seletor compacto; "Novo" abre o formulário (disclosure)
[ STANDBY ]                                        ← ação principal logo abaixo
[▸ Ajustes do timer]
```

- Sem nenhum percurso: o formulário continua aparecendo aberto (primeira vez), **acima** do Standby só nesse caso, com o Standby visível e habilitado (hoje já funciona sem percurso; só não salva).
- **Critério:** com ao menos um percurso, o Standby está visível sem rolar em 360 × 640.

### 3.4 Dados, ajustes e navegação (UX-10, 11)

- **Backup e Importar** sair do Histórico para **Ajustes → Dados** (Exportar backup, Importar arquivo, nome do atirador). O Histórico mantém **Importar** só pelo recebimento de arquivo (Abrir com) e um atalho "Importar arquivo" discreto. *Decisão 4.*
- "Ajustes do timer" continua no Timer (é do uso diário), mas com um rótulo que a distinga de "Ajustes" do app: **"Opções do timer"**. *Decisão 4.*
- **Calibrar** fica como está até a Etapa 1; depois decidir se vira item de Ajustes (UX-17).

### 3.5 Sistema visual (tokens), sem redesenho de marca

Inspecionar e **listar o que já existe** antes de criar (CSS em rem; variáveis `--borda-controle`, `--superficie`…). Propor só o que falta:
- **Níveis de ação:** primária (azul cheia), secundária (contorno azul), neutra (borda cinza), **perigo** (vermelho, texto ou contorno), link. Uma só definição por nível, usada em todo o app.
- **Card:** um padrão só (superfície + borda fina + raio); usar card para agrupar, não para cada número.
- **Números:** HF com 2 casas em todo o app (formatação, não cálculo); tempos em segundos com 2 casas.
- **Alvos de toque:** meta de conforto ≈ 44 × 44 CSS px nos botões das linhas de tentativa e do "+/−" da pontuação (medir antes).

### 3.6 Responsividade, acessibilidade e gráficos

- Corrigir primeiro o que quebra com fonte grande (UX-07): cabeçalho com `min-width: 0` e nome que não quebra no meio da palavra, abas com rótulo que cabe ou vira ícone + texto curto, seletor de divisão em largura total.
- **Ranking em 390 px:** mostrar colunas Pos., Atirador, Melhor e **HF** primeiro; Média e Tentativas num detalhe expansível por linha, em vez de rolagem horizontal (UX-06).
- Plurais e formato do HF: ajustes de texto (UX-13, 14).
- Matriz de teste a rodar **depois** de aprovado: 320, 360, 390, 430, 768, 1024, 1440; zoom 200% e 400%; teclado (Tab, foco visível); leitor de tela nas abas e no menu "⋯".

## 4. Plano de execução (pequeno e verificável)

Cada passo é um commit com teste/print antes e depois. Nada começa sem aprovação do bloco.

1. ~~Verificar UX-01 e UX-07~~ **Feito (2026-11-22):** nenhum dos dois é P0; a barra não cobre conteúdo e a fonte 2,0 do Android não quebra as abas.
2. ~~Tokens de ação e correção de textos~~ **Feito (2026-11-22):** níveis `primario` / `secundario` / neutro / `perigo` (+ `confirmar` no 2º toque de uma exclusão) em `+layout.svelte`; Apagar e Descartar em perigo; no Resultado, Salvar é a principal enquanto há o que salvar e depois a principal passa a ser Nova tentativa, com Descartar separado; plurais (editada, sessão, apagar percurso) sem "1 disparos/tentativas"; "Saque" e o nome padrão do atirador traduzidos (UX-18); botão Importar com a altura do Exportar (UX-11). **UX-14 mudou:** o HF fica com **4 casas em todo o app** (é a convenção do esporte); o ranking passou a usar 4, em vez de reduzir os outros a 2.
3. ~~Resultado da tentativa (3.2)~~ **Feito (2026-11-22):** Pontuação e "Reprocessar o áudio" viraram cartões recolhíveis (o resumo da pontuação aparece no título: "25 pontos · HF 6,2500"; ela abre sozinha ao começar a pontuar); a hierarquia dos botões veio no passo 2.
4. ~~Histórico, detalhe (3.1)~~ **Feito (2026-11-22):** menu "⋯" (Compartilhar, Editar, Apagar percurso), abas internas (`Secoes.svelte`) **Visão geral** (4 indicadores + evolução; com 1 sessão só, um texto no lugar do gráfico), **Tentativas** (sessões recolhíveis, a mais recente aberta; cada tentativa recolhida com as ações dentro), **Análises** (splits de uma tentativa) e **Comparar** (sessões, tabela, tempo até cada disparo, distribuição e Ranking). Diferença da proposta: o tempo até cada disparo e a distribuição ficaram em Comparar, porque dependem das sessões marcadas.
5. ~~Timer inicial (3.3)~~ **Feito (2026-11-22):** sem percurso, só a dica e o botão "Novo percurso" (o formulário abre ao tocar); o Standby fica logo à vista.
6. ~~Ranking responsivo e Dados em Ajustes~~ **Feito (2026-11-22):** ranking com 4 colunas (Pos., Atirador, Melhor, HF) e média, HF médio, tentativas e dúvidas numa segunda linha sob o nome (sem rolagem horizontal); "Dados e backup" em Ajustes (`Dados.svelte`, lógica comum em `dados.ts`); o Histórico mantém só "Importar arquivo"; "Ajustes do timer" virou "Opções do timer".
7. ~~Reteste da matriz~~ **Feito (2026-11-22):** o e2e confere que Histórico, Comparar e Tentativas não estouram na horizontal em 320, 360, 390, 430, 768, 1024 e 1440 px, com fonte 100% e 200% (simulada). Não coberto: zoom 400%, teclado e leitor de tela (a testar à mão), contraste medido e alvos de toque medidos.

## 5. Evidências a coletar (antes de implementar)

- Capturas que faltam: **Calibrar**, **Timer em uso**, **STAND BY grande**, **Ajustes do timer aberto**, estados **vazios** (sem percurso no Histórico, sem tentativas), **erro** (arquivo importado inválido), tablet (768) e desktop (1024).
- No aparelho: o que a barra de abas cobre; tamanho real do "+/−" e dos botões das linhas; fonte do sistema grande.
- Hipótese de uso a confirmar com o responsável: com que frequência alguém compara pessoas e abre gráficos, para decidir entre as abas internas ou só recolher (alternativa da 3.1).

## 6. Decisões para aprovação

Cada bloco: **Aprovado / Ajustar / Rejeitado**.

| # | Bloco | Recomendação |
|---|---|---|
| 1 | **Histórico, detalhe:** abas internas Visão geral / Tentativas / Análises / Comparar, com menu "⋯" (Compartilhar, Editar, Apagar percurso) | Aprovar. Se parecer demais, a alternativa de uma página só com seções recolhidas |
| 2 | **Resultado:** Pontuação e Reprocessar em disclosures; Salvar primária, Nova tentativa secundária, Descartar como perigo separado | Aprovar |
| 3 | **Timer inicial:** seletor compacto de percurso + "Novo percurso" recolhido; Standby logo abaixo | Aprovar |
| 4 | **Dados e nomes:** Backup/Importar para Ajustes → Dados; "Ajustes do timer" vira "Opções do timer" | Aprovar (é o que mais mexe em hábitos; pode ficar para depois) |

Os itens P2/P3 (plural, HF com 2 casas, estilo do Importar, grade de indicadores) entram **sem votação**, junto do passo 2, por serem acabamento sem mudança de função.

Não há mudança de dados, cálculos, áudio nem regras: todas as propostas são de interface.

## 7. Registro

| Data | O que | Quem |
|---|---|---|
| 2026-11-22 | Fases 0 a 2 (inventário, diagnóstico, proposta); 11 capturas (locais) | UX/UI (perfil) |
| 2026-11-22 | **Passo 1 feito**: UX-01 descartado (medido no Chrome e visto no emulador Android 17, 1080 × 2400); UX-07 rebaixado a P2 (fonte do sistema 2,0 no emulador não quebra o cabeçalho nem as abas); novo UX-18 (textos fixos em português na UI em inglês) | UX/UI |
| 2026-11-22 | **Passo 4 feito** (seção 4, item 4) | UX/UI |
| 2026-11-22 | **Passo 2 feito** (ver seção 4, item 2) | UX/UI |
| 2026-11-22 | Correção do script de prints: o print do ranking saiu com fonte 200% por engano e foi refeito (07 normal, 08 com fonte 200%) | UX/UI |
