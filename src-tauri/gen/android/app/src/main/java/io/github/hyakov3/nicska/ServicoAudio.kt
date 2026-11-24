package io.github.hyakov3.nicska

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

/**
 * Serviço em primeiro plano que mantém o app vivo enquanto o timer está **armado** (do toque em "Standby" até o fim da escuta): a WebView segue
 * com o microfone aberto e o apito agendado mesmo com a tela bloqueada. Tipos: `microphone` (a escuta) e `mediaPlayback` (o apito). Quem o liga
 * e desliga é o JavaScript, pela ponte `NkServico` (ver `PonteServico.kt`). O wake lock não tem limite enquanto armado e é solto ao parar.
 * A notificação "Nicska · Parar" avisa o JavaScript (`aoParar`).
 */
class ServicoAudio : Service() {
    companion object {
        const val CANAL = "timer"
        const val ID_NOTIFICACAO = 1
        const val ACAO_PARAR = "io.github.hyakov3.nicska.PARAR"

        /** Avisa o JavaScript que a pessoa tocou em "Parar" na notificação (definido pela ponte; nulo com o app fechado). */
        @Volatile
        var aoParar: (() -> Unit)? = null

        /** O Android recusou subir o serviço: avisa o JavaScript, que deixa de contar com a proteção e avisa na tela (definido pela ponte). */
        @Volatile
        var aoFalhar: (() -> Unit)? = null

        /**
         * `startForegroundService` obriga o serviço a chamar `startForeground` em poucos segundos; se a parada chegasse antes, o serviço seria
         * destruído sem tê-lo chamado e o Android derrubaria o app. Enquanto ele não chegou lá (`aguardandoPrimeiroPlano`), a ponte só marca
         * `paradaPendente` e o serviço se encerra sozinho DEPOIS de chamar `startForeground`. Tudo na thread principal: não precisa de trava.
         */
        var aguardandoPrimeiroPlano = false
        var paradaPendente = false

        /** O timer está armado. */
        var armado = false

        /** O serviço existe (criado e ainda não destruído). */
        var ativo = false
    }

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACAO_PARAR) {
            aoParar?.invoke()
            armado = false
            encerrar()
            return START_NOT_STICKY
        }
        ativo = true
        try {
            criarCanal()
            val notificacao = montarNotificacao()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    ID_NOTIFICACAO,
                    notificacao,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
                )
            } else {
                startForeground(ID_NOTIFICACAO, notificacao)
            }
        } catch (e: Exception) {
            // O Android recusou (ForegroundServiceStartNotAllowedException no 12+, SecurityException sem a permissão do tipo, restrição do
            // fabricante): o app segue sem a proteção e o JavaScript avisa na tela.
            android.util.Log.w("nk", "startForeground recusado; o timer segue sem o serviço", e)
            aguardandoPrimeiroPlano = false
            paradaPendente = false
            val estava = armado
            armado = false
            if (estava) aoFalhar?.invoke()
            stopSelf()
            return START_NOT_STICKY
        }
        aguardandoPrimeiroPlano = false
        if (paradaPendente) {
            paradaPendente = false
            encerrar()
            return START_NOT_STICKY
        }
        segurarCpu()
        // Se o sistema matar o processo, a tentativa já se perdeu: não faz sentido ressuscitar o serviço.
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        ativo = false
        armado = false
        soltarCpu()
        super.onDestroy()
    }

    private fun encerrar() {
        soltarCpu()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    /** Sem limite de tempo: o timer fica armado até a pessoa parar, e o wake lock é solto ao parar o serviço. */
    private fun segurarCpu() {
        soltarCpu()
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nk:armado").apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun soltarCpu() {
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
    }

    private fun criarCanal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val gerente = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (gerente.getNotificationChannel(CANAL) != null) return
        // IMPORTANCE_LOW: aparece na barra sem som nem vibração.
        val canal = NotificationChannel(CANAL, getString(R.string.canal_timer), NotificationManager.IMPORTANCE_LOW)
        canal.setShowBadge(false)
        gerente.createNotificationChannel(canal)
    }

    private fun montarNotificacao(): Notification {
        val abrir = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val parar = PendingIntent.getService(
            this,
            1,
            Intent(this, ServicoAudio::class.java).setAction(ACAO_PARAR),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val construtor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CANAL) else @Suppress("DEPRECATION") Notification.Builder(this)
        return construtor
            .setSmallIcon(R.drawable.ic_notificacao)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.notificacao_armado))
            .setContentIntent(abrir)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(Notification.Action.Builder(null, getString(R.string.notificacao_parar), parar).build())
            .build()
    }
}
