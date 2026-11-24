package io.github.hyakov3.nicska

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private var ponte: PonteServico? = null
  private var compartilhar: PonteCompartilhar? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // Aberto por um arquivo (Abrir com / Compartilhar): o conteúdo espera aqui até a tela buscar.
    pendente = intent
  }

  private var pendente: android.content.Intent? = null

  // O app já aberto (launchMode singleTask) recebe o novo arquivo aqui; a tela volta ao primeiro plano e busca.
  override fun onNewIntent(intent: android.content.Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    compartilhar?.receber(intent)
  }

  // A ponte do serviço do timer: `window.NkServico`, usada pelo JavaScript para ligar e desligar o serviço em primeiro plano.
  override fun onWebViewCreate(webView: WebView) {
    val nova = PonteServico(this, webView)
    ponte = nova
    webView.addJavascriptInterface(nova, "NkServico")
    // A ponte de compartilhar um arquivo (áudio ou JSON): `window.NkCompartilhar`, abre a folha de compartilhamento do sistema.
    val outra = PonteCompartilhar(this)
    compartilhar = outra
    webView.addJavascriptInterface(outra, "NkCompartilhar")
    // A ponte do tema: `window.NkTema`, põe os ícones das barras do sistema em sintonia com o tema do app (claro ou escuro).
    webView.addJavascriptInterface(PonteTema(this), "NkTema")
    // A ponte da orientação: `window.NkOrientacao`, trava o giro da tela enquanto o vídeo da tentativa grava (C8) e o solta no fim.
    webView.addJavascriptInterface(PonteOrientacao(this), "NkOrientacao")
    // A ponte da tela: `window.NkTela`, esconde as barras do sistema (modo imersivo) enquanto a câmera ocupa a tela inteira no modo vídeo (V2b).
    webView.addJavascriptInterface(PonteTela(this), "NkTela")
    outra.receber(pendente)
    pendente = null
  }

  override fun onDestroy() {
    ponte?.soltar()
    ponte = null
    compartilhar?.soltar()
    compartilhar = null
    // Fechar o app de vez (não uma recriação por rotação) leva a WebView, e com ela o som: o serviço e a notificação não ficam sobrando.
    if (isFinishing) stopService(android.content.Intent(this, ServicoAudio::class.java))
    super.onDestroy()
  }
}
