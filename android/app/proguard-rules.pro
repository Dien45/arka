# Keep kotlinx-serialization generated code
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keep,includedescriptorclasses class com.arka.app.**$$serializer { *; }
-keepclassmembers class com.arka.app.** {
    *** Companion;
}
-keepclasseswithmembers class com.arka.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}