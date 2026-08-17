import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: 'Vaulty — Every photo from the night, in one vault.',
  description:
    'Guests scan a code and upload straight from their camera roll — full resolution, no app, no account. One gallery instead of forty WhatsApp threads.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
