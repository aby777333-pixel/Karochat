/* Karochat — Capacitor configuration.
 *
 * Strategy: native shell loads the production web app inside a WebView.
 * This preserves 100% of the existing Next.js app's logic, server
 * components, API routes, Supabase auth, LiveKit calls, and feature
 * surfaces (rooms, books, sex-ed, students, etc.) — no client port,
 * no API duplication.
 *
 * Where to change things:
 *   • App identity (package name, display name) — appId + appName below.
 *   • Which URL the shell loads — server.url. We default to production
 *     Netlify. For local dev against `next dev`, override at runtime via
 *     CAP_SERVER_URL (see docs/ENV.md).
 *   • Splash + status-bar styling — plugins.SplashScreen / StatusBar.
 *   • Permissions — android/app/src/main/AndroidManifest.xml +
 *     ios/App/App/Info.plist after `npx cap add`.
 */

import type { CapacitorConfig } from "@capacitor/cli";

const DEFAULT_SERVER_URL =
  process.env.CAP_SERVER_URL ?? "https://magical-heliotrope-e4d7df.netlify.app";

const config: CapacitorConfig = {
  appId: "com.karochat.app",
  appName: "Karochat",

  // The native projects (android/, ios/) point at this static asset
  // directory for the offline fallback shell (`www/index.html`). Once
  // the device has network, the shell redirects to the production URL.
  webDir: "www",

  // Allows mixed content for dev only. Production uses HTTPS everywhere.
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#0b0c0fff"
  },

  ios: {
    contentInset: "always",
    backgroundColor: "#0b0c0fff",
    limitsNavigationsToAppBoundDomains: false
  },

  // Remote server config — the WebView loads this URL directly. The
  // local `www/` directory is only used as a fallback when offline.
  server: {
    url: DEFAULT_SERVER_URL,
    cleartext: false,
    // Allow navigation to these external auth/OAuth domains without the
    // WebView treating them as outbound links. Add domains as needed.
    allowNavigation: [
      "magical-heliotrope-e4d7df.netlify.app",
      "*.netlify.app",
      "*.supabase.co",
      "*.supabase.in",
      "*.livekit.cloud",
      "openrouter.ai",
      "api.openai.com"
    ]
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: "#0b0c0f",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false
    },
    StatusBar: {
      // Dark theme matches Karochat brand. Both platforms default to
      // light icons on dark bg so the chrome blends with the app.
      style: "DARK",
      backgroundColor: "#0b0c0f",
      overlaysWebView: false
    },
    Keyboard: {
      resize: "body",
      style: "DARK",
      resizeOnFullScreen: true
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
