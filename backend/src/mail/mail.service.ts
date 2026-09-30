import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends email over SMTP. In development the SMTP server is Mailpit (docker compose), which keeps
 * every message for reading at http://localhost:8025 instead of delivering it.
 */
@Injectable()
export class MailService {
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    this.transport = createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      // Env values are strings.
      port: Number(config.get('SMTP_PORT', 1025)),
      secure: config.get('SMTP_SECURE') === 'true',
      auth: user ? { user, pass: config.get<string>('SMTP_PASS') } : undefined,
    });
    this.from = config.get<string>('MAIL_FROM', 'Ordely <no-reply@ordely.tn>');
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}
