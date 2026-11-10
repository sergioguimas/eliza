import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/providers/theme-provider";
import { ThemeAwareToaster } from "@/components/layout/theme-aware-toaster";
import "./globals.css";
import { RealtimeAppointments } from "@/components/layout/realtime-appointments";

// IBM Plex Sans variável (subconjunto latino do Google Fonts, pesos 300–700), no repo: o build não depende da
// rede. Em 10/11/2026 o Google passou a devolver URLs `/l/font?kit=…&skey=…` para a VPS e o next/font/google
// do Turbopack quebrou com elas. Licença: app/fonts/OFL.txt.
const plex = localFont({
  src: "./fonts/ibm-plex-sans-latin.woff2",
  weight: "300 700",
  display: "swap",
  variable: "--font-plex",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://eliza.solasoftware.com.br"),
  title: { default: "Eliza", template: "%s | Eliza" },
  description: "Sistema de agendamento e gestão para clínicas, consultórios e prestadores de serviço.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${plex.className} bg-background text-foreground antialiased`}>
        <ThemeProvider>
          <RealtimeAppointments />
          {children}
          <ThemeAwareToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}