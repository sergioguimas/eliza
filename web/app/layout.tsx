import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { RealtimeAppointments } from "@/components/realtime-appointments";

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
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <RealtimeAppointments />
        {children}
        <Toaster richColors theme="dark" />
      </body>
    </html>
  );
}