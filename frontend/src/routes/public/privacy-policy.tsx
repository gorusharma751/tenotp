import { LegalPage, Section } from "@/components/legal/LegalPage";

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" subtitle="Last updated: 2026" intro="This Privacy Policy explains how TenOTP collects, uses, stores and protects information when you use our virtual number and OTP platform.">
      <Section title="1. Information We Collect">
        <ul>
          <li>Account information: name, email, mobile number and profile data you provide during registration.</li>
          <li>Wallet & transaction records: deposits, purchases, refunds and balance history.</li>
          <li>Technical data: IP address, device type, browser information, timezone and usage logs.</li>
          <li>Cookies and similar technologies used for session management, preferences and analytics.</li>
        </ul>
      </Section>
      <Section title="2. How We Use Your Data">
        <ul>
          <li>To operate your account, wallet and OTP services.</li>
          <li>To process deposits and payments through our payment gateway.</li>
          <li>To prevent fraud, abuse and unauthorized activity.</li>
          <li>To provide customer support and service communications.</li>
        </ul>
      </Section>
      <Section title="3. Cookies">
        <p>We use essential cookies for authentication and session state, plus optional analytics cookies to improve product experience. You can control cookies in your browser settings.</p>
      </Section>
      <Section title="4. Data Security">
        <p>Data is transmitted over HTTPS and stored in access-controlled databases with role-based restrictions and row-level security policies. Passwords are hashed and payment card data is never stored on our servers.</p>
      </Section>
      <Section title="5. Payment Gateway (Razorpay)">
        <p>Deposits are processed through Razorpay. When you make a payment, the required transaction data is shared securely with Razorpay under their own privacy and PCI-DSS-compliant infrastructure. We never store your card, UPI or banking credentials.</p>
      </Section>
      <Section title="6. Third-Party Sharing">
        <p><strong>We never sell personal information to third parties.</strong> Data is only shared with service providers (payment gateway, hosting, OTP upstream carriers) strictly to deliver the service, or when legally required.</p>
      </Section>
      <Section title="7. Your Rights">
        <ul>
          <li>Access, correct or update your profile information anytime from your dashboard.</li>
          <li>Request a copy or deletion of your account data by contacting support.</li>
          <li>Opt out of non-essential marketing communications.</li>
        </ul>
      </Section>
      <Section title="8. Account Deletion">
        <p>You may request account deletion at any time by emailing our support team. Certain records (financial transactions, fraud logs) may be retained where required by law.</p>
      </Section>
      <Section title="9. Contact">
        <p>For any privacy-related questions, contact <a href="mailto:support@tenotp.pro" className="text-primary underline">support@tenotp.pro</a>.</p>
      </Section>
    </LegalPage>
  );
}
