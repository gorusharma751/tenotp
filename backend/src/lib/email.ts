// No email provider is wired up yet. Swap this for Resend/SES/Postmark/etc.
// before relying on self-service password resets in production.
export async function sendPasswordResetEmail(input: { to: string; resetUrl: string }): Promise<void> {
  console.warn(`[email] No email provider configured — password reset link for ${input.to} was not sent: ${input.resetUrl}`);
}
