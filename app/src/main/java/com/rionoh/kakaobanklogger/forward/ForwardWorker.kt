package com.rionoh.kakaobanklogger.forward

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.rionoh.kakaobanklogger.data.AppDatabase
import com.rionoh.kakaobanklogger.settings.SettingsStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * 미전송 레코드를 오래된 순으로 웹훅에 보낸다.
 * 실패한 레코드가 있으면 중단하고 WorkManager 백오프로 재시도한다.
 */
class ForwardWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val settings = SettingsStore(applicationContext)
        if (!settings.forwardEnabled) return@withContext Result.success()
        if (!settings.isWebhookConfigured()) {
            Log.w(TAG, "forwarding enabled but webhook not configured")
            return@withContext Result.success()
        }

        val dao = AppDatabase.get(applicationContext).notificationDao()
        val client = WebhookClient(settings.webhookUrl, settings.webhookSecret)
        var sent = 0

        while (true) {
            val batch = dao.pendingForward(limit = BATCH, maxAttempts = MAX_ATTEMPTS)
            if (batch.isEmpty()) break

            for (record in batch) {
                val result = client.send(Payload.fromRecord(record, settings.webhookSecret))
                if (result.isSuccess) {
                    dao.markForwarded(record.id, System.currentTimeMillis())
                    sent++
                } else {
                    val msg = result.exceptionOrNull()?.message ?: "unknown error"
                    Log.w(TAG, "forward failed id=${record.id}: $msg")
                    dao.markFailed(record.id, msg.take(300))
                    return@withContext if (runAttemptCount < 5) Result.retry() else Result.failure()
                }
            }
        }
        if (sent > 0) Log.i(TAG, "forwarded $sent record(s)")
        Result.success()
    }

    companion object {
        private const val TAG = "ForwardWorker"
        private const val BATCH = 25
        /** 이 횟수 이상 실패한 레코드는 자동 재시도에서 제외(화면에서 수동 재전송) */
        const val MAX_ATTEMPTS = 20
    }
}
