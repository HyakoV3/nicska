# Política de privacidade do Nicska

*Última atualização: 2026-11-24. / English summary at the end.*

O Nicska é um aplicativo gratuito e de código aberto (MIT) de cronômetro de tiro esportivo (shot timer). Esta política diz o que ele faz com os seus dados: **quase nada sai do seu aparelho**.

## O que o app guarda, e onde
- **Tentativas, percursos, histórico, pontuação e preferências:** só no armazenamento do aparelho (IndexedDB e `localStorage` do app).
- **Áudio das tentativas** (gravado enquanto o cronômetro escuta, para detectar o apito e os disparos) e, se você ativar o modo "Áudio + vídeo", **vídeo da tentativa**: só no aparelho, fora do backup do Android e do arquivo JSON de backup. Você pode apagá-los a qualquer momento, e a retenção por espaço e prazo (Ajustes → Retenção) apaga os antigos.
- **Apelido e avatar do atirador** (opcionais): só no aparelho.

## O que o app NÃO faz
- Não tem conta, login, anúncios, rastreadores nem análise de uso.
- **Não acessa a internet**: o aplicativo não declara a permissão `INTERNET`. Nada é enviado a servidores do Nicska (não existem).
- Não lê contatos, localização nem arquivos fora dos que você escolher abrir.

## Permissões
- **Microfone** (`RECORD_AUDIO`): ouvir o apito e os disparos durante a tentativa; o serviço em primeiro plano mantém a escuta com a tela bloqueada e mostra uma notificação enquanto isso.
- **Câmera** (`CAMERA`): só no modo "Áudio + vídeo", quando você toca em Standby.
- **Vibração** (`VIBRATE`) e **sensor de movimento** (sem permissão): avisos por vibração e o recurso opcional de iniciar batendo no celular.

## Quando algo sai do aparelho
Somente quando **você** toca em compartilhar/exportar (áudio, vídeo, JSON de backup ou legenda) e escolhe o aplicativo de destino na folha do sistema; a partir daí valem as regras desse aplicativo. O botão **Doar com PayPal** abre a página de doação no navegador do sistema; o Nicska não recebe nem guarda nada sobre a doação.

## Atenção ao filmar e gravar
Ao gravar áudio ou vídeo no estande, outras pessoas podem aparecer ou ser ouvidas. Avise quem estiver por perto e respeite as regras do clube e a legislação local sobre imagem e voz.

## Crianças
O app não coleta dados de ninguém. O tema (tiro esportivo) é voltado a adultos.

## Contato e mudanças
Dúvidas ou pedidos: abra uma *issue* em <https://github.com/HyakoV3/nicska/issues> (sem dados pessoais) ou use o relato privado de segurança do repositório. Mudanças nesta política aparecem neste arquivo, com a data no topo.

---
**English summary:** Nicska is a free, open-source (MIT) IPSC shot timer. It has no accounts, ads or analytics and does not request the INTERNET permission. Attempts, audio and optional video stay on your device; they leave only when you share or export them. Microphone is used to detect the start beep and shots, camera only in the optional video mode.
