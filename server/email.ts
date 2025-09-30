import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    const emailData: any = {
      to: params.to,
      from: params.from,
      subject: params.subject,
    };
    
    if (params.text) {
      emailData.text = params.text;
    }
    
    if (params.html) {
      emailData.html = params.html;
    }
    
    await mailService.send(emailData);
    return true;
  } catch (error: any) {
    console.error('SendGrid email error:', error);
    if (error.response && error.response.body && error.response.body.errors) {
      console.error('SendGrid error details:', error.response.body.errors);
    }
    return false;
  }
}

export async function sendPasswordResetEmail(
  userEmail: string,
  resetUrl: string,
  userName: string,
  fromEmail: string = 'support@bluepaperclip.com'
): Promise<boolean> {
  const subject = 'Password Reset - Parks & Lots Booking System';
  
  const text = `
Hello ${userName},

We received a request to reset your password for Parks & Lots Booking System.

Click the link below to reset your password:
${resetUrl}

This link will expire in 24 hours for security reasons.

If you did not request this password reset, please ignore this email and your password will remain unchanged.

Best regards,
Parks & Lots Team
  `;

  const html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">Password Reset Request</h2>
      
      <p>Hello ${userName},</p>
      
      <p>We received a request to reset your password for Parks & Lots Booking System.</p>
      
      <div style="margin: 30px 0; text-align: center;">
        <a href="${resetUrl}" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Reset Password
        </a>
      </div>
      
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      
      <p style="color: #666; font-size: 14px;">
        <em>This link will expire in 24 hours for security reasons.</em>
      </p>
      
      <p style="color: #999; font-size: 14px;">
        If you did not request this password reset, please ignore this email and your password will remain unchanged.
      </p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      
      <p style="color: #999; font-size: 12px;">
        Best regards,<br>
        Parks & Lots Team
      </p>
    </div>
  `;

  return await sendEmail({
    to: userEmail,
    from: fromEmail,
    subject,
    text,
    html
  });
}

export async function sendInviteEmail(
  inviteEmail: string,
  inviteUrl: string,
  invitedByName: string,
  fromEmail: string = 'support@bluepaperclip.com'
): Promise<boolean> {
  const subject = 'You\'re invited to join Parks & Lots Booking System';
  
  const text = `
Hello,

You've been invited by ${invitedByName} to join the Parks & Lots Booking System as a manager.

Click the link below to accept your invitation and set up your account:
${inviteUrl}

This invitation will expire in 7 days.

Best regards,
Parks & Lots Team
  `;

  const html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">You're invited to Parks & Lots!</h2>
      
      <p>Hello,</p>
      
      <p>You've been invited by <strong>${invitedByName}</strong> to join the Parks & Lots Booking System as a manager.</p>
      
      <div style="margin: 30px 0; text-align: center;">
        <a href="${inviteUrl}" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Accept Invitation
        </a>
      </div>
      
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${inviteUrl}</p>
      
      <p style="color: #666; font-size: 14px;">
        <em>This invitation will expire in 7 days.</em>
      </p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      
      <p style="color: #999; font-size: 12px;">
        Best regards,<br>
        Parks & Lots Team
      </p>
    </div>
  `;

  return await sendEmail({
    to: inviteEmail,
    from: fromEmail,
    subject,
    text,
    html
  });
}

export async function sendTenantInviteEmail(
  tenantEmail: string,
  inviteUrl: string,
  tenantName: string,
  lotInfo: string,
  createdByName: string,
  fromEmail: string = 'support@bluepaperclip.com'
): Promise<boolean> {
  const subject = 'Welcome to Parks & Lots - Set Up Your Tenant Account';
  
  const text = `
Hello ${tenantName},

Welcome to Parks & Lots! Your tenancy has been set up by ${createdByName}.

You've been assigned to ${lotInfo}.

To access your tenant portal and manage your account, please click the link below to set up your password:
${inviteUrl}

Through your tenant portal, you'll be able to:
- View your lease information
- Make rent payments
- Submit maintenance requests
- Update your contact information

This invitation will expire in 7 days.

If you have any questions, please contact your property manager.

Best regards,
Parks & Lots Team
  `;

  const html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">Welcome to Parks & Lots!</h2>
      
      <p>Hello ${tenantName},</p>
      
      <p>Welcome to Parks & Lots! Your tenancy has been set up by <strong>${createdByName}</strong>.</p>
      
      <p>You've been assigned to <strong>${lotInfo}</strong>.</p>
      
      <div style="margin: 30px 0; text-align: center;">
        <a href="${inviteUrl}" 
           style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Set Up Your Account
        </a>
      </div>
      
      <p>Through your tenant portal, you'll be able to:</p>
      <ul style="color: #555;">
        <li>View your lease information</li>
        <li>Make rent payments</li>
        <li>Submit maintenance requests</li>
        <li>Update your contact information</li>
      </ul>
      
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${inviteUrl}</p>
      
      <p style="color: #666; font-size: 14px;">
        <em>This invitation will expire in 7 days.</em>
      </p>
      
      <p style="color: #666; font-size: 14px;">
        If you have any questions, please contact your property manager.
      </p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      
      <p style="color: #999; font-size: 12px;">
        Best regards,<br>
        Parks & Lots Team
      </p>
    </div>
  `;

  return await sendEmail({
    to: tenantEmail,
    from: fromEmail,
    subject,
    text,
    html
  });
}