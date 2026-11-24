package io.github.hyakov3.nicska

import android.graphics.Color
import android.os.Build
import android.webkit.JavascriptInterface
import androidx.core.view.WindowCompat

/**
 * Ponte do tema, exposta à WebView como `window.NkTema`. O app tem o seu próprio tema (claro, escuro, estilos, alto contraste), que pode diferir do do
 * sistema. Sem isto: (1) a hora e a bateria da barra de status ficariam escuras sobre fundo escuro; (2) a barra de navegação de baixo (início e voltar,
 * nos aparelhos com botões) ficaria na cor do sistema (em geral branca) por baixo da barra de abas do app. O JavaScript mede o fundo real e chama
 * `barras(escuro, fundo)`: `escuro` liga os ícones claros, `fundo` ("#rrggbb") pinta a barra de navegação com a cor do app (a de status é transparente: o
 * app desenha por baixo dela). Chega numa thread da WebView; o ajuste vai para a principal.
 */
class PonteTema(private val atividade: MainActivity) {
    @JavascriptInterface
    fun barras(escuro: Boolean, fundo: String) {
        atividade.runOnUiThread {
            val janela = atividade.window
            val controle = WindowCompat.getInsetsController(janela, janela.decorView)
            controle.isAppearanceLightStatusBars = !escuro
            controle.isAppearanceLightNavigationBars = !escuro
            val cor = try { Color.parseColor(fundo) } catch (e: IllegalArgumentException) { null }
            if (cor != null) {
                // Dois botões ou três botões: a barra tem cor própria; sem isto o Android põe um véu branco ou preto sobre ela (contraste forçado).
                janela.navigationBarColor = cor
                if (Build.VERSION.SDK_INT >= 29) janela.isNavigationBarContrastEnforced = false
            }
        }
    }
}
