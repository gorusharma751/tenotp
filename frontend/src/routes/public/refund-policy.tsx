import { LegalPage, Section } from "@/components/legal/LegalPage";

export default function RefundPolicy() {
  return (
    <LegalPage title="Refund & Cancellation Policy" subtitle="How refunds are handled at TenOTP" intro="This policy explains when refunds are possible for wallet deposits and platform services.">
      <Section title="1. Wallet Deposits">
        <p>Wallet deposits are normally <strong>non-refundable</strong> once successfully credited to your account balance, as balance can be used immediately across all services.</p>
      </Section>
      <Section title="2. Failed Payments">
        <p>If a payment fails during checkout or is not credited to your wallet, it is automatically reversed by the payment gateway or your bank, typically within 5–7 business days. No manual action is required from our side.</p>
      </Section>
      <Section title="3. Duplicate Payments">
        <p>If you were charged twice for the same deposit due to a technical error, the duplicate transaction will be reviewed and refunded to the original payment method after verification.</p>
      </Section>
      <Section title="4. OTP Order Refunds">
        <p>If a purchased OTP number does not receive a message within the activation window, it is automatically cancelled and the amount is instantly refunded to your wallet.</p>
      </Section>
      <Section title="5. Refund Request Process">
        <ul>
          <li>Contact <a href="mailto:support@tenotp.pro" className="text-primary underline">support@tenotp.pro</a> with your transaction proof (transaction ID, amount, date).</li>
          <li>Requests are reviewed within 24–48 hours.</li>
          <li>If approved, refunds are processed to the original payment method within <strong>5–7 business days</strong>.</li>
        </ul>
      </Section>
      <Section title="6. Non-Refundable Situations">
        <ul>
          <li>Wallet balance already spent on services.</li>
          <li>Accounts suspended or terminated for fraud or policy violations.</li>
          <li>Chargebacks initiated without contacting support first.</li>
        </ul>
      </Section>
      <Section title="7. Contact">
        <p>For any refund or billing question, please reach out to <a href="mailto:support@tenotp.pro" className="text-primary underline">support@tenotp.pro</a>.</p>
      </Section>
    </LegalPage>
  );
}
