import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import { Analytics } from "@vercel/analytics/next"

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
  description: 'Planificador academico que minimiza periodos y rebalancea la carga por cuatrimestre con soporte de planes de estudio importables.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${sansFont.variable} ${monoFont.variable}`}>
        <Analytics />
        <div className="page-shell">
          {children}
          <footer className="site-footer">
            <span>Santiago Amaya</span>
            <a
              href="https://github.com/sama64/planificador-horarios"
              target="_blank"
              rel="noreferrer"
              className="site-footer-link"
              aria-label="Repositorio en GitHub"
            >
              <svg className="site-footer-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2C6.48 2 2 6.58 2 12.22c0 4.5 2.87 8.31 6.84 9.65.5.1.68-.22.68-.5 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.21-3.37-1.21-.46-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .08 1.53 1.05 1.53 1.05.9 1.56 2.35 1.11 2.92.85.09-.67.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.05 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.72 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.36 1.91-1.33 2.75-1.05 2.75-1.05.55 1.42.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.76 0 3.92-2.33 4.79-4.56 5.04.36.32.68.95.68 1.92 0 1.39-.01 2.5-.01 2.84 0 .28.18.61.69.5A10.25 10.25 0 0 0 22 12.22C22 6.58 17.52 2 12 2z"
                />
              </svg>
              GitHub
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
