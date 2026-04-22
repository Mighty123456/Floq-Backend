import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as path from 'path';

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
    <body style="margin:0;padding:0;background-color:#0A0A0A;color:#FFFFFF;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0A0A;padding:48px 16px;">
        <tr><td align="center">
          <table width="100%" style="max-width:540px;background-color:#161616;border-radius:28px;overflow:hidden;border:1px solid #262626;">
            <tr><td height="4" style="background:linear-gradient(90deg, #3B82F6, #60A5FA, #3B82F6);"></td></tr>
            <tr>
              <td style="padding:40px 40px 24px;text-align:center;">
                <div style="display:inline-block;padding:20px;background:rgba(59, 130, 246, 0.05);border-radius:22px;border:1px solid rgba(59, 130, 246, 0.15);position:relative;">
                  <!-- Styled Logo Icon -->
                  <div style="width:80px;height:80px;border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto;box-shadow: 0 10px 20px rgba(59,130,246,0.3);overflow:hidden;">
                    <img src="cid:floq_logo" alt="Floq Logo" style="width:100%;height:100%;object-fit:cover;display:block;" />
                  </div>
                  <div style="margin-top:16px;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:-0.5px;text-transform:uppercase;">FLOQ</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 40px;">
                <div style="background-color:rgba(255,255,255,0.01);border-radius:24px;padding:32px;border:1px solid rgba(255,255,255,0.04);">
                  ${content}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;background-color:#111111;text-align:center;border-top:1px solid #262626;">
                <p style="color:#666666;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Floq &bull; Premium Experience</p>
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
          <div style="display:inline-block;background:rgba(255,255,255,0.02);padding:16px;border-radius:20px;">
            ${otp.split('').map(d => `
              <div style="
                display:inline-block;width:44px;height:56px;line-height:56px;
                background:#1E1E1E;border:1px solid #333333;
                border-radius:12px;font-size:26px;font-weight:700;
                color:#3B82F6;text-align:center;margin:0 4px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.2);
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

  async sendLoginOTP(email: string, name: string, otp: string) {
    const html = this.layout(`
      <h1 style="color:#FFFFFF;margin:0 0 16px;font-size:24px;font-weight:800;text-align:center;">Quick Login ⚡</h1>
      <p style="color:#9CA3AF;font-size:16px;line-height:1.6;margin:0;text-align:center;">
        Hi <strong>${name}</strong>, use the code below to sign in instantly.
      </p>
      ${this.otpBox(otp)}
      <p style="color:#6B7280;font-size:13px;text-align:center;">This code will expire in 5 minutes.</p>
    `);

    return this.sendMail(email, '⚡ Your Floq login code', html);
  }

  private async sendMail(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: `"${this.configService.get('EMAIL_FROM_NAME') || 'Floq'}" <${this.configService.get('EMAIL_FROM')}>`,
        to,
        subject,
        html,
        attachments: [
          {
            filename: 'icon.png',
            path: path.join(process.cwd(), 'assets', 'icon.png'),
            cid: 'floq_logo',
          },
        ],
      });
    } catch (error) {
      console.error('Email Error:', error);
      throw new InternalServerErrorException('Failed to send email');
    }
  }
}
