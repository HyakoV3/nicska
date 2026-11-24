package io.github.hyakov3.nicska

import android.content.pm.ActivityInfo
import android.webkit.JavascriptInterface

/**
 * Ponte da orientação, exposta à WebView como `window.NkOrientacao`. Gravando vídeo (C8), girar o celular no meio recriaria a imagem da câmera e deixaria o
 * vídeo metade deitado, metade de pé: `travar()` prende a tela na orientação em que ela está agora e `soltar()` devolve o giro ao sistema. Não recebe nada do
 * JavaScript (só liga e desliga). Chega numa thread da WebView; o ajuste vai para a principal.
 */
class PonteOrientacao(private val atividade: MainActivity) {
    @JavascriptInterface
    fun travar() {
        atividade.runOnUiThread { atividade.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LOCKED }
    }

    @JavascriptInterface
    fun soltar() {
        atividade.runOnUiThread { atividade.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED }
    }
}
