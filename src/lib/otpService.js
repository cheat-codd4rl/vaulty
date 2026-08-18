/**
 * Secure OTP Delivery Interface
 * In a real production environment, wire this to Resend, SendGrid, etc.
 */
export async function sendHostOtp(email, code) {
  if (process.env.NODE_ENV !== 'production') {
    // Only log the code in local development
    console.log('----------------------------------------');
    console.log(`[DEV ONLY] OTP for ${email}: ${code}`);
    console.log('----------------------------------------');
  } else {
    // In production, fail closed if no email provider is configured.
    // Replace RESEND_API_KEY with your actual provider's env variable check.
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
      console.error('[CRITICAL] OTP delivery failed: RESEND_API_KEY or RESEND_FROM_EMAIL is not configured in production.');
      throw new Error('Email delivery service is not configured. Cannot send OTP.');
    }
    
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: email,
          subject: 'Your Vaulty Login Code',
          html: `<p>Your one-time login code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[CRITICAL] OTP email delivery failed with status ${res.status}: ${errorText}`);
        throw new Error('Failed to deliver OTP email.');
      }
    } catch (err) {
      console.error('[CRITICAL] OTP email delivery exception:', err.message);
      throw new Error('Failed to deliver OTP email.');
    }
  }
}
