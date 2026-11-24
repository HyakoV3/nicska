package io.github.hyakov3.nicska

import android.webkit.JavascriptInterface
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * Ponte da tela, exposta à WebView como `window.NkTela`. Gravando no modo vídeo (V2b), a câmera ocupa a tela inteira: `imersivo(true)` esconde a barra de
 * status e a de navegação (um gesto da borda as mostra por um instante e elas somem de novo) e `imersivo(false)` as devolve. O JavaScript sempre solta ao
 * sair da tela cheia, num erro ou ao esconder o app. Só recebe um booleano (nada de texto do JavaScript). Chega numa thread da WebView; o ajuste vai para
 * a principal. Usa o mesmo `WindowCompat` da PonteTema (androidx.core, que já vem com o appcompat).
 */
class PonteTela(private val atividade: MainActivity) {
    @JavascriptInterface
    fun imersivo(ligado: Boolean) {
        atividade.runOnUiThread {
            val janela = atividade.window
            val controle = WindowCompat.getInsetsController(janela, janela.decorView)
            if (ligado) {
                controle.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                controle.hide(WindowInsetsCompat.Type.systemBars())
            } else {
                controle.show(WindowInsetsCompat.Type.systemBars())
            }
        }
    }
}
