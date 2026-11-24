# Tema e tokens de cor

O app tem duas escolhas de aparência, em **Ajustes → Aparência**, que se combinam:

- **Modo:** **Automático** (padrão, segue o sistema com `prefers-color-scheme`), **Claro**, **Escuro** (forçam o tema, ignorando o sistema; `data-tema` no `<html>`) ou **Alto contraste** (baixa visão; paleta própria, ignora o estilo, sem alterar o estilo guardado).
- **Estilo de cor:** **Normal** (a identidade do Nicska), **Titânio** ou **Telemetria** (`data-estilo` no `<html>`; o normal não leva atributo). Cada estilo tem versão clara e escura: **6 paletas**. O Automático não é uma sétima paleta.

As duas escolhas são guardadas separadamente no aparelho (`tema` e `estilo` no `localStorage`). O `src/app.html` aplica as salvas antes da primeira pintura, para a tela não piscar. **Migração:** quem tinha os estilos do projeto de origem passa de `pergaminho` para `titanio` e de `marinho` para `telemetria` (`migrarEstilo` em `src/lib/estilos.ts`, repetida no `app.html`; valor inválido volta a `normal`).

Fonte das paletas: o playbook de temas do Nicska (2026-11-22). Os valores estão em [`src/lib/tema.css`](../src/lib/tema.css) e passam em todos os pares de contraste de `python3 tools/contraste.py` (tabela abaixo).

## Identidade fixa (não muda com tema nem estilo)

`--marca-vermelho #F85149` (Vermelho Óptico: a fatia de tempo do ícone), `--marca-grafite #14181F` (preto-azulado), `--marca-claro #F2F2F2`. O ícone do app atual (`design/icone/nicska-simbolo.png`, gerado por `tools/gerar-icone-do-app-png.py`) usa exatamente estas três cores e **não é recolorido**; nenhum componente consome `--marca-*` (só o logotipo e os ícones, por exceção). O `design/icone/icone.svg` é a fonte provisória antiga (moldura âmbar `#d9822b`) e **não** é o ícone atual.

## Tokens

Nenhum componente usa HEX: só estes nomes (exceção: o logotipo e os ícones).

| Token | Função |
|---|---|
| `--fundo` / `--superficie` / `--superficie-alt` | Fundo das telas; cartões, campos, modais; superfície elevada ou alternativa |
| `--texto` / `--suave` | Texto principal; texto secundário |
| `--borda` | Divisórias e trilhas **decorativas** (não delimitam controles) |
| `--borda-controle` | Limite de campos, botões, abas, listas e interruptores (mínimo 3:1) |
| `--acento` / `--acento-texto` | **Ação**: botão principal, links, aba selecionada, foco; e o texto sobre o botão |
| `--foco` | Anel de foco do teclado |
| `--tempo-ativo` | **Medição**: o tempo em evidência como texto, linha ou marcador (o cronômetro enquanto escuta) |
| `--tempo-fundo` / `--tempo-sobre` | Bloco sólido de tempo em evidência e o texto sobre ele (não presumir branco) |
| `--tempo-trilha` | Trilha de uma barra de tempo |
| `--selecionado` | Realce discreto de item selecionado (nunca o único sinal: leva borda, ícone ou rótulo) |
| `--perigo` / `--sucesso` / `--aviso` / `--info` | Erro e exclusão; conclusão; aviso não destrutivo; orientação. Sempre com **texto e ícone** |
| `--grafico-a` / `-b` / `-c` / `-d` | Séries dos gráficos (tempo atual, referência, melhor marca, outra); as séries também se distinguem por marcador e traço |
| `--fonte-display` | Fonte dos números grandes e do STAND BY (Sora) |

**Ação x medição.** O vermelho óptico é a cor de ação nos três estilos (playbook v1.1, a pedido do responsável): `--acento` (links, foco, aba selecionada, contornos) `#C92B31` no claro e `#FF746D` no escuro, e `--acento-botao` (preenchimento do botão primário, texto em `--acento-texto`) `#C92B31` no claro e `#F85149` no escuro; o azul só resta em `--info` e `--grafico-b`. O vermelho de tempo (`--tempo-*`) é para o que está sendo medido. O vermelho de tempo **não é** o vermelho de erro (`--perigo`), e este não deve parecer o cronômetro. Em cada paleta o vermelho de tempo é mais escuro no claro e mais luminoso no escuro, para dar contraste.

## Estilos

| Estilo | Claro | Escuro | Ações (`--acento`) |
|---|---|---|---|
| **Normal** | cinza-azulado (`#F7F8FA`) | preto-azulado (`#14181F`) | vermelho óptico (`#C92B31` / `#FF746D`, botão `#C92B31` / `#F85149`) |
| **Titânio** | neutros metálicos (`#EEEDE9`) | grafite (`#24262A`) | vermelho óptico (`#C92B31` / `#FF746D`, botão `#C92B31` / `#F85149`) |
| **Telemetria** | azul-gelo (`#E9EEF7`) | azul-marinho profundo (`#071A34`) | vermelho óptico (`#C92B31` / `#FF746D`, botão `#C92B31` / `#F85149`) |

**Alto contraste:** preto `#000000`, texto, ação e tempo em amarelo `#FFFF00`, foco branco; metas AAA (7:1 no texto, 4,5:1 nos componentes). Como o playbook só definiu alguns tokens deste modo, os demais foram escolhidos aqui: `--superficie-alt #000000`, `--borda`/`--tempo-trilha #666600`, `--selecionado #333300`, gráficos `#FFFF00`, `#66FFFF`, `#66FF66`, `#FF99FF` (também distintos por marcador e traço).

## Estrutura do `tema.css`

Cada estilo repete os mesmos três blocos (claro, escuro do sistema dentro de `@media (prefers-color-scheme: dark)`, escuro escolhido) e a ordem importa: o escuro do estilo é mais específico e vence o claro do estilo quando o modo é escuro. O Alto contraste fica no fim e os escuros do sistema o excluem com `:not(...)`. Os dois blocos escuros de um estilo têm que ter os mesmos valores (o `tools/contraste.py` confere).

## Contraste (medido em `tools/contraste.py`, WCAG 2.2)

Texto: 4,5:1; componentes e gráficos: 3:1; Alto contraste: 7:1 e 4,5:1. Isto é a conta dos pares de tokens; **não substitui** o teste visual de cada componente nem o teste com pessoas.

Pares `acento` e `suave` sobre `--selecionado` entraram em CONS-053 (texto e links em linhas selecionadas). Três `--selecionado` ficaram abaixo de 4,5:1 com `acento` e foram ajustados no mínimo (3 a 5% em direção ao branco ou ao preto): Titânio claro `#f8e6e4` → `#f8e7e5`, Titânio escuro `#493538` → `#453235`, Telemetria claro `#f9e5e8` → `#f9e6e8`. O critério não mudou.

#### Estilo `normal`

| Par (texto / fundo) | Uso | Meta | Claro | Escuro |
|---|---|---|---|---|
| `texto` / `fundo` | Texto principal sobre o fundo | 4.5:1 | 16.75:1 ✓ | 15.89:1 ✓ |
| `texto` / `superficie` | Texto principal sobre cartões e campos | 4.5:1 | 17.79:1 ✓ | 12.90:1 ✓ |
| `texto` / `superficie-alt` | Texto principal sobre superfícies alternativas | 4.5:1 | 15.57:1 ✓ | 10.55:1 ✓ |
| `texto` / `selecionado` | Texto sobre o item selecionado | 4.5:1 | 15.22:1 ✓ | 12.56:1 ✓ |
| `suave` / `fundo` | Texto secundário sobre o fundo | 4.5:1 | 5.96:1 ✓ | 10.27:1 ✓ |
| `suave` / `superficie` | Texto secundário sobre cartões e campos | 4.5:1 | 6.33:1 ✓ | 8.34:1 ✓ |
| `suave` / `superficie-alt` | Texto secundário sobre superfícies alternativas | 4.5:1 | 5.54:1 ✓ | 6.82:1 ✓ |
| `suave` / `selecionado` | Texto secundário sobre o item selecionado | 4.5:1 | 5.42:1 ✓ | 8.12:1 ✓ |
| `acento` / `selecionado` | Links e ações sobre o item selecionado | 4.5:1 | 4.64:1 ✓ | 5.34:1 ✓ |
| `acento` / `fundo` | Links e ações sobre o fundo | 4.5:1 | 5.10:1 ✓ | 6.75:1 ✓ |
| `acento` / `superficie` | Links e ações sobre cartões | 4.5:1 | 5.42:1 ✓ | 5.48:1 ✓ |
| `acento-texto` / `acento-botao` | Texto do botão principal | 4.5:1 | 5.42:1 ✓ | 5.31:1 ✓ |
| `acento-botao` / `fundo` | Botão principal contra o fundo | 3.0:1 | 5.10:1 ✓ | 5.31:1 ✓ |
| `acento-botao` / `superficie` | Botão principal contra cartões | 3.0:1 | 5.42:1 ✓ | 4.31:1 ✓ |
| `tempo-ativo` / `fundo` | Tempo em evidência (texto) sobre o fundo | 4.5:1 | 5.10:1 ✓ | 6.75:1 ✓ |
| `tempo-ativo` / `superficie` | Tempo em evidência (texto) sobre cartões | 4.5:1 | 5.42:1 ✓ | 5.48:1 ✓ |
| `tempo-sobre` / `tempo-fundo` | Texto sobre o bloco de tempo em evidência | 4.5:1 | 5.42:1 ✓ | 5.31:1 ✓ |
| `tempo-fundo` / `tempo-trilha` | Preenchimento do tempo sobre a trilha | 3.0:1 | 4.01:1 ✓ | 3.52:1 ✓ |
| `perigo` / `fundo` | Erro e ação destrutiva (texto) sobre o fundo | 4.5:1 | 6.19:1 ✓ | 8.24:1 ✓ |
| `perigo` / `superficie` | Erro e ação destrutiva (texto) sobre cartões | 4.5:1 | 6.57:1 ✓ | 6.69:1 ✓ |
| `sucesso` / `fundo` | Sucesso (texto) sobre o fundo | 4.5:1 | 5.70:1 ✓ | 10.46:1 ✓ |
| `sucesso` / `superficie` | Sucesso (texto) sobre cartões | 4.5:1 | 6.06:1 ✓ | 8.49:1 ✓ |
| `aviso` / `fundo` | Aviso (texto) sobre o fundo | 4.5:1 | 6.14:1 ✓ | 12.50:1 ✓ |
| `aviso` / `superficie` | Aviso (texto) sobre cartões | 4.5:1 | 6.53:1 ✓ | 10.15:1 ✓ |
| `info` / `fundo` | Informação (texto) sobre o fundo | 4.5:1 | 6.69:1 ✓ | 10.46:1 ✓ |
| `info` / `superficie` | Informação (texto) sobre cartões | 4.5:1 | 7.11:1 ✓ | 8.49:1 ✓ |
| `borda-controle` / `fundo` | Limite de controles sobre o fundo | 3.0:1 | 3.74:1 ✓ | 6.75:1 ✓ |
| `borda-controle` / `superficie` | Limite de controles sobre cartões | 3.0:1 | 3.97:1 ✓ | 5.48:1 ✓ |
| `foco` / `fundo` | Anel de foco sobre o fundo | 3.0:1 | 5.10:1 ✓ | 6.75:1 ✓ |
| `foco` / `superficie` | Anel de foco sobre cartões | 3.0:1 | 5.42:1 ✓ | 5.48:1 ✓ |
| `grafico-a` / `superficie` | Gráfico, série A sobre o cartão | 3.0:1 | 5.42:1 ✓ | 5.48:1 ✓ |
| `grafico-b` / `superficie` | Gráfico, série B sobre o cartão | 3.0:1 | 5.73:1 ✓ | 7.21:1 ✓ |
| `grafico-c` / `superficie` | Gráfico, série C sobre o cartão | 3.0:1 | 6.06:1 ✓ | 8.49:1 ✓ |
| `grafico-d` / `superficie` | Gráfico, série D sobre o cartão | 3.0:1 | 6.04:1 ✓ | 6.27:1 ✓ |

#### Estilo `titanio`

| Par (texto / fundo) | Uso | Meta | Claro | Escuro |
|---|---|---|---|---|
| `texto` / `fundo` | Texto principal sobre o fundo | 4.5:1 | 13.12:1 ✓ | 13.64:1 ✓ |
| `texto` / `superficie` | Texto principal sobre cartões e campos | 4.5:1 | 15.25:1 ✓ | 10.75:1 ✓ |
| `texto` / `superficie-alt` | Texto principal sobre superfícies alternativas | 4.5:1 | 11.96:1 ✓ | 8.69:1 ✓ |
| `texto` / `selecionado` | Texto sobre o item selecionado | 4.5:1 | 12.85:1 ✓ | 10.74:1 ✓ |
| `suave` / `fundo` | Texto secundário sobre o fundo | 4.5:1 | 5.65:1 ✓ | 9.80:1 ✓ |
| `suave` / `superficie` | Texto secundário sobre cartões e campos | 4.5:1 | 6.57:1 ✓ | 7.72:1 ✓ |
| `suave` / `superficie-alt` | Texto secundário sobre superfícies alternativas | 4.5:1 | 5.15:1 ✓ | 6.24:1 ✓ |
| `suave` / `selecionado` | Texto secundário sobre o item selecionado | 4.5:1 | 5.53:1 ✓ | 7.71:1 ✓ |
| `acento` / `selecionado` | Links e ações sobre o item selecionado | 4.5:1 | 4.53:1 ✓ | 4.53:1 ✓ |
| `acento` / `fundo` | Links e ações sobre o fundo | 4.5:1 | 4.63:1 ✓ | 5.75:1 ✓ |
| `acento` / `superficie` | Links e ações sobre cartões | 4.5:1 | 5.38:1 ✓ | 4.53:1 ✓ |
| `acento-texto` / `acento-botao` | Texto do botão principal | 4.5:1 | 5.42:1 ✓ | 5.31:1 ✓ |
| `acento-botao` / `fundo` | Botão principal contra o fundo | 3.0:1 | 4.63:1 ✓ | 4.52:1 ✓ |
| `acento-botao` / `superficie` | Botão principal contra cartões | 3.0:1 | 5.38:1 ✓ | 3.56:1 ✓ |
| `tempo-ativo` / `fundo` | Tempo em evidência (texto) sobre o fundo | 4.5:1 | 5.08:1 ✓ | 6.29:1 ✓ |
| `tempo-ativo` / `superficie` | Tempo em evidência (texto) sobre cartões | 4.5:1 | 5.91:1 ✓ | 4.96:1 ✓ |
| `tempo-sobre` / `tempo-fundo` | Texto sobre o bloco de tempo em evidência | 4.5:1 | 5.95:1 ✓ | 5.31:1 ✓ |
| `tempo-fundo` / `tempo-trilha` | Preenchimento do tempo sobre a trilha | 3.0:1 | 3.55:1 ✓ | 3.83:1 ✓ |
| `perigo` / `fundo` | Erro e ação destrutiva (texto) sobre o fundo | 4.5:1 | 5.76:1 ✓ | 7.81:1 ✓ |
| `perigo` / `superficie` | Erro e ação destrutiva (texto) sobre cartões | 4.5:1 | 6.70:1 ✓ | 6.16:1 ✓ |
| `sucesso` / `fundo` | Sucesso (texto) sobre o fundo | 4.5:1 | 5.24:1 ✓ | 9.16:1 ✓ |
| `sucesso` / `superficie` | Sucesso (texto) sobre cartões | 4.5:1 | 6.08:1 ✓ | 7.22:1 ✓ |
| `aviso` / `fundo` | Aviso (texto) sobre o fundo | 4.5:1 | 5.41:1 ✓ | 10.80:1 ✓ |
| `aviso` / `superficie` | Aviso (texto) sobre cartões | 4.5:1 | 6.29:1 ✓ | 8.52:1 ✓ |
| `info` / `fundo` | Informação (texto) sobre o fundo | 4.5:1 | 6.04:1 ✓ | 9.58:1 ✓ |
| `info` / `superficie` | Informação (texto) sobre cartões | 4.5:1 | 7.02:1 ✓ | 7.55:1 ✓ |
| `borda-controle` / `fundo` | Limite de controles sobre o fundo | 3.0:1 | 3.64:1 ✓ | 6.17:1 ✓ |
| `borda-controle` / `superficie` | Limite de controles sobre cartões | 3.0:1 | 4.23:1 ✓ | 4.87:1 ✓ |
| `foco` / `fundo` | Anel de foco sobre o fundo | 3.0:1 | 4.63:1 ✓ | 5.75:1 ✓ |
| `foco` / `superficie` | Anel de foco sobre cartões | 3.0:1 | 5.38:1 ✓ | 4.53:1 ✓ |
| `grafico-a` / `superficie` | Gráfico, série A sobre o cartão | 3.0:1 | 5.91:1 ✓ | 4.96:1 ✓ |
| `grafico-b` / `superficie` | Gráfico, série B sobre o cartão | 3.0:1 | 7.11:1 ✓ | 7.56:1 ✓ |
| `grafico-c` / `superficie` | Gráfico, série C sobre o cartão | 3.0:1 | 6.08:1 ✓ | 7.22:1 ✓ |
| `grafico-d` / `superficie` | Gráfico, série D sobre o cartão | 3.0:1 | 6.00:1 ✓ | 5.69:1 ✓ |

#### Estilo `telemetria`

| Par (texto / fundo) | Uso | Meta | Claro | Escuro |
|---|---|---|---|---|
| `texto` / `fundo` | Texto principal sobre o fundo | 4.5:1 | 14.30:1 ✓ | 15.62:1 ✓ |
| `texto` / `superficie` | Texto principal sobre cartões e campos | 4.5:1 | 16.64:1 ✓ | 12.79:1 ✓ |
| `texto` / `superficie-alt` | Texto principal sobre superfícies alternativas | 4.5:1 | 13.23:1 ✓ | 10.66:1 ✓ |
| `texto` / `selecionado` | Texto sobre o item selecionado | 4.5:1 | 13.88:1 ✓ | 10.76:1 ✓ |
| `suave` / `fundo` | Texto secundário sobre o fundo | 4.5:1 | 6.24:1 ✓ | 11.39:1 ✓ |
| `suave` / `superficie` | Texto secundário sobre cartões e campos | 4.5:1 | 7.27:1 ✓ | 9.32:1 ✓ |
| `suave` / `superficie-alt` | Texto secundário sobre superfícies alternativas | 4.5:1 | 5.77:1 ✓ | 7.78:1 ✓ |
| `suave` / `selecionado` | Texto secundário sobre o item selecionado | 4.5:1 | 6.06:1 ✓ | 7.84:1 ✓ |
| `acento` / `selecionado` | Links e ações sobre o item selecionado | 4.5:1 | 4.52:1 ✓ | 4.55:1 ✓ |
| `acento` / `fundo` | Links e ações sobre o fundo | 4.5:1 | 4.66:1 ✓ | 6.61:1 ✓ |
| `acento` / `superficie` | Links e ações sobre cartões | 4.5:1 | 5.42:1 ✓ | 5.41:1 ✓ |
| `acento-texto` / `acento-botao` | Texto do botão principal | 4.5:1 | 5.42:1 ✓ | 5.19:1 ✓ |
| `acento-botao` / `fundo` | Botão principal contra o fundo | 3.0:1 | 4.66:1 ✓ | 5.19:1 ✓ |
| `acento-botao` / `superficie` | Botão principal contra cartões | 3.0:1 | 5.42:1 ✓ | 4.25:1 ✓ |
| `tempo-ativo` / `fundo` | Tempo em evidência (texto) sobre o fundo | 4.5:1 | 4.92:1 ✓ | 7.23:1 ✓ |
| `tempo-ativo` / `superficie` | Tempo em evidência (texto) sobre cartões | 4.5:1 | 5.73:1 ✓ | 5.92:1 ✓ |
| `tempo-sobre` / `tempo-fundo` | Texto sobre o bloco de tempo em evidência | 4.5:1 | 5.73:1 ✓ | 5.31:1 ✓ |
| `tempo-fundo` / `tempo-trilha` | Preenchimento do tempo sobre a trilha | 3.0:1 | 3.90:1 ✓ | 3.54:1 ✓ |
| `perigo` / `fundo` | Erro e ação destrutiva (texto) sobre o fundo | 4.5:1 | 5.61:1 ✓ | 8.97:1 ✓ |
| `perigo` / `superficie` | Erro e ação destrutiva (texto) sobre cartões | 4.5:1 | 6.54:1 ✓ | 7.34:1 ✓ |
| `sucesso` / `fundo` | Sucesso (texto) sobre o fundo | 4.5:1 | 5.41:1 ✓ | 10.95:1 ✓ |
| `sucesso` / `superficie` | Sucesso (texto) sobre cartões | 4.5:1 | 6.30:1 ✓ | 8.96:1 ✓ |
| `aviso` / `fundo` | Aviso (texto) sobre o fundo | 4.5:1 | 5.63:1 ✓ | 12.53:1 ✓ |
| `aviso` / `superficie` | Aviso (texto) sobre cartões | 4.5:1 | 6.56:1 ✓ | 10.26:1 ✓ |
| `info` / `fundo` | Informação (texto) sobre o fundo | 4.5:1 | 7.20:1 ✓ | 9.82:1 ✓ |
| `info` / `superficie` | Informação (texto) sobre cartões | 4.5:1 | 8.38:1 ✓ | 8.03:1 ✓ |
| `borda-controle` / `fundo` | Limite de controles sobre o fundo | 3.0:1 | 3.56:1 ✓ | 6.38:1 ✓ |
| `borda-controle` / `superficie` | Limite de controles sobre cartões | 3.0:1 | 4.15:1 ✓ | 5.22:1 ✓ |
| `foco` / `fundo` | Anel de foco sobre o fundo | 3.0:1 | 4.66:1 ✓ | 6.61:1 ✓ |
| `foco` / `superficie` | Anel de foco sobre cartões | 3.0:1 | 5.42:1 ✓ | 5.41:1 ✓ |
| `grafico-a` / `superficie` | Gráfico, série A sobre o cartão | 3.0:1 | 5.73:1 ✓ | 5.92:1 ✓ |
| `grafico-b` / `superficie` | Gráfico, série B sobre o cartão | 3.0:1 | 10.35:1 ✓ | 8.03:1 ✓ |
| `grafico-c` / `superficie` | Gráfico, série C sobre o cartão | 3.0:1 | 6.30:1 ✓ | 8.96:1 ✓ |
| `grafico-d` / `superficie` | Gráfico, série D sobre o cartão | 3.0:1 | 6.52:1 ✓ | 7.54:1 ✓ |

#### Modo `alto-contraste` (metas AAA)

| Par (texto / fundo) | Uso | Meta | Contraste |
|---|---|---|---|
| `texto` / `fundo` | Texto principal sobre o fundo | 7.0:1 | 19.56:1 ✓ |
| `texto` / `superficie` | Texto principal sobre cartões e campos | 7.0:1 | 19.56:1 ✓ |
| `texto` / `superficie-alt` | Texto principal sobre superfícies alternativas | 7.0:1 | 19.56:1 ✓ |
| `texto` / `selecionado` | Texto sobre o item selecionado | 7.0:1 | 12.11:1 ✓ |
| `suave` / `fundo` | Texto secundário sobre o fundo | 7.0:1 | 19.56:1 ✓ |
| `suave` / `superficie` | Texto secundário sobre cartões e campos | 7.0:1 | 19.56:1 ✓ |
| `suave` / `superficie-alt` | Texto secundário sobre superfícies alternativas | 7.0:1 | 19.56:1 ✓ |
| `suave` / `selecionado` | Texto secundário sobre o item selecionado | 7.0:1 | 12.11:1 ✓ |
| `acento` / `selecionado` | Links e ações sobre o item selecionado | 7.0:1 | 12.11:1 ✓ |
| `acento` / `fundo` | Links e ações sobre o fundo | 7.0:1 | 19.56:1 ✓ |
| `acento` / `superficie` | Links e ações sobre cartões | 7.0:1 | 19.56:1 ✓ |
| `acento-texto` / `acento-botao` | Texto do botão principal | 7.0:1 | 19.56:1 ✓ |
| `acento-botao` / `fundo` | Botão principal contra o fundo | 4.5:1 | 19.56:1 ✓ |
| `acento-botao` / `superficie` | Botão principal contra cartões | 4.5:1 | 19.56:1 ✓ |
| `tempo-ativo` / `fundo` | Tempo em evidência (texto) sobre o fundo | 7.0:1 | 19.56:1 ✓ |
| `tempo-ativo` / `superficie` | Tempo em evidência (texto) sobre cartões | 7.0:1 | 19.56:1 ✓ |
| `tempo-sobre` / `tempo-fundo` | Texto sobre o bloco de tempo em evidência | 7.0:1 | 19.56:1 ✓ |
| `tempo-fundo` / `tempo-trilha` | Preenchimento do tempo sobre a trilha | 4.5:1 | 5.64:1 ✓ |
| `perigo` / `fundo` | Erro e ação destrutiva (texto) sobre o fundo | 7.0:1 | 8.16:1 ✓ |
| `perigo` / `superficie` | Erro e ação destrutiva (texto) sobre cartões | 7.0:1 | 8.16:1 ✓ |
| `sucesso` / `fundo` | Sucesso (texto) sobre o fundo | 7.0:1 | 16.06:1 ✓ |
| `sucesso` / `superficie` | Sucesso (texto) sobre cartões | 7.0:1 | 16.06:1 ✓ |
| `aviso` / `fundo` | Aviso (texto) sobre o fundo | 7.0:1 | 19.56:1 ✓ |
| `aviso` / `superficie` | Aviso (texto) sobre cartões | 7.0:1 | 19.56:1 ✓ |
| `info` / `fundo` | Informação (texto) sobre o fundo | 7.0:1 | 19.56:1 ✓ |
| `info` / `superficie` | Informação (texto) sobre cartões | 7.0:1 | 19.56:1 ✓ |
| `borda-controle` / `fundo` | Limite de controles sobre o fundo | 4.5:1 | 19.56:1 ✓ |
| `borda-controle` / `superficie` | Limite de controles sobre cartões | 4.5:1 | 19.56:1 ✓ |
| `foco` / `fundo` | Anel de foco sobre o fundo | 4.5:1 | 21.00:1 ✓ |
| `foco` / `superficie` | Anel de foco sobre cartões | 4.5:1 | 21.00:1 ✓ |
| `grafico-a` / `superficie` | Gráfico, série A sobre o cartão | 4.5:1 | 19.56:1 ✓ |
| `grafico-b` / `superficie` | Gráfico, série B sobre o cartão | 4.5:1 | 17.31:1 ✓ |
| `grafico-c` / `superficie` | Gráfico, série C sobre o cartão | 4.5:1 | 16.06:1 ✓ |
| `grafico-d` / `superficie` | Gráfico, série D sobre o cartão | 4.5:1 | 11.25:1 ✓ |

## Onde cada token é usado

| Região / estado | Tokens |
|---|---|
| Telas, histórico, ajustes | `--fundo`, `--texto`, `--suave` |
| Cartões, campos, diálogos | `--superficie`, `--borda-controle`, `--texto` |
| Botões, navegação, links, aba selecionada | `--acento` + `--acento-texto` |
| Cronômetro em repouso / resultado | `--texto`, `--suave` |
| Cronômetro escutando | `--tempo-ativo` |
| Salvo, erro, aviso, informação | `--sucesso`, `--perigo`, `--aviso`, `--info` (com ícone e texto) |
| Gráficos | `--grafico-a..d` (com marcador e traço diferentes) |

## Como rodar e o que falta

`python3 tools/contraste.py` (falha se algum par reprovar) e `npx vitest run tests/estilos.test.ts`. O e2e (`NK_FOTO=pasta npm run test:e2e`) gera os prints de cada paleta na tela de resultado. **Não testado ainda:** troca do tema do sistema com o app aberto no Android, e o contraste real de cada componente nas seis paletas por pessoas.


> **Nota (2026-11-22):** o acento segue o playbook v1.1 (Vermelho Óptico). Conferido token por token contra as tabelas do playbook (216 valores nas 6 paletas, 0 diferenças) e por `tools/contraste.py` (todos os pares passam, inclusive `--acento-botao`). Os gráficos mantêm `--grafico-b` azul, como o playbook permite.
