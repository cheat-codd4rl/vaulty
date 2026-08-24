import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { termsContent } from '@/lib/terms-content';

export const metadata = {
  title: 'Terms of Service | Vaulty',
  description: 'Vaulty Terms of Service',
};

export default function TermsOfService() {
  return (
    <>
      <Navbar />
      <main className="wrap section" style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px', lineHeight: '1.6' }}>
        
        <div style={{ marginBottom: '48px', padding: '16px', background: 'rgba(255,200,0,0.1)', border: '1px solid rgba(255,200,0,0.3)', borderRadius: '8px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-dim)' }}>
            <strong>Disclaimer:</strong> This is an AI-generated draft, not legal advice, and should be reviewed by a lawyer before publishing — especially the sections concerning minors, liability, and indemnification.
          </p>
        </div>

        <div style={{ marginBottom: '48px' }}>
          <h1 style={{ fontSize: '36px', letterSpacing: '-0.02em', marginBottom: '8px' }}>Terms of Service</h1>
          <p style={{ color: 'var(--text-dim)', margin: 0 }}>Last Updated: {termsContent.lastUpdated}</p>
        </div>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {termsContent.sections.map((section, idx) => (
            <div key={idx}>
              <h2>{section.title}</h2>
              {section.content.split('\n\n').map((paragraph, pIdx) => {
                // Check if paragraph is a list
                if (paragraph.startsWith('- ')) {
                  const items = paragraph.split('\n- ').map(i => i.replace(/^- /, ''));
                  return (
                    <ul key={pIdx} style={{ paddingLeft: '24px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {items.map((item, iIdx) => (
                        <li key={iIdx} dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                      ))}
                    </ul>
                  );
                }
                return <p key={pIdx} dangerouslySetInnerHTML={{ __html: paragraph.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />;
              })}
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
