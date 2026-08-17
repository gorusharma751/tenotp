import { LegalPage, Section } from "@/components/legal/LegalPage";

export default function TermsAndConditions() {
  return (
    <LegalPage title="Terms & Conditions" subtitle="Please read these terms carefully before using TenOTP." intro="By creating an account or using TenOTP services, you agree to be bound by the following terms.">
      <Section title="1. Eligibility">
        <p>You must be at least 18 years of age and legally able to enter into contracts in your jurisdiction to use TenOTP.</p>
      </Section>
      <Section title="2. Account Responsibility">
        <p>You are responsible for keeping your credentials confidential and for all activity that occurs under your account. Notify us immediately of any unauthorized access.</p>
      </Section>
      <Section title="3. Wallet Usage">
        <p>Your wallet balance is used to purchase OTP numbers, rentals and other services on the platform. Balance is denominated in the platform currency displayed at the time of deposit.</p>
      </Section>
      <Section title="4. Deposit Policy">
        <p>Deposits are processed instantly via our payment gateway. Once a deposit is successfully credited to your wallet, it becomes non-refundable except as described in our Refund Policy.</p>
      </Section>
      <Section title="5. Payment Gateway Terms">
        <p>All payments are processed by Razorpay. Their terms and privacy policy also apply during checkout. TenOTP is not liable for failures caused by the payment gateway, bank or card issuer.</p>
      </Section>
      <Section title="6. Account Suspension">
        <p>We may suspend or terminate accounts that engage in fraud, chargebacks, abuse of OTP services, spam, or any prohibited activity, without prior notice.</p>
      </Section>
      <Section title="7. Fraud Prevention">
        <p>We monitor transactions and OTP usage patterns for suspicious activity. Any attempted fraud may result in permanent ban and reporting to authorities.</p>
      </Section>
      <Section title="8. Prohibited Activities">
        <ul>
          <li>Using OTPs for illegal, fraudulent or deceptive purposes.</li>
          <li>Reselling numbers to bypass anti-fraud systems of third-party services.</li>
          <li>Scraping, reverse-engineering, or abusing the platform APIs.</li>
          <li>Multiple accounts for exploiting bonuses, referrals or promotions.</li>
        </ul>
      </Section>
      <Section title="9. Service Availability">
        <p>We aim for high availability but do not guarantee uninterrupted service. Upstream carrier issues, maintenance or force majeure events may cause temporary downtime.</p>
      </Section>
      <Section title="10. Limitation of Liability">
        <p>TenOTP is provided on an "as is" basis. To the maximum extent permitted by law, we are not liable for any indirect, incidental or consequential damages arising from use of the service. Our total liability is limited to the amount paid by you in the preceding 30 days.</p>
      </Section>
      <Section title="11. Changes to Terms">
        <p>We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the revised terms.</p>
      </Section>
      <Section title="12. Contact">
        <p>Questions? Contact us at <a href="mailto:support@tenotp.pro" className="text-primary underline">support@tenotp.pro</a>.</p>
      </Section>
    </LegalPage>
  );
}
