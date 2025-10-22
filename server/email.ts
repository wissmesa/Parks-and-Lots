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
  const subject = 'Password Reset - MHP Sales Manager App';
  
  const text = `
Hello ${userName},

We received a request to reset your password for the MHP Sales Manager App.

Click the link below to reset your password:
${resetUrl}

This link will expire in 24 hours for security reasons.

If you did not request this password reset, please ignore this email and your password will remain unchanged.

Best regards,
MHP Sales Manager team
  `;

  const html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">Password Reset Request</h2>
      
      <p>Hello ${userName},</p>
      
      <p>We received a request to reset your password for MHP Sales Manager App.</p>
      
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
        MHP Sales Manager team
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
  const subject = 'You\'re invited to the MHP Sales Manager App';
  
  const text = `
Hello,

You've been invited by ${invitedByName} to join the MHP Sales Manager App.

Click the link below to accept your invitation and set up your account:
${inviteUrl}

This invitation will expire in 7 days.

Best regards,
MHP Sales Manager team
  `;

  const html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">You're invited to the MHP Sales Manager App</h2>
      
      <p>Hello,</p>
      
      <p>You've been invited by <strong>${invitedByName}</strong> to join the MHP Sales Manager App</p>
      
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
        MHP Sales Manager team
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
  const subject = 'Welcome the MHP Sales Manager App - Set Up Your Tenant Account';
  
  const text = `
Hello ${tenantName},

Welcome the MHP Sales Manager App! Your tenancy has been set up by ${createdByName}.

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
MHP Sales Manager team
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

export async function sendLotCreationNotification(
  lotData: {
    id: string;
    nameOrNumber: string;
    parkName?: string;
    status: string[];
    description?: string;
    bedrooms?: number | null;
    bathrooms?: number | null;
  },
  createdByName: string,
  fromEmail: string = 'support@bluepaperclip.com'
): Promise<boolean> {
  const recipients = ['luis@bluepaperclip.com', 'alem@bluepaperclip.com', 'nicole@bluepaperclip.com'];
  
  const subject = `New Lot Created: ${lotData.nameOrNumber}${lotData.parkName ? ` - ${lotData.parkName}` : ''}`;
  
  const statusText = lotData.status.join(', ');
  const bedroomsBathrooms = lotData.bedrooms || lotData.bathrooms 
    ? `${lotData.bedrooms || 'N/A'} Bedrooms, ${lotData.bathrooms || 'N/A'} bathrooms`
    : 'Not specified';
  
  const text = `
A new lot has been created in the MHP Sales Manager App

Lot Details:
- ID: ${lotData.id}
- Lot #: ${lotData.nameOrNumber}
${lotData.parkName ? `- Park: ${lotData.parkName}` : ''}
- Status: ${statusText}
- Bedrooms/Bathrooms: ${bedroomsBathrooms}
${lotData.description ? `- Description: ${lotData.description}` : ''}

Created by: ${createdByName}

Best regards,
MHP Sales Manager team
  `;

  const html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">🏠 New Lot Created</h2>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #007bff; margin-top: 0;">Lot Details</h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555;">ID:</td>
            <td style="padding: 8px 0; color: #333;">${lotData.id}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555;">Lot #:</td>
            <td style="padding: 8px 0; color: #333; font-size: 18px; font-weight: bold;">${lotData.nameOrNumber}</td>
          </tr>
          ${lotData.parkName ? `
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555;">Park:</td>
            <td style="padding: 8px 0; color: #333;">${lotData.parkName}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555;">Status:</td>
            <td style="padding: 8px 0; color: #333;">${statusText}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555;">Bedrooms/Bathrooms:</td>
            <td style="padding: 8px 0; color: #333;">${bedroomsBathrooms}</td>
          </tr>
          ${lotData.description ? `
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555; vertical-align: top;">Description:</td>
            <td style="padding: 8px 0; color: #333;">${lotData.description}</td>
          </tr>
          ` : ''}
        </table>
      </div>
      
      <p style="color: #666; font-size: 14px; margin-top: 20px;">
        <strong>Created by:</strong> ${createdByName}
      </p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      
      <p style="color: #999; font-size: 12px;">
        Best regards,<br>
        MHP Sales Manager team
      </p>
    </div>
  `;

  // Send to all recipients
  const promises = recipients.map(recipient => 
    sendEmail({
      to: recipient,
      from: fromEmail,
      subject,
      text,
      html
    })
  );

  try {
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Error sending lot creation notifications:', error);
    return false;
  }
}

export async function sendLotReactivationNotification(
  lotData: {
    id: string;
    nameOrNumber: string;
    parkName?: string;
    status: string[];
    description?: string;
    bedrooms?: number | null;
    bathrooms?: number | null;
  },
  reactivatedByName: string,
  fromEmail: string = 'support@bluepaperclip.com'
): Promise<boolean> {
  const recipients = ['luis@bluepaperclip.com', 'alem@bluepaperclip.com', 'nicole@bluepaperclip.com'];
  
  const subject = `Lot Reactivated: ${lotData.nameOrNumber}${lotData.parkName ? ` - ${lotData.parkName}` : ''}`;
  
  const statusText = lotData.status.join(', ');
  const bedroomsBathrooms = lotData.bedrooms || lotData.bathrooms 
    ? `${lotData.bedrooms || 'N/A'} Bedrooms, ${lotData.bathrooms || 'N/A'} bathrooms`
    : 'Not specified';
  
  const text = `
A lot has been reactivated and placed back on market in the MHP Sales Manager App

Lot Details:
- ID: ${lotData.id}
- Lot #: ${lotData.nameOrNumber}
${lotData.parkName ? `- Park: ${lotData.parkName}` : ''}
- Status: ${statusText}
- Bedrooms/Bathrooms: ${bedroomsBathrooms}
${lotData.description ? `- Description: ${lotData.description}` : ''}

Reactivated by: ${reactivatedByName}

Best regards,
MHP Sales Manager team
  `;

  const html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333; border-bottom: 2px solid #28a745; padding-bottom: 10px;">🔄 Lot Reactivated</h2>
      
      <p style="color: #555; font-size: 16px; background-color: #d4edda; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745;">
        This lot has been placed back on the market.
      </p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #28a745; margin-top: 0;">Lot Details</h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555;">ID:</td>
            <td style="padding: 8px 0; color: #333;">${lotData.id}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555;">Lot #:</td>
            <td style="padding: 8px 0; color: #333; font-size: 18px; font-weight: bold;">${lotData.nameOrNumber}</td>
          </tr>
          ${lotData.parkName ? `
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555;">Park:</td>
            <td style="padding: 8px 0; color: #333;">${lotData.parkName}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555;">Status:</td>
            <td style="padding: 8px 0; color: #333;">${statusText}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555;">Bedrooms/Bathrooms:</td>
            <td style="padding: 8px 0; color: #333;">${bedroomsBathrooms}</td>
          </tr>
          ${lotData.description ? `
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555; vertical-align: top;">Description:</td>
            <td style="padding: 8px 0; color: #333;">${lotData.description}</td>
          </tr>
          ` : ''}
        </table>
      </div>
      
      <p style="color: #666; font-size: 14px; margin-top: 20px;">
        <strong>Reactivated by:</strong> ${reactivatedByName}
      </p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      
      <p style="color: #999; font-size: 12px;">
        Best regards,<br>
        MHP Sales Manager team
      </p>
    </div>
  `;

  // Send to all recipients
  const promises = recipients.map(recipient => 
    sendEmail({
      to: recipient,
      from: fromEmail,
      subject,
      text,
      html
    })
  );

  try {
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Error sending lot reactivation notifications:', error);
    return false;
  }
}