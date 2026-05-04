import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Importa a fonte do Google
import "./globals.css"; // Importa o CSS do Tailwind

// Configura a fonte Inter
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gerador de Etiquetas",
  description: "Aplicação para gerar etiquetas a partir de arquivos CSV",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      {/* A classe da fonte é aplicada diretamente no body */}
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}