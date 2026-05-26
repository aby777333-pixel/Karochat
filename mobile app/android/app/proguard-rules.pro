# Karochat — Android Proguard / R8 rules.
#
# Capacitor's plugin discovery uses reflection over annotated classes,
# so we keep the relevant package whole. WebView JavaScript bridges in
# Capacitor are also reflection-based and must be preserved.

# Capacitor core + plugins
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public *;
}

# Firebase / Google Play services (used by FCM push notifications). Safe
# to keep even when google-services.json hasn't been added — these
# entries are silently ignored if the symbols aren't present.
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Karochat first-party (none today — kept for future native bridges).
-keep class com.karochat.** { *; }

# Standard Android WebView reflection
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve line numbers in stack traces — useful for Play Console crash
# reports. We rename source file so it doesn't leak internal paths.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
