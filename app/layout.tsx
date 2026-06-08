import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PanicExit } from "@/components/PanicExit";
import { SleepMode } from "@/components/SleepMode";
import { GuestBanner } from "@/components/GuestBanner";
import { NativeBridge } from "@/components/NativeBridge";
import { MobileNav } from "@/components/MobileNav";
import { VoiceCommand } from "@/components/VoiceCommand";
import { InstallPrompt } from "@/components/InstallPrompt";

const SLOGAN =
  "Meet your mate, chat, make friends, accept, adapt, share and care, live and let live, be happy because life is too short, and the future is uncertain.";

export const metadata: Metadata = {
  title: "Karochat — chat, make friends, share, care",
  description: SLOGAN,
  applicationName: "Karochat",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.webp", sizes: "192x192", type: "image/webp" },
      { url: "/icons/icon-512.webp", sizes: "512x512", type: "image/webp" }
    ],
    apple: [{ url: "/icons/icon-512.webp", sizes: "512x512" }],
    shortcut: ["/icon.svg"]
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
        <GuestBanner />
        <div className="relative z-10">{children}</div>
        <SleepMode />
        <PanicExit />
        <NativeBridge />
        <VoiceCommand />
        <MobileNav />
        <InstallPrompt />
      </body>
    </html>
  );
}
