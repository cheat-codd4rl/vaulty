import HomeGate from '@/components/HomeGate';

export const metadata = {
  title: 'Vaulty — Every photo from the night, in one vault.',
  description:
    'Guests scan a code and upload straight from their camera roll — full resolution, no app, no account. One gallery instead of forty WhatsApp threads.',
};

export default function Home() {
  return <HomeGate />;
}
