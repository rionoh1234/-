package com.rionoh.kakaobanklogger

import android.app.Application
import com.rionoh.kakaobanklogger.forward.ForwardScheduler
import com.rionoh.kakaobanklogger.settings.SettingsStore

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        // 최초 실행 시 웹훅 비밀키를 자동 생성해 둔다.
        SettingsStore(this).ensureSecret()
        // 놓친 전송을 보정하기 위한 주기 작업(15분) 등록
        ForwardScheduler.ensurePeriodic(this)
    }
}
