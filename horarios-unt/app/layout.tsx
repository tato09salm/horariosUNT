import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SiHorarios UNT',
  description: 'Sistema de Gestión de Horarios - Escuela de Ingeniería de Sistemas, UNT',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
