# Fixtures de áudio real

Os `.wav` ficam **fora do Git** (têm voz de pessoas e ~3 MB cada). Quando houver recortes curtos, sem voz e com gabarito (Etapa 1), eles entram aqui.

- `treino-9mm.wav`: vídeo de WhatsApp de 2026-11-21 às 20.08.56 (9 mm).
- `treino-22.wav`: vídeo de WhatsApp de 2026-11-21 às 20.09.06 (.22).

Como gerar a partir dos vídeos (mono, 48 kHz, PCM 16 bits):

```bash
ffmpeg -i "WhatsApp Video 2026-11-21 at 20.08.56.mp4" -vn -ac 1 -ar 48000 -c:a pcm_s16le tests/fixtures/treino-9mm.wav
ffmpeg -i "WhatsApp Video 2026-11-21 at 20.09.06.mp4" -vn -ac 1 -ar 48000 -c:a pcm_s16le tests/fixtures/treino-22.wav
```

Sem os arquivos, `tests/detector-real.test.ts` é pulado.
