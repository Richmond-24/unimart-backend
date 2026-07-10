const nodemailer = require('nodemailer');

/**
 * Email Service for sending emails
 * Supports multiple email providers
 */

// Configure transporter based on environment
const createTransporter = () => {
  // Helper: Gmail App Passwords are displayed with spaces but must be sent without them.
  const sanitizePassword = (pw) => (pw || '').replace(/\s+/g, '');

  // Preferred providers
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: sanitizePassword(process.env.EMAIL_PASSWORD),
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  }

  if (process.env.EMAIL_SERVICE === 'sendgrid') {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  }

  // Fallback to generic SMTP when SMTP_HOST and SMTP_USER are configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true' || false,
      auth: {
        user: process.env.SMTP_USER,
        pass: sanitizePassword(process.env.SMTP_PASS),
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  }

  // Default: Use test account (for development/testing)
  return nodemailer.createTransport({
    host: 'smtp.mailtrap.io',
    port: 2525,
    auth: {
      user: process.env.MAILTRAP_USER || 'test',
      pass: process.env.MAILTRAP_PASSWORD || 'test',
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });
};

// Only send email when a provider is actually configured. Otherwise skip the
// SMTP connection entirely so email can never delay or break API responses.
const isEmailConfigured = () => {
  const service = process.env.EMAIL_SERVICE;
  if (service === 'gmail') return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
  if (service === 'sendgrid') return Boolean(process.env.SENDGRID_API_KEY);
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return true;
  return Boolean(process.env.MAILTRAP_USER && process.env.MAILTRAP_PASSWORD);
};

const emailEnabled = isEmailConfigured();
const transporter = emailEnabled ? createTransporter() : null;

if (!emailEnabled) {
  console.warn('⚠️  Email provider not configured — skipping all outbound email (API unaffected)');
}

/**
 * Send verification email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} verificationLink - Verification link
 */
const sendVerificationEmail = async (email, firstName, verificationLink) => {
  if (!transporter) return false;
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@unimart.com',
    to: email,
    subject: '✉️ Verify Your UniMart Email Address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0D9488 0%, #0F766E 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to UniMart!</h1>
        </div>
        
        <div style="background: #f8f8f8; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Hi <strong>${firstName}</strong>,</p>
          
          <p>Thank you for joining UniMart, your university's favorite marketplace! To get started, please verify your email address by clicking the button below.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background: #0D9488; color: white; padding: 12px 32px; border-radius: 4px; text-decoration: none; display: inline-block; font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          
          <p style="color: #666; font-size: 13px;">
            If you didn't create this account, you can ignore this email. This link expires in 24 hours.
          </p>
          
          <p style="color: #999; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px;">
            UniMart Team<br>
            Campus Marketplace Platform
          </p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    return false;
  }
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} resetLink - Password reset link
 */
const sendPasswordResetEmail = async (email, firstName, resetLink) => {
  if (!transporter) return false;
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@unimart.com',
    to: email,
    subject: '🔐 Reset Your UniMart Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B1A 0%, #E55100 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Password Reset Request</h1>
        </div>
        
        <div style="background: #f8f8f8; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Hi <strong>${firstName}</strong>,</p>
          
          <p>We received a request to reset your password. Click the button below to create a new password.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: #FF6B1A; color: white; padding: 12px 32px; border-radius: 4px; text-decoration: none; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; font-size: 13px; background: #fff3cd; padding: 12px; border-radius: 4px;">
            ⏱️ <strong>This link expires in 30 minutes.</strong> If you didn't request this, please ignore this email and your password will remain unchanged.
          </p>
          
          <p style="color: #999; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px;">
            UniMart Team<br>
            Campus Marketplace Platform
          </p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return false;
  }
};

/**
 * Send welcome email after successful registration
 * @param {string} email - User email
 * @param {string} firstName - User first name
 */
const sendWelcomeEmail = async (email, firstName) => {
  if (!transporter) return false;
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@unimart.com',
    to: email,
    subject: '🎉 Welcome to UniMart Campus Marketplace!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0D9488 0%, #4F46E5 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to UniMart! 🎉</h1>
        </div>
        
        <div style="background: #f8f8f8; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Hi <strong>${firstName}</strong>,</p>
          
          <p>Your UniMart account is ready to go! You can now:</p>
          
          <ul style="color: #333;">
            <li>Browse thousands of products from campus sellers</li>
            <li>Get exclusive student discounts and flash deals</li>
            <li>Buy and sell items within your university community</li>
            <li>Connect with other students and campus businesses</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL || 'https://unimart.app'}" style="background: #0D9488; color: white; padding: 12px 32px; border-radius: 4px; text-decoration: none; display: inline-block; font-weight: bold;">
              Start Shopping Now
            </a>
          </div>
          
          <p style="color: #666; font-size: 13px;">
            Have questions? Check out our <a href="#" style="color: #0D9488; text-decoration: none;">Help Center</a> or reply to this email.
          </p>
          
          <p style="color: #999; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px;">
            UniMart Team<br>
            Campus Marketplace Platform
          </p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return false;
  }
};

/**
 * Send seller approval notification
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} shopName - Shop name
 */
const sendSellerApprovalEmail = async (email, firstName, shopName) => {
  if (!transporter) return false;
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@unimart.com',
    to: email,
    subject: '✅ Your Seller Account Has Been Approved!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">✅ Seller Account Approved!</h1>
        </div>
        
        <div style="background: #f8f8f8; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Hi <strong>${firstName}</strong>,</p>
          
          <p>Congratulations! Your seller account for <strong>${shopName}</strong> has been approved. You can now:</p>
          
          <ul style="color: #333;">
            <li>Upload and manage your products</li>
            <li>Receive and process orders</li>
            <li>Communicate with buyers</li>
            <li>Access seller analytics and insights</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL || 'https://unimart.app'}/seller/dashboard" style="background: #10B981; color: white; padding: 12px 32px; border-radius: 4px; text-decoration: none; display: inline-block; font-weight: bold;">
              Go to Seller Dashboard
            </a>
          </div>
          
          <p style="color: #999; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px;">
            UniMart Team<br>
            Campus Marketplace Platform
          </p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Seller approval email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending seller approval email:', error);
    return false;
  }
};

/**
 * Test email configuration
 */
const testEmailConfiguration = async () => {
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log('✅ Email configuration is working');
    return true;
  } catch (error) {
    console.error('❌ Email configuration error:', error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendSellerApprovalEmail,
  testEmailConfiguration,
};
