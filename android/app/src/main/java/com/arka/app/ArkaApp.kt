package com.arka.app

import android.app.Application

class ArkaApp : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: ArkaApp
            private set
    }
}