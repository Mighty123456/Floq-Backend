import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('EMAIL_HOST') || 'smtp.gmail.com',
      port: parseInt(this.configService.get('EMAIL_PORT') || '587'),
      secure: this.configService.get('EMAIL_PORT') === '465',
      auth: {
        user: this.configService.get('EMAIL_USER'),
        pass: this.configService.get('EMAIL_PASS'),
      },
    });
  }

  private layout(content: string) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
    </head>
    <body style="margin:0;padding:0;background-color:#08080A;color:#FFFFFF;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#08080A;padding:48px 16px;">
        <tr><td align="center">
          <table width="100%" style="max-width:560px;background-color:#12121A;border-radius:24px;overflow:hidden;border:1px solid #1F1F2E;">
            <tr><td height="6" style="background:linear-gradient(90deg, #7C3AED, #EC4899, #7C3AED);"></td></tr>
            <tr>
              <td style="padding:48px 40px 32px;text-align:center;">
                <div style="display:inline-block;padding:12px;background:rgba(124, 58, 237, 0.1);border-radius:16px;margin-bottom:16px;">
                  <span style="font-size:32px;font-weight:800;color:#FFFFFF;letter-spacing:-1px;display:block;">floq</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 48px;">
                <div style="background-color:rgba(255,255,255,0.02);border-radius:20px;padding:32px;border:1px solid rgba(255,255,255,0.05);">
                  ${content}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;background-color:#0C0C12;text-align:center;border-top:1px solid #1F1F2E;">
                <p style="color:#6B7280;font-size:11px;">&copy; ${new Date().getFullYear()} Floq Inc.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`;
  }

  private otpBox(otp: string) {
    return `
    <table width="100%" style="margin:32px 0;">
      <tr>
        <td align="center">
          <div style="display:inline-block;">
            ${otp.split('').map(d => `
              <div style="
                display:inline-block;width:40px;height:50px;line-height:50px;
                background:#1A1A24;border:2px solid #2D2D3F;
                border-radius:10px;font-size:24px;font-weight:800;
                color:#7C3AED;text-align:center;margin:0 4px;
              ">${d}</div>
            `).join('')}
          </div>
        </td>
      </tr>
    </table>`;
  }

  async sendVerificationOTP(email: string, name: string, otp: string) {
    const html = this.layout(`
      <h1 style="color:#FFFFFF;margin:0 0 16px;font-size:24px;font-weight:800;text-align:center;">Welcome to Floq! 🚀</h1>
      <p style="color:#9CA3AF;font-size:16px;line-height:1.6;margin:0;text-align:center;">
        Hi <strong>${name}</strong>, use the code below to verify your account.
      </p>
      ${this.otpBox(otp)}
      <p style="color:#6B7280;font-size:13px;text-align:center;">Valid for 10 minutes.</p>
    `);

    return this.sendMail(email, '📬 Verify your Floq account', html);
  }

  async sendPasswordResetOTP(email: string, name: string, otp: string) {
    const html = this.layout(`
      <h1 style="color:#FFFFFF;margin:0 0 16px;font-size:24px;font-weight:800;text-align:center;">Reset Password 🔑</h1>
      <p style="color:#9CA3AF;font-size:16px;line-height:1.6;margin:0;text-align:center;">
        Hi <strong>${name}</strong>, use this code to reset your password.
      </p>
      ${this.otpBox(otp)}
    `);

    return this.sendMail(email, '🔑 Your Floq password reset code', html);
  }

  private async sendMail(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: `"${this.configService.get('EMAIL_FROM_NAME') || 'Floq'}" <${this.configService.get('EMAIL_FROM')}>`,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('Email Error:', error);
      throw new InternalServerErrorException('Failed to send email');
    }
  }
}
