export interface VerificationCodeSender {
  sendCode(input: { email: string; code: string }): Promise<void>;
}

export const verificationCodeSender: VerificationCodeSender = {
  async sendCode({ email, code }) {
    console.log(`[verification-code] ${email}: ${code}`);
  },
};