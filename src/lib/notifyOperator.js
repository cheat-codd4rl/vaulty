import { adminDb } from './firebaseAdmin';
import { Resend } from 'resend';

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour debounce

export async function notifyOperatorDriveAuthFailed(context = {}) {
  // If no Resend key is set, we just log and skip instead of crashing
  if (!process.env.RESEND_API_KEY) {
    console.warn('Operator notification skipped: RESEND_API_KEY not configured.');
    return;
  }

  try {
    const alertRef = adminDb.collection('system').doc('driveAuthAlert');

    // Use a Firestore transaction to atomically check and set the debounce
    const shouldSend = await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(alertRef);
      const now = Date.now();

      if (doc.exists) {
        const { lastSentAt } = doc.data();
        if (lastSentAt && now - lastSentAt < COOLDOWN_MS) {
          return false; // Still in cooldown
        }
      }

      transaction.set(alertRef, { lastSentAt: now }, { merge: true });
      return true;
    });

    if (!shouldSend) {
      return; // Bounced by cooldown
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // We send an email to the operator indicating that the Google Drive OAuth token has been revoked
    await resend.emails.send({
      from: 'Vaulty System <system@vaulty.studio>',
      to: 'support@vaulty.studio', // Can be customized or mapped to a specific admin email
      subject: 'CRITICAL: Vaulty Google Drive Connection Broken',
      html: `
        <h2>Google Drive Auth Revoked</h2>
        <p>The OAuth refresh token for Google Drive has expired or been revoked.</p>
        <p>All photo uploads and deletions are currently failing.</p>
        <p><strong>Action required:</strong> Please generate a new refresh token and update Vercel Environment Variables immediately.</p>
        <p><em>Context details:</em> ${JSON.stringify(context)}</p>
      `
    });

    console.log('Operator successfully notified of DRIVE_AUTH_REVOKED.');
  } catch (error) {
    console.error('Failed to send operator notification:', error);
  }
}
