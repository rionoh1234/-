package com.rionoh.kakaobanklogger.forward

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object ForwardScheduler {
    const val UNIQUE_NOW = "forward-now"
    const val UNIQUE_PERIODIC = "forward-periodic"

    private val network = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    /** 새 알림이 저장되면 즉시 전송 작업을 큐에 넣는다. */
    fun enqueueNow(context: Context) {
        val request = OneTimeWorkRequestBuilder<ForwardWorker>()
            .setConstraints(network)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork(UNIQUE_NOW, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }

    /** 15분마다 미전송분을 다시 시도한다(네트워크 단절 등 보정). */
    fun ensurePeriodic(context: Context) {
        val request = PeriodicWorkRequestBuilder<ForwardWorker>(15, TimeUnit.MINUTES)
            .setConstraints(network)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(UNIQUE_PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request)
    }
}
