import nodemailer from 'nodemailer';
import { createLogger } from '@ornate/logger';

const log = createLogger('mailer');

function getTransporter() {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER || 'ornateinteriord@gmail.com';
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS || 'wjrjoxmcinltblps';

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends a custom themed HTML email with a 6-digit OTP code to verify customer email.
 */
export async function sendEmailVerificationOtp(email: string, name: string, otp: string): Promise<boolean> {
  try {
    const user = process.env.EMAIL_USER || process.env.SMTP_USER || 'ornateinteriord@gmail.com';
    const transporter = getTransporter();

    const safeName = name ? name.trim() : 'Customer';

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your E-Shophy Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06); border: 1px solid #E2E8F0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); padding: 36px 30px; text-align: center; border-bottom: 3px solid #FF7900;">
              <table role="presentation" align="center" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <!-- Brand Icon & Name -->
                    <div style="display: inline-block; background-color: #FF7900; width: 44px; height: 44px; border-radius: 12px; line-height: 44px; text-align: center; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(255, 121, 0, 0.4);">
                      <span style="font-size: 24px; color: #FFFFFF;">🛒</span>
                    </div>
                    <div style="font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #FFFFFF; margin: 0;">
                      E-<span style="color: #FF7900;">Shophy</span>
                    </div>
                    <div style="font-size: 13px; color: #94A3B8; margin-top: 4px; font-weight: 500;">
                      Official Email Verification
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 14px 0;">
                Verify Your Email Address
              </h2>
              <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                Hello <strong style="color: #0F172A;">${safeName}</strong>,
              </p>
              <p style="font-size: 14.5px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                Thank you for using E-Shophy! To confirm and secure your registered email address (<strong style="color: #FF7900;">${email}</strong>), please enter the 6-digit verification code below:
              </p>

              <!-- OTP Highlight Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); border: 2px solid #FF7900; border-radius: 16px; padding: 24px 32px; display: inline-block; box-shadow: 0 8px 24px rgba(255, 121, 0, 0.25);">
                      <div style="font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">
                        ONE-TIME VERIFICATION CODE
                      </div>
                      <div style="font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #FFFFFF; font-family: 'Courier New', Courier, monospace; margin: 6px 0; text-shadow: 0 2px 6px rgba(0,0,0,0.5);">
                        ${otp}
                      </div>
                      <div style="font-size: 12px; font-weight: 600; color: #FBBF24; margin-top: 8px;">
                        ⏱ Valid for 10 minutes only
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13.5px; line-height: 1.5; color: #64748B; margin: 0 0 18px 0; text-align: center;">
                Please do not share this code with anyone. E-Shophy personnel will never ask for your verification code.
              </p>
              
              <div style="border-top: 1px solid #E2E8F0; margin-top: 28px; padding-top: 20px;">
                <p style="font-size: 12px; line-height: 1.5; color: #94A3B8; margin: 0;">
                  If you did not request this verification, someone may have entered your email by mistake. You can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 24px 30px; text-align: center; border-top: 1px solid #E2E8F0;">
              <p style="font-size: 12px; color: #64748B; margin: 0 0 6px 0; font-weight: 600;">
                E-Shophy • Premium E-Commerce & Network Marketplace
              </p>
              <p style="font-size: 11px; color: #94A3B8; margin: 0;">
                © 2026 E-Shophy. All rights reserved. • <a href="https://www.eshopy.biz" style="color: #FF7900; text-decoration: none; font-weight: 600;">www.eshopy.biz</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const mailOptions = {
      from: `"E-Shophy" <${user}>`,
      to: email,
      subject: `${otp} is your E-Shophy Email Verification Code`,
      html: htmlContent,
      text: `Hello ${safeName},\n\nYour 6-digit email verification code for E-Shophy is: ${otp}\n\nThis code is valid for 10 minutes.\n\nIf you did not request this code, please ignore this email.\n\n© 2026 E-Shophy`,
    };

    const info = await transporter.sendMail(mailOptions);
    log.info({ messageId: info.messageId, to: email }, 'Verification OTP email sent successfully');
    return true;
  } catch (err: any) {
    log.error({ err: err.message, to: email }, 'Failed to send verification OTP email');
    throw err;
  }
}

