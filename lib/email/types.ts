export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isPermanentError?: boolean;
  isRateLimit?: boolean;
}

export interface EmailSendingProvider {
  /**
   * Retrieves the current account details (e.g. from the database).
   */
  getAccount(): Promise<{
    email: string;
    status: string;
  }>;

  /**
   * Refreshes the authentication token if expired.
   */
  refreshAuthentication(): Promise<boolean>;

  /**
   * Sends an email using the provider.
   */
  sendEmail(options: SendEmailOptions): Promise<SendResult>;
}
