// 최상위 빌드 스크립트. 실제 설정은 app/build.gradle.kts 에 있습니다.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
}
