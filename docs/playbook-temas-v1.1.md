# NICSKA — Playbook de Temas e Cores (v1.1 — Vermelho Óptico)
**DOCUMENTO/PROMPT PARA IMPLEMENTAÇÃO NO NOVO APLICATIVO**  
**Status:** revisão cromática para implementação; não é uma alteração executada no código do Nicska.  
**Mudança na v1.1:** Vermelho Óptico e suas variantes acessíveis substituem o azul como acento de ações, botões, links, controles ativos e foco em todos os estilos; o azul permanece apenas em informações e séries secundárias de gráficos.  
**Referência analisada:** `biblioteca-musical-main.zip` (projeto anterior fornecido pelo usuário).  
**Identidade já definida do Nicska:** `#14181F` (preto-azulado), `#F2F2F2` (cinza-claro), `#F85149` (Vermelho Óptico).

## 1. Instrução central para quem vai implementar

> Implemente no **Nicska** um sistema de temas composto por **Modo de aparência** e **Estilo cromático** independentes, inspirado na arquitetura verificada no projeto de referência, mas **não copie as cores musicais nem referências de hinos**. Preserve o comportamento e as funcionalidades já existentes no novo app. Use as seis paletas completas descritas abaixo, com **Vermelho Óptico como acento principal de interface** e tokens semânticos com fallback apropriado. Não altere o logotipo, a geometria do símbolo ou os PNGs do avatar. Antes de modificar arquivos, localize a arquitetura real do Nicska (framework, componentes, persistência e configuração atual); adapte a implementação a ela em vez de presumir que o Nicska usa Svelte/Tauri. Não introduza dependências ou mudanças funcionais desnecessárias. Após implementar, execute testes de contraste, modo automático, troca de estilo, persistência e estados de cronometragem.

## 2. O que foi confirmado no projeto anterior

- `src/lib/tema.css` define tokens de cor para seis combinações: Normal, Pergaminho e Marinho e ouro, cada uma em Claro/Escuro.
- `src/lib/tema.svelte.ts` e `src/lib/estilos.ts` mantêm preferências independentes (modo e estilo), persistidas em `localStorage`.
- `src/app.html` aplica as preferências armazenadas antes de pintar a página, para evitar flash de tema incorreto.
- `src/routes/ajustes/+page.svelte` expõe controles de Modo e Estilo, desabilitando Estilo quando Alto contraste está ativo.
- `docs/design-tokens.md` documenta a diferença entre cor de ação (`--acento`) e cor do ponto ativo (`--ouro`, `--ouro-linha`), além das metas de contraste. No Nicska, **substituir essa semântica musical por identidade Vermelho Óptico aplicada às ações e à medição de tempo**.
- Há um modo **Alto contraste** independente que ignora os estilos. **Automático não é uma sétima paleta**: escolhe Claro/Escuro conforme o sistema.

## 3. Nomes recomendados (alteração proposta)

| Estilo anterior | Novo nome visível | Identificador sugerido | Personalidade |
|---|---|---|---|
| Normal | **Normal** | `normal` | Identidade principal do Nicska; neutro e esportivo |
| Pergaminho | **Titânio** | `titanio` | Neutros metálicos e grafite, inspirados em instrumentos de precisão |
| Marinho e ouro | **Telemetria** | `telemetria` | Azuis profundos e superfícies técnicas, sem dourado |

> **Importante:** os nomes **Titânio** e **Telemetria** são propostas novas, não nomes já aprovados ou existentes no projeto antigo. Se o Nicska já guarda `pergaminho` ou `marinho` em preferências, tratar como valores legados e migrar com segurança para `titanio` e `telemetria`, somente após identificar a estrutura real do projeto. Não renomear arquivos/dados sem necessidade.

### Estrutura da tela Ajustes → Aparência

**Modo:** Automático (segue o sistema) · Claro · Escuro · Alto contraste (se disponível ou implementado).  
**Estilo:** Normal · Titânio · Telemetria.  
**Combinações:** 3 estilos × 2 modos = **6 paletas**. Alto contraste é um modo adicional próprio, não uma combinação. As escolhas devem persistir separadamente.

## 4. Regra de cores da marca e do produto

| Cor | HEX | Regra |
|---|---|---|
| Vermelho Óptico | `#F85149` | Identidade **fixa** do logotipo e da fatia temporal do ícone. Não substituir por laranja ou dourado. |
| Preto-azulado | `#14181F` | Base escura oficial do logotipo; pode ser usado no Normal Dark. |
| Cinza-claro | `#F2F2F2` | Estrutura do ícone, ponteiros e mira. |
| Vermelho de interface | `#C92B31` no Claro e `#FF746D` no Escuro para texto e contorno; `#F85149` no Escuro para botão preenchido | Variações funcionais do **Vermelho Óptico**, para contraste; não constituem outra marca. |

**Regra obrigatória nesta revisão:** o **vermelho é a cor principal de interação do Nicska**. Os estilos Normal, Titânio e Telemetria podem mudar fundos, superfícies e tons neutros, mas **não podem trocar o acento por azul, verde ou dourado**. Use a família do Vermelho Óptico para botões primários, links, abas selecionadas, controles ativos, foco e a marcação de tempo. No tema Escuro, o botão sólido usa o vermelho original `#F85149`; links e contornos usam uma variante mais clara `#FF746D` para legibilidade. No tema Claro, o vermelho de interface é `#C92B31`, que contrasta melhor com superfícies claras.

**Separação semântica:** `--acento` representa ações e links; `--acento-botao` representa o preenchimento do botão principal; `--tempo-ativo` representa a medição em destaque. Todos pertencem à **mesma família vermelha**. Erros (`--perigo`) continuam sendo um estado separado: diferenciar por texto, ícone e contexto, jamais apenas por cor.

## 5. Tokens semânticos obrigatórios

Adotar estes nomes como contrato conceitual. Se o novo projeto já tiver tokens equivalentes, mapeá-los sem criar uma camada duplicada. Os prefixos `--` são uma sugestão para CSS; em apps nativos, mapear para a solução de temas existente.

| Token CSS sugerido | Uso |
|---|---|
| `--fundo` | Fundo da tela |
| `--superficie` | Cartões, formulários, modais |
| `--superficie-alt` | Superfície elevada/alternativa |
| `--texto` | Texto principal |
| `--suave` | Texto secundário |
| `--borda` | Divisórias decorativas |
| `--borda-controle` | Borda de campos e controles |
| `--acento` | Links, controles ativos, ícones interativos e realces de ação: sempre vermelho óptico ou variante acessível |
| `--acento-botao` | Preenchimento de botões primários: vermelho acessível no Claro; `#F85149` no Escuro |
| `--acento-texto` | Texto sobre botão de ação |
| `--foco` | Anel de foco visível, na família do Vermelho Óptico |
| `--tempo-ativo` | Tempo ativo como texto/linha |
| `--tempo-fundo` | Bloco de tempo ativo |
| `--tempo-sobre` | Texto sobre bloco de tempo |
| `--tempo-trilha` | Trilha da barra de tempo |
| `--selecionado` | Superfície do item selecionado |
| `--perigo` | Erros e ações destrutivas |
| `--sucesso` | Conclusão/salvamento bem-sucedido |
| `--aviso` | Avisos não destrutivos |
| `--info` | Informações e orientação |
| `--grafico-a` | Gráfico: tempo atual |
| `--grafico-b` | Gráfico: referência |
| `--grafico-c` | Gráfico: melhor marca |
| `--grafico-d` | Gráfico: outra série |
| `--marca-vermelho` | Vermelho Óptico imutável da identidade: `#F85149` |
| `--marca-grafite` | Preto-azulado imutável da identidade: `#14181F` |
| `--marca-claro` | Cinza-claro imutável da identidade: `#F2F2F2` |

### Interpretação correta do vermelho em ações e na cronometragem

- `--acento`: vermelho para texto de links, bordas e símbolos de interação. Não usar azul para interações primárias nem em Titânio/Telemetria.
- `--acento-botao`: vermelho sólido no botão primário; combinar com `--acento-texto`.
- `--acento-texto`: cor do texto sobre `--acento-botao`; não presumir branco sobre qualquer vermelho.
- `--foco`: contorno de foco vermelho com reforço de espessura/offset; o foco nunca depende só da mudança de cor.

- `--tempo-ativo`: cor para texto, números em destaque, marcadores e linhas sobre o fundo de cada modo.
- `--tempo-fundo`: cor sólida de fundo para chips/células de tempo ativo; pode ser diferente do vermelho fixo da marca no **Claro** para manter contraste.
- `--tempo-sobre`: cor do texto colocado **sobre** `--tempo-fundo` (não presumir branco sobre vermelho).
- `--tempo-trilha`: trilha contrastante contra a parte preenchida de um indicador de progresso.
- `--selecionado`: realce discreto de superfície; não deve ser o único sinal de seleção.

## 6. Paletas completas — seis combinações

**Os valores abaixo são propostas para o Nicska, não cópia das paletas antigas.** Cada linha é um token semântico. A geometria do ícone e o vermelho da marca permanecem invariáveis.

### Normal — Claro e Escuro

Aparência de referência: branco/cinza-azulado no Claro e preto-azulado no Escuro; **ações, botões e tempos em Vermelho Óptico**.

| Token | Claro | Escuro |
|---|---|---|
| `--fundo` | `#F7F8FA` | `#14181F` |
| `--superficie` | `#FFFFFF` | `#242A33` |
| `--superficie-alt` | `#EDF0F4` | `#303845` |
| `--texto` | `#14181F` | `#F2F2F2` |
| `--suave` | `#526173` | `#BAC6D5` |
| `--borda` | `#D8DEE7` | `#46515E` |
| `--borda-controle` | `#738193` | `#93A1B0` |
| `--acento` | `#C92B31` | `#FF746D` |
| `--acento-botao` | `#C92B31` | `#F85149` |
| `--acento-texto` | `#FFFFFF` | `#14181F` |
| `--foco` | `#C92B31` | `#FF746D` |
| `--tempo-ativo` | `#C92B31` | `#FF746D` |
| `--tempo-fundo` | `#C92B31` | `#F85149` |
| `--tempo-sobre` | `#FFFFFF` | `#14181F` |
| `--tempo-trilha` | `#D8DEE7` | `#303845` |
| `--selecionado` | `#FCE9E8` | `#38272B` |
| `--perigo` | `#B42318` | `#FF928A` |
| `--sucesso` | `#1A713A` | `#75DB98` |
| `--aviso` | `#805500` | `#FFD27A` |
| `--info` | `#155D88` | `#94CCFF` |
| `--grafico-a` | `#C92B31` | `#FF746D` |
| `--grafico-b` | `#1768B3` | `#7BBCFF` |
| `--grafico-c` | `#1A713A` | `#75DB98` |
| `--grafico-d` | `#7750A5` | `#B99BF9` |

### Titânio — Claro e Escuro

Aparência mais neutra: superfícies quase metálicas no Claro e grafite no Escuro; **ações, botões e tempos em Vermelho Óptico**.

| Token | Claro | Escuro |
|---|---|---|
| `--fundo` | `#EEEDE9` | `#24262A` |
| `--superficie` | `#FFFEFC` | `#34373C` |
| `--superficie-alt` | `#E4E3DE` | `#41454A` |
| `--texto` | `#22252A` | `#F3F3F1` |
| `--suave` | `#5A5D61` | `#CFD0CF` |
| `--borda` | `#C9C8C2` | `#565B63` |
| `--borda-controle` | `#777B80` | `#A0A6AD` |
| `--acento` | `#C92B31` | `#FF746D` |
| `--acento-botao` | `#C92B31` | `#F85149` |
| `--acento-texto` | `#FFFFFF` | `#14181F` |
| `--foco` | `#C92B31` | `#FF746D` |
| `--tempo-ativo` | `#BD2932` | `#FF8279` |
| `--tempo-fundo` | `#BD2932` | `#F85149` |
| `--tempo-sobre` | `#FFFFFF` | `#14181F` |
| `--tempo-trilha` | `#C9C8C2` | `#303236` |
| `--selecionado` | `#F8E6E4` | `#493538` |
| `--perigo` | `#AF2523` | `#FFA19B` |
| `--sucesso` | `#236F42` | `#86DBA6` |
| `--aviso` | `#805800` | `#F8D689` |
| `--info` | `#285E79` | `#A4D5E9` |
| `--grafico-a` | `#BD2932` | `#FF8279` |
| `--grafico-b` | `#315E68` | `#A5D6DF` |
| `--grafico-c` | `#236F42` | `#86DBA6` |
| `--grafico-d` | `#73549B` | `#C3A5F3` |

### Telemetria — Claro e Escuro

Aparência técnica azulada: azul-gelo no Claro e azul-marinho profundo no Escuro; **ações, botões e tempos em Vermelho Óptico** (azul apenas em superfícies e informação secundária).

| Token | Claro | Escuro |
|---|---|---|
| `--fundo` | `#E9EEF7` | `#071A34` |
| `--superficie` | `#FFFFFF` | `#0E2B4E` |
| `--superficie-alt` | `#DDE6F3` | `#17385F` |
| `--texto` | `#0B1D3F` | `#EEF3FB` |
| `--suave` | `#44577A` | `#C4D2E9` |
| `--borda` | `#CBD6E6` | `#29486C` |
| `--borda-controle` | `#6B7DA0` | `#829ECA` |
| `--acento` | `#C92B31` | `#FF746D` |
| `--acento-botao` | `#C92B31` | `#F85149` |
| `--acento-texto` | `#FFFFFF` | `#071A34` |
| `--foco` | `#C92B31` | `#FF746D` |
| `--tempo-ativo` | `#C12B36` | `#FF8279` |
| `--tempo-fundo` | `#C12B36` | `#F85149` |
| `--tempo-sobre` | `#FFFFFF` | `#14181F` |
| `--tempo-trilha` | `#CBD6E6` | `#17385F` |
| `--selecionado` | `#F9E5E8` | `#443044` |
| `--perigo` | `#B3261E` | `#FFA19B` |
| `--sucesso` | `#176E3D` | `#80E1A2` |
| `--aviso` | `#7F5500` | `#FFD587` |
| `--info` | `#174F87` | `#9CC5FF` |
| `--grafico-a` | `#C12B36` | `#FF8279` |
| `--grafico-b` | `#173F7A` | `#9CC5FF` |
| `--grafico-c` | `#176E3D` | `#80E1A2` |
| `--grafico-d` | `#66519C` | `#C8B0FF` |

### Observação sobre cores azuis secundárias

Os tokens `--info` e `--grafico-b` **podem continuar azuis**, pois representam informação auxiliar ou uma série secundária, não são a cor de ação. Não usar essas cores para botões, links, aba ativa, seleção principal nem foco. O estilo Telemetria continua azulado **nos fundos**, mas seu acento interativo será vermelho como nos demais estilos.

### Alto contraste — modo independente (recomendado manter)

O projeto anterior disponibiliza Alto contraste como quarto modo, não como estilo. Para o Nicska, **preservar o conceito** caso exista ou esteja no escopo: fundo preto `#000000`, superfícies pretas `#000000`, texto e ação amarelo `#FFFF00`, texto sobre ação `#000000`, foco `#FFFFFF`, trilha `#666600`, perigo `#FF7777`, sucesso `#66FF66`. Sugestão de tokens complementares: `--borda-controle: #FFFF00`, `--tempo-ativo: #FFFF00`, `--tempo-fundo: #FFFF00`, `--tempo-sobre: #000000`, `--aviso: #FFFF00`, `--info: #FFFF00`. Não usar as paletas Titânio/Telemetria neste modo; o seletor de estilo deve ficar inativo com explicação acessível.

### Regra técnica comum aos seis temas

- **Light**: `--acento = --acento-botao = --foco = #C92B31`; texto sobre botão `#FFFFFF`.
- **Dark**: `--acento = --foco = #FF746D` para links/contornos e `--acento-botao = #F85149` para botões sólidos; texto sobre botão `#14181F`.
- A cor da marca `--marca-vermelho` permanece **`#F85149` em todas as combinações**; não confundir com a variante de acessibilidade do tema Light.
- Cor azul é aceita em `--info`, `--grafico-b` e nos fundos azulados de Telemetria, **nunca como CTA/acento geral**.

## 7. Mapa de aplicação nas telas do Nicska

| Região / estado | Tokens recomendados |
|---|---|
| Tela principal, histórico, ajustes | `--fundo`, `--texto`, `--suave` |
| Cards de sessão, campos, diálogos | `--superficie`, `--borda-controle`, `--texto` |
| Cartões de resultados e cabeçalho de métricas | `--superficie-alt`, `--texto`, `--suave` |
| Botões comuns, navegação, links | `--acento-botao` + `--acento-texto` (preenchidos); `--acento` (links e realces) |
| Cronômetro em repouso | `--texto`, `--suave` (não destacar como ativo) |
| Cronômetro ativo / leitura em destaque | `--tempo-ativo` ou `--tempo-fundo` + `--tempo-sobre` |
| Linha de tempo, progresso e marcador de sessão | `--tempo-ativo`, `--tempo-trilha` |
| Item/intervalo selecionado | `--selecionado`, borda/ícone + rótulo |
| Salvamento concluído | `--sucesso` + mensagem textual |
| Alerta de áudio, permissão, sincronização | `--aviso` ou `--info`, rótulo e ícone |
| Falha, exclusão ou perda de dados | `--perigo` + rótulo e ícone |
| Foco de teclado | `--foco` com contorno visível |
| Comparação de tempos e gráficos | `--grafico-a`, `--grafico-b`, `--grafico-c`, `--grafico-d`, com legendas e formas diferentes |

**Atenção à função do vermelho:** o vermelho óptico tem significado de **tempo/medição na identidade da marca**. Não o usar como sinal automático de erro, risco ou falha. Erros continuam com seu próprio ícone, rótulo e token semântico `--perigo`.

## 8. Comportamento esperado e migração segura

1. **Automático:** seguir a preferência do sistema operacional, sem sobrescrever a escolha de estilo. A troca Claro/Escuro deve atualizar os tokens da combinação correspondente.
2. **Claro e Escuro:** forçar o modo selecionado, independentemente da preferência do sistema.
3. **Estilo:** apenas muda a paleta cromática; **não** muda o fluxo de telas, o tamanho da fonte, os tempos registrados, a gravação ou os dados.
4. **Persistência:** reter modo e estilo separadamente. Aplicar valores antes da primeira renderização, se a plataforma permitir, para evitar flash de tema.
5. **Valores inválidos:** retornar a `normal` e `sistema`, preservando preferências válidas. Ao migrar dados antigos, se existirem, tratar `pergaminho → titanio` e `marinho → telemetria`. Se não houver legado, não criar migração fictícia.
6. **Alto contraste:** deve ignorar os outros estilos, com precedência inequívoca, sem alterar a preferência de estilo armazenada. Ao sair desse modo, restaurar o estilo anterior.
7. **Componentes:** não usar HEX isolados nos componentes; preferir sempre os tokens. Exceção justificada: desenhos do logo e recursos visuais cuja identidade de marca é fixa.
8. **Compatibilidade:** detectar a tecnologia do Nicska antes de gerar alterações. O projeto anterior era Svelte/Tauri; este documento **não prova** que o novo app usa a mesma stack.

## 9. Validação objetiva antes de considerar concluído

### Contraste e acessibilidade

- Alvos para os **seis estilos**: texto normal e mensagens ≥ **4,5:1** contra superfícies aplicáveis; bordas essenciais, ícones e gráficos informativos ≥ **3:1**. Foco sempre visível.
- Os valores foram verificados matematicamente para os pares principais de texto, vermelho de ação e de botão, rótulo de tempo, estados e borda-controle contra `--fundo`/`--superficie`; **isso não substitui testes visuais reais em todos os componentes**.
- O texto sobre `--tempo-fundo` foi selecionado para atingir ≥ **4,5:1**. A faixa de preenchimento de tempo contrasta pelo menos **3:1** com a trilha correspondente nas seis paletas.
- No Alto contraste, priorizar texto ≥ **7:1** e controles ≥ **4,5:1**, conforme a estratégia original; verificar todos os componentes e com usuários quando possível.
- Não sinalizar estados exclusivamente por cor; usar rótulos, ícones, padrões ou posição. Não depender apenas de brilho/animação.

### Cenários de teste

- [ ] Normal Claro / Normal Escuro.
- [ ] Titânio Claro / Titânio Escuro.
- [ ] Telemetria Claro / Telemetria Escuro.
- [ ] Automático alternando sistema claro ↔ escuro em cada estilo.
- [ ] Preferências persistentes após reiniciar e ausência de flash de tema.
- [ ] Alto contraste não recebe sobrescrita dos estilos.
- [ ] Telas com cronômetro em repouso, ativo, resultado salvo e estados de erro/aviso.
- [ ] Gráficos, cards, botões, foco, bordas e campos em cada combinação.
- [ ] Fonte ampliada, telas compactas e orientação variável.
- [ ] Avatar/ícone Nicska não sofre recoloração nem alteração geométrica.

## 10. Entregáveis exigidos ao implementador

1. Relatório breve identificando os arquivos reais do **novo Nicska** relacionados a temas e estilos.
2. Implementação das seis paletas com tokens semânticos e modo Automático.
3. Atualização dos rótulos visíveis para **Normal, Titânio e Telemetria** (e traduções, se existirem).
4. Integração dos tokens em telas e estados relevantes; **nenhum botão primário, link principal, foco ou controle ativo deve continuar azul**, independentemente do estilo. Nenhum componente com cores antigas de Pergaminho/Marinho e ouro hardcoded.
5. Testes automatizados de contraste, precedência de modos, troca de estilo e persistência, conforme tecnologia disponível.
6. Capturas ou prévias das seis combinações na mesma tela de cronômetro e resultado, para comparação lado a lado.
7. Lista de arquivos alterados, eventuais decisões de adaptação e resultados dos testes. **Não afirmar sucesso se algum teste não foi executado.**

## 11. Regras de aceite para o Vermelho Óptico

- [ ] Em Normal, Titânio e Telemetria, nos modos Claro/Escuro, `--acento` é um **tom de vermelho óptico**, nunca azul.
- [ ] Em todos os estilos escuros, o botão primário preenchido usa **`#F85149`** e texto **`#14181F`**.
- [ ] Em todos os estilos claros, o botão primário preenchido usa **`#C92B31`** e texto **`#FFFFFF`**.
- [ ] Links, seleções, foco e controles ativos usam `--acento`; não copiar os azuis de `--info` ou `--grafico-b`.
- [ ] O logo mantém o vermelho original **`#F85149`** mesmo no modo Claro; acessibilidade da interface é resolvida pelos tokens de interação.
- [ ] Diferenciar botão de ação vermelho, alerta de perigo e tempo ativo por ícone, texto, hierarquia e contexto; nunca somente pela cor.
- [ ] O usuário pode alternar Modo e Estilo independentemente, sem perder dados de sessão e sem alterar a geometria do avatar.

## 12. Aceite pendente de design

Este documento propõe os nomes **Titânio** e **Telemetria** e as paletas completas. A **identidade fixa** `#14181F / #F2F2F2 / #F85149` vem das decisões já tomadas para o Nicska, mas as novas paletas de interface e os nomes Titânio/Telemetria são recomendações para análise e aprovação visual. **O acento vermelho substituindo o azul foi definido a pedido do usuário nesta revisão.** Não substituir o ícone original, o playbook de avatares ou a Fase 4 pendente por este trabalho de temas.

---
*Fim do prompt de implementação — revisão v1.1 (acento Vermelho Óptico). Fonte de referência: projeto `biblioteca-musical-main.zip` enviado nesta conversa; sugestões cromáticas: estudo de design do Nicska.*
