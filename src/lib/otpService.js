/**
 * Secure OTP Delivery Interface
 * In a real production environment, wire this to Resend, SendGrid, etc.
 */
export async function sendHostOtp(email, code) {
  if (process.env.NODE_ENV === 'development') {
    // Only log the code in local development
    console.log('----------------------------------------');
    console.log(`[DEV ONLY] OTP for ${email}: ${code}`);
    console.log('----------------------------------------');
  } else {
    // In production, this must use a real delivery service.
    // e.g. await resend.emails.send({ to: email, subject: 'Your Vaulty Login Code', html: `<p>${code}</p>` })
    console.log(`[PRODUCTION WARNING] OTP delivery service not configured. OTP generated for ${email} but not sent.`);
  }
}
