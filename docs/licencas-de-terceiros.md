# Licenças de terceiros

O código deste projeto é MIT (`LICENSE`). Alguns materiais de terceiros acompanham o app; cada um mantém a sua licença.
O app não leva conteúdo de terceiros além destes.

## Ícones: Google Material Icons (conjunto `ic`) e Material Symbols

- **Onde:** `src/lib/icones.json`, gerado por `tools/gerar-icones.mjs` a partir do Iconify. O gerador só aceita esses dois conjuntos.
- **Autoria:** Material Design Authors (Google).
- **Licença:** [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). Os desenhos não foram alterados.

## Bibliotecas

- **Svelte e SvelteKit** (MIT): © Svelte Contributors.
- **Tauri** (MIT ou Apache 2.0): © Tauri Apps Contributors.
- **mp4-muxer** 5.2.2 (MIT): © 2023 Vanilagy. <https://github.com/Vanilagy/mp4-muxer>. Monta o MP4 (H.264 + AAC) do vídeo enviado com os tempos (V3, `src/lib/video/motorWebCodecs.ts`); só é carregado ao exportar. Licença conferida no `LICENSE` do pacote (2026-11-23). O pacote está marcado como "superseded by Mediabunny" (sem versões novas), mas faz o que a V3 precisa.
  - **Por que não o Mediabunny** (o sucessor, que também faria a leitura do WebM e a conversão inteira): a licença dele é **MPL-2.0** em todas as versões publicadas (conferido no npm em 2026-11-23), não MIT. A MPL-2.0 permite usar num app MIT sem mudar os arquivos dela, mas obriga a dizer onde está o código-fonte desses arquivos; fica como decisão do responsável. Trocar é mudar só o motor A.

Em Ajustes, "Créditos e licenças" mostra o texto de cada licença (`src/lib/licencas.ts`).

## Origem do código

A base (tema, idiomas, testes, CI, microfone, serviço Android e compartilhamento) vem do
[biblioteca-musical](https://github.com/HyakoV3/biblioteca-musical) (commit `e4ac474`), do mesmo autor, MIT.


## Voz do aviso do Standby (`src/lib/audio/voz-standby.ogg`) — conferida em parte (2026-11-22)

- **O que é:** a fala "Standing by" (0,7 s) tocada ao começar o Standby (I-03). Gerada pelo responsável com a voz **"Spruce" do modo de voz do ChatGPT (OpenAI)**, gravada da tela, recortada com `tools/recortar-voz.py` (mono 48 kHz, pico em −1 dBFS, sem efeitos) e guardada em Opus (~3 KB).
- **O que os termos da OpenAI dizem (busca de 2026-11-22):** nos Termos de Uso, "você é dono do Output" (na medida que a lei permitir) e a OpenAI "cede" a você os direitos que tiver sobre ele. Ressalvas: a cessão não vale para o Output de outros usuários nem para "Third Party Output", e outros usuários podem receber saídas parecidas. Fontes: <https://openai.com/policies/terms-of-use/> e <https://openai.com/policies/row-terms-of-use/> (as versões diferem por região e há revisões; conferir a vigente da conta do responsável).
- **Não achei nada específico sobre as vozes "Spruce"/"Ember"** (limite de uso comercial ou de redistribuição) e **não conferi as Políticas de Uso**: o áudio veio do app de voz (gravação de tela), não da API de voz (que tem regras próprias, como avisar que a voz é de IA). Uma voz sintética também não é uma pessoa real, mas vale reler as políticas.
- **Pendente antes de publicar em loja/GitHub:** o responsável (ou eu, com a conta dele) ler a página vigente dos Termos e das Políticas de Uso e confirmar que redistribuir o áudio dentro de um app MIT é permitido. Se houver dúvida, trocar por voz de licença livre (ver a pesquisa em `docs/roadmap-ideas.md`) ou gerar pela API de voz da OpenAI, cujos termos de uso comercial são explícitos. Se pedir crédito, acrescentar a entrada em `src/lib/licencas.ts` (Ajustes → Créditos).
- **Enquanto isso:** o repositório é local (sem remoto até o MVP) e o APK é de teste.
- **Um arquivo só** serve aos três idiomas: "Standby" é o comando do esporte em qualquer língua.
