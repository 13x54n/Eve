export interface VerificationCodeSender {
  sendCode(input: { email: string; code: string }): Promise<void>;
}

export const verificationCodeSender: VerificationCodeSender = {
  async sendCode({ email, code }) {
    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    // For now, verification codes should be sent via email in all environments
    // Never log or return verification codes in responses
  },
};
