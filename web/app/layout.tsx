import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/providers/theme-provider";
import { ThemeAwareToaster } from "@/components/layout/theme-aware-toaster";
import "./globals.css";
import { RealtimeAppointments } from "@/components/layout/realtime-appointments";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Eliza",
  description: "Gestão Inteligente",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <ThemeProvider>
          <RealtimeAppointments />
          {children}
          <ThemeAwareToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}