# NATS BY NATAN — aturan ProGuard/R8 (minify dimatikan secara default)
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keepattributes *Annotation*, JavascriptInterface
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
