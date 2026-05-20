import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PanicExit } from "@/components/PanicExit";

const SLOGAN =
  "Meet your mate, chat, make friends, accept, adapt, share and care, live and let live, be happy because life is too short, and the future is uncertain.";

export const metadata: Metadata = {
  title: "Karochat — chat, make friends, share, care",
  description: SLOGAN,
  applicationName: "Karochat",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    title: "Karochat",
    description: SLOGAN,
    type: "website"
  }
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="relative min-h-screen font-sans antialiased">
        <div className="relative z-10">{children}</div>
        <PanicExit />
      </body>
    </html>
  );
}
