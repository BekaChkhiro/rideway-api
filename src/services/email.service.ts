import { Resend } from 'resend';
import { config, isDev } from '../config';

const resend = new Resend(config.resend.apiKey);

type EmailTemplate = 'otp' | 'password-reset' | 'welcome';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface OtpEmailData {
  code: string;
  expiresInMinutes?: number;
}

const templates = {
  otp: (data: OtpEmailData) => ({
    subject: `${data.code} - თქვენი დამადასტურებელი კოდი`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background: #f5f5f5;">
        <div style="max-width: 400px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">Rideway</h1>
          </div>

          <p style="color: #333; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
            თქვენი დამადასტურებელი კოდი:
          </p>

          <div style="background: #fafafa; border: 2px dashed #e5e5e5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${data.code}</span>
          </div>

          <p style="color: #666; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
            კოდი მოქმედებს ${data.expiresInMinutes || 10} წუთის განმავლობაში.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; line-height: 1.5; margin: 0;">
            თუ თქვენ არ მოითხოვეთ ეს კოდი, უბრალოდ იგნორირება გაუკეთეთ ამ წერილს.
          </p>
        </div>
      </body>
      </html>
    `,
  }),

  'password-reset': (data: OtpEmailData) => ({
    subject: 'პაროლის აღდგენა - Rideway',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background: #f5f5f5;">
        <div style="max-width: 400px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">Rideway</h1>
          </div>

          <p style="color: #333; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
            პაროლის აღდგენის კოდი:
          </p>

          <div style="background: #fafafa; border: 2px dashed #e5e5e5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${data.code}</span>
          </div>

          <p style="color: #666; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
            კოდი მოქმედებს ${data.expiresInMinutes || 10} წუთის განმავლობაში.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; line-height: 1.5; margin: 0;">
            თუ თქვენ არ მოითხოვეთ პაროლის აღდგენა, გთხოვთ იგნორირება გაუკეთოთ ამ წერილს ან დაგვიკავშირდეთ.
          </p>
        </div>
      </body>
      </html>
    `,
  }),

  welcome: () => ({
    subject: 'კეთილი იყოს თქვენი მობრძანება Rideway-ზე!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background: #f5f5f5;">
        <div style="max-width: 400px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">Rideway</h1>
          </div>

          <p style="color: #333; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
            კეთილი იყოს თქვენი მობრძანება Rideway-ზე - საქართველოს მოტოენთუზიასტების კომუნიტიაში!
          </p>

          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            აქ შეგიძლიათ:
          </p>
          <ul style="color: #666; font-size: 14px; line-height: 1.8; padding-left: 20px;">
            <li>გააზიაროთ თქვენი მოგზაურობები</li>
            <li>იპოვოთ მოტოციკლები და ნაწილები</li>
            <li>დაუკავშირდეთ სხვა მოტოციკლისტებს</li>
          </ul>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
            Rideway გუნდი
          </p>
        </div>
      </body>
      </html>
    `,
  }),
};

export const emailService = {
  async send(options: SendEmailOptions): Promise<boolean> {
    if (!config.resend.apiKey) {
      console.warn('[Email] Resend API key not configured, skipping email');
      return false;
    }

    try {
      const result = await resend.emails.send({
        from: config.resend.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (result.error) {
        console.error('[Email] Failed to send:', result.error);
        return false;
      }

      if (isDev) {
        console.log(`[Email] Sent to ${options.to}: ${options.subject}`);
      }

      return true;
    } catch (error) {
      console.error('[Email] Error sending email:', error);
      return false;
    }
  },

  async sendOtp(to: string, code: string): Promise<boolean> {
    const template = templates.otp({ code, expiresInMinutes: 10 });
    return this.send({
      to,
      subject: template.subject,
      html: template.html,
    });
  },

  async sendPasswordResetOtp(to: string, code: string): Promise<boolean> {
    const template = templates['password-reset']({ code, expiresInMinutes: 10 });
    return this.send({
      to,
      subject: template.subject,
      html: template.html,
    });
  },

  async sendWelcome(to: string): Promise<boolean> {
    const template = templates.welcome();
    return this.send({
      to,
      subject: template.subject,
      html: template.html,
    });
  },
};
