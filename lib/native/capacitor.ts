// Karochat — native (Capacitor) runtime detection + push registration.
//
// This file is safe to import from the web app: at runtime in a normal
// browser, `window.Capacitor` is undefined and every helper here is a
// no-op. When running inside the Capacitor Android / iOS shell, the
// Capacitor JS bridges are injected by the native runtime and the
// PushNotifications plugin handles permission + token registration.
//
// The token is POSTed to /api/push/register so the server can send a
// notification to this device later (DM, room mention, friend request,
// Karo Q&A reply).

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => "ios" | "android" | "web";
      Plugins?: {
        PushNotifications?: any;
        App?: any;
        StatusBar?: any;
        SplashScreen?: any;
      };
    };
  }
}

export function isNative(): boolean {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

export function nativePlatform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  return window.Capacitor?.getPlatform?.() ?? "web";
}

/**
 * One-shot: ask the OS for permission, register the device with FCM /
 * APNs, and POST the resulting token to /api/push/register. Safe to
 * call repeatedly — registration is idempotent on the server side.
 *
 * Returns the token, null if permission denied / unavailable, or
 * undefined if not running in a native shell.
 */
export async function registerPushNotifications(): Promise<string | null | undefined> {
  if (!isNative()) return undefined;
  const Push = window.Capacitor?.Plugins?.PushNotifications;
  if (!Push) return null;

  try {
    const perm = await Push.checkPermissions();
    let status = perm.receive;
    if (status === "prompt" || status === "prompt-with-rationale") {
      const req = await Push.requestPermissions();
      status = req.receive;
    }
    if (status !== "granted") return null;

    await Push.register();

    return await new Promise<string | null>((resolve) => {
      let resolved = false;
      const handleRegistration = (data: { value?: string }) => {
        if (resolved) return;
        resolved = true;
        const token = data?.value ?? null;
        if (token) {
          // Fire-and-forget — failures are tolerable; the user can
          // re-launch the app to retry.
          void fetch("/api/push/register", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token,
              platform: nativePlatform()
            })
          }).catch(() => {});
        }
        resolve(token);
      };
      const handleError = () => {
        if (resolved) return;
        resolved = true;
        resolve(null);
      };
      Push.addListener?.("registration", handleRegistration);
      Push.addListener?.("registrationError", handleError);
      // Safety net: never block forever.
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, 10_000);
    });
  } catch {
    return null;
  }
}

/**
 * Hide the splash screen once the React app has mounted. No-op on web.
 * Capacitor auto-hides after the configured launchShowDuration, but
 * calling hide() explicitly makes the transition snappier on faster
 * networks.
 */
export async function hideSplashScreen(): Promise<void> {
  if (!isNative()) return;
  try {
    await window.Capacitor?.Plugins?.SplashScreen?.hide?.({
      fadeOutDuration: 200
    });
  } catch {}
}
