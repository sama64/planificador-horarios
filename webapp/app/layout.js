import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';

import './globals.css';

const sansFont = Space_Grotesk({
  variable: '--font-sans',
  subsets: ['latin']
});

const monoFont = IBM_Plex_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500']
});

export const metadata = {
  title: 'Planificador de Horarios',
  description: 'Planificador academico optimizado por periodos con soporte de planes de estudio importables.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${sansFont.variable} ${monoFont.variable}`}>
        <div className="page-shell">{children}</div>
      </body>
    </html>
  );
}
