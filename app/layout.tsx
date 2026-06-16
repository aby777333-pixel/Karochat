import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { PanicExit } from "@/components/PanicExit";
import { GuestBanner } from "@/components/GuestBanner";
import { NativeBridge } from "@/components/NativeBridge";
import { MobileNav } from "@/components/MobileNav";
import { VoiceCommand } from "@/components/VoiceCommand";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ContactFlush } from "@/components/ContactFlush";
import { GlobalNotifier } from "@/components/GlobalNotifier";

const SLOGAN =
  "Meet your mate, chat, make friends, accept, adapt, share and care, live and let live, be happy because life is too short, and the future is uncertain.";

export const metadata: Metadata = {
  title: "Karochat — chat, make friends, share, care",
  description: SLOGAN,
  applicationName: "Karochat",
  manifest: "/manifest.webmanifest",
  icons: {
    // Browser-tab favicon: white-background mark so the flower reads clearly on
    // dark tab bars. Kept separate from the PWA install icons (which stay
    // transparent via manifest.webmanifest + /icon.svg).
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", sizes: "180x180", type: "image/png" }
    ],
    apple: [{ url: "/icons/icon-512.webp", sizes: "512x512" }],
    shortcut: ["/favicon.svg"]
  },
  appleWebApp: {
    capable: true,
    title: "Karochat",
    statusBarStyle: "black-translucent"
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Karochat",
    description: SLOGAN,
    type: "website"
  }
};

export const viewport: Viewport = {
  themeColor: "#0b0c0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  userScalable: false
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="relative min-h-screen font-sans antialiased">
        {/* Capture the PWA install event as early as possible — it can fire
            before React mounts InstallPrompt, otherwise it's lost and neither the
            landing banner nor the menu "Install app" can trigger a real install.
            Stash it globally and re-broadcast so InstallPrompt can use it. */}
        <Script id="karo-bip-capture" strategy="beforeInteractive">
          {`(function(){try{
            window.addEventListener('beforeinstallprompt',function(e){
              e.preventDefault();
              window.__karoBIP=e;
              try{window.dispatchEvent(new Event('karo:bip'));}catch(_){}
            });
            window.addEventListener('appinstalled',function(){
              window.__karoBIP=null;
              try{window.dispatchEvent(new Event('karo:appinstalled'));}catch(_){}
            });
          }catch(_){}})();`}
        </Script>
        <GuestBanner />
        <div className="relative z-10">{children}</div>
        <PanicExit />
        <NativeBridge />
        <VoiceCommand />
        <MobileNav />
        <InstallPrompt />
        <ContactFlush />
        <GlobalNotifier />
      </body>
    </html>
  );
}
