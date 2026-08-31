import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { ThemeProvider } from "@/providers/theme-provider";
import { ThemeAwareToaster } from "@/components/layout/theme-aware-toaster";
import "./globals.css";
import { RealtimeAppointments } from "@/components/layout/realtime-appointments";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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