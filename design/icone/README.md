# Ícone do app

O ícone atual é a **fase 2** do cronômetro: contorno preto, aro e ponteiros brancos, base cinza e fatia/marcas vermelhas (fundo transparente).
As quatro fases entregues (fase 1 em traço, 2 em cores, 3 e 4 com mais acabamento) ficam em `icone-fonte/` (`nicska-faseN.svg/.png`); a 2 é a usada.

## Arquivos

- `nicska-simbolo.png`: cópia de `icone-fonte/nicska-fase2.png` (RGBA, 1254 px), a **entrada** de `tools/gerar-icone-do-app-png.py`.
- `app-1024.png`: o símbolo (86% do lado) sobre o fundo `#14181F`, em RGB; é o que o `tauri icon` recebe quando o gerador roda inteiro.
- `icone.svg`: **legado**, o ícone provisório da Etapa 0 (letra Ч num anel). Não é mais o ícone do app; fica só porque `tools/gerar-icone-do-app.py` e
  seu teste (`tools/test_gerar_icone_do_app.py`) o usam como exemplo da convenção de SVG (moldura, placa, símbolo).
- O ícone temático do Android 13 (`ic_launcher_monochrome.png`) não tem arquivo aqui: sai do `nicska-simbolo.png` na hora (`silhueta_mono`: branco onde há
  desenho claro ou vermelho, transparente onde era preto), dentro da zona segura de 66 dp.

## Como regenerar

```bash
python3 tools/gerar-icone-do-app-png.py                     # tudo: favicon, src-tauri/icons/**, mipmaps (precisa do Pillow e do `tauri` do projeto)
python3 tools/gerar-icone-do-app-png.py --so-monocromatico  # só o ícone temático e o XML adaptativo
python3 tools/test_gerar_icone_do_app_png.py                # testes da silhueta
```
