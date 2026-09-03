export type SendOtpInput = {
  whatsappNormalized: string;
  code: string;
  expiresAt: Date;
};

export interface OtpSenderPort {
  sendOtp(input: SendOtpInput): Promise<void>;
}
