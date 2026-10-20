package com.rionoh.kakaobanklogger.ui

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue

enum class Screen { HOME, SETTINGS }

@Composable
fun AppRoot() {
    var screen by rememberSaveable { mutableStateOf(Screen.HOME) }

    BackHandler(enabled = screen != Screen.HOME) { screen = Screen.HOME }

    when (screen) {
        Screen.HOME -> HomeScreen(onOpenSettings = { screen = Screen.SETTINGS })
        Screen.SETTINGS -> SettingsScreen(onBack = { screen = Screen.HOME })
    }
}
