import './globals.css';
import { ToastProvider } from '@/components/Toast';

export const metadata = {
  title: 'Vaulty — Every photo from the night, in one vault.',
  description:
    'Guests scan a code and upload straight from their camera roll — full resolution, no app, no account. One gallery instead of forty WhatsApp threads.',
};

import { Source_Serif_4 } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-source-serif',
});

const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('vaulty-theme');
      if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={sourceSerif.variable}>
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
