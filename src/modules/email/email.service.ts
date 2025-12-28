import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly isConfigured: boolean;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromEmail =
      this.configService.get<string>('RESEND_FROM_EMAIL') ||
      'onboarding@resend.dev';

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.isConfigured = true;
      this.logger.log('Email service initialized with Resend');
    } else {
      this.resend = new Resend('');
      this.isConfigured = false;
      this.logger.warn(
        'RESEND_API_KEY not configured - emails will be logged only',
      );
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const { to, subject, html, text } = options;

    if (!this.isConfigured) {
      this.logger.debug(
        `[EMAIL NOT SENT - No API Key] To: ${to}, Subject: ${subject}`,
      );
      this.logger.debug(`Content: ${text || html}`);
      return false;
    }

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
        text,
      });

      if (result.error) {
        this.logger.error(
          `Failed to send email to ${to}: ${result.error.message}`,
        );
        return false;
      }

      this.logger.log(
        `Email sent successfully to ${to} (ID: ${result.data?.id})`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      return false;
    }
  }

  async sendOtpEmail(
    to: string,
    code: string,
    type: 'verify' | 'reset',
  ): Promise<boolean> {
    const isVerify = type === 'verify';

    const subject = isVerify
      ? 'Verify your Bike Area account'
      : 'Reset your Bike Area password';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: bold; color: #e74c3c; }
            .code-box {
              background: #f8f9fa;
              border: 2px dashed #e74c3c;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
            }
            .code {
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #e74c3c;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Bike Area</div>
            </div>

            <h2>${isVerify ? 'Verify Your Email' : 'Password Reset'}</h2>

            <p>
              ${
                isVerify
                  ? 'Thank you for registering with Bike Area! Please use the code below to verify your email address:'
                  : 'You requested to reset your password. Use the code below to complete the process:'
              }
            </p>

            <div class="code-box">
              <div class="code">${code}</div>
            </div>

            <p>This code will expire in <strong>10 minutes</strong>.</p>

            <p>If you didn't ${isVerify ? 'create an account' : 'request a password reset'}, you can safely ignore this email.</p>

            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Bike Area. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Bike Area - ${isVerify ? 'Email Verification' : 'Password Reset'}

Your verification code is: ${code}

This code will expire in 10 minutes.

If you didn't ${isVerify ? 'create an account' : 'request a password reset'}, you can safely ignore this email.
    `.trim();

    return this.sendEmail({ to, subject, html, text });
  }

  async sendWelcomeEmail(to: string, username: string): Promise<boolean> {
    const subject = 'Welcome to Bike Area!';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: bold; color: #e74c3c; }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Bike Area</div>
            </div>

            <h2>Welcome, ${username}!</h2>

            <p>Your email has been verified and your account is now active.</p>

            <p>You can now:</p>
            <ul>
              <li>Browse and post motorcycle listings</li>
              <li>Connect with other riders</li>
              <li>Share your rides and experiences</li>
              <li>Find motorcycle services near you</li>
            </ul>

            <p>Ride safe!</p>

            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Bike Area. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({ to, subject, html });
  }
}
