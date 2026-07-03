plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.oneapp.one"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.oneapp.one"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.2.0"
        // 云端 worker 地址(安卓的手连这里;改域名只动这一行)
        buildConfigField("String", "WORKER_URL", "\"\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // 对齐所有 kotlin-stdlib*（含 okhttp 拖进的旧 jdk8 stdlib），消除 duplicate classes
    implementation(platform("org.jetbrains.kotlin:kotlin-bom:1.9.24"))
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    // 保活:周期检查设备通道,掉线则拉起 DeviceService
    implementation("androidx.work:work-runtime-ktx:2.9.1")
}
