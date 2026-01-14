import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Get the frontend URL dynamically based on server's network IP
   * This allows emails to work correctly whether accessed locally or from network
   * Similar to how the frontend auto-detects the backend URL
   */
  getFrontendUrl() {
    // If FRONTEND_URL is explicitly set in .env, use it
    if (process.env.FRONTEND_URL && process.env.FRONTEND_URL !== 'http://localhost:5173') {
      return process.env.FRONTEND_URL;
    }

    // Otherwise, auto-detect based on server's network IP
    const networkIPs = this.getNetworkIPs();
    const port = process.env.PORT || 3001;

    // Use the first available network IP, or fallback to localhost
    const host = networkIPs.length > 0 ? networkIPs[0] : 'localhost';

    return `http://${host}:${port}`;
  }

  /**
   * Get all network IP addresses of the server
   * Returns an array of IPv4 addresses (excluding loopback)
   */
  getNetworkIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }

    return ips;
  }

  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        },
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates
        }
      });

      console.log('✅ Email service initialized');
      console.log(`📧 Email links will use: ${this.getFrontendUrl()}`);
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error.message);
    }
  }

  async sendEmail(to, subject, html, text = null, attachments = []) {
    if (!this.transporter) {
      console.error('❌ Email transporter not initialized');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@example.com',
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text: text || this.htmlToText(html),
        attachments: attachments.length > 0 ? attachments : undefined
      };

      console.log(`📧 Attempting to send email:`);
      console.log(`   To: ${to}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   From: ${mailOptions.from}`);

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`✅ Email sent successfully!`);
      console.log(`   To: ${to}`);
      console.log(`   Message ID: ${info.messageId}`);
      console.log(`   Response: ${info.response || 'N/A'}`);

      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
        to: to,
        subject: subject
      };
    } catch (error) {
      console.error(`❌ Failed to send email:`);
      console.error(`   To: ${to}`);
      console.error(`   Subject: ${subject}`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Error Code: ${error.code || 'N/A'}`);
      console.error(`   Error Stack: ${error.stack || 'N/A'}`);

      return {
        success: false,
        error: error.message,
        code: error.code,
        to: to,
        subject: subject
      };
    }
  }

  async testEmailConnection() {
    try {
      if (!this.transporter) {
        return {
          success: false,
          error: 'Email transporter not initialized',
          details: 'Check SMTP configuration in .env file'
        };
      }

      // Verify connection
      await this.transporter.verify();

      return {
        success: true,
        message: 'Email service is configured correctly',
        config: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER,
          from: process.env.EMAIL_FROM
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Email connection test failed',
        message: error.message,
        details: 'Check your SMTP settings in .env file'
      };
    }
  }

  async sendTestEmail(to) {
    const testSubject = 'Test Email - IT Equipment Request System';
    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>✅ Email Test Successful</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>This is a test email from the IT Equipment Request System.</p>
            <p>If you received this email, it means the email notification system is working correctly!</p>
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>Sent at: ${new Date().toLocaleString()}</li>
              <li>SMTP Host: ${process.env.SMTP_HOST}</li>
              <li>SMTP Port: ${process.env.SMTP_PORT}</li>
            </ul>
          </div>
          <div class="footer">
            <p>This is an automated test email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(to, testSubject, testHtml);
  }

  htmlToText(html) {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  // Email templates
  getRequestSubmittedTemplate(request, requestor, departmentApprover) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .button { display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Request Submitted Successfully</h2>
          </div>
          <div class="content">
            <p>Hello ${requestor.first_name} ${requestor.last_name},</p>
            <p>Your equipment request has been submitted successfully and is now pending department approval.</p>
            
            <div class="info-row">
              <span class="label">Request Number:</span> ${request.request_number}
            </div>
            <div class="info-row">
              <span class="label">Department:</span> ${request.Department?.name || 'N/A'}
            </div>
            <div class="info-row">
              <span class="label">Priority:</span> ${request.priority}
            </div>
            <div class="info-row">
              <span class="label">Submitted Date:</span> ${new Date(request.submitted_at || request.created_at).toLocaleString()}
            </div>
            
            <p>Your request is now awaiting approval from ${departmentApprover?.first_name} ${departmentApprover?.last_name} (Department Approver).</p>
            
            <a href="${this.getFrontendUrl()}/track?code=${request.request_number}" class="button">Track Your Request</a>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
            <p style="margin-top: 10px;">
              <a href="${process.env.FRONTEND_URL}/login" style="color: #2563eb; text-decoration: underline;">Access Login Portal</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getApprovalRequestTemplate(request, requestor, approver) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .button { display: inline-block; padding: 10px 20px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Request Pending Approval</h2>
          </div>
          <div class="content">
            <p>Hello ${approver.first_name} ${approver.last_name},</p>
            <p>A new equipment request requires your approval.</p>
            
            <div class="info-row">
              <span class="label">Request Number:</span> ${request.request_number}
            </div>
            <div class="info-row">
              <span class="label">Requestor:</span> ${requestor.first_name} ${requestor.last_name}
            </div>
            <div class="info-row">
              <span class="label">Department:</span> ${request.Department?.name || 'N/A'}
            </div>
            <div class="info-row">
              <span class="label">Priority:</span> ${request.priority}
            </div>
            <div class="info-row">
              <span class="label">Submitted Date:</span> ${new Date(request.submitted_at || request.created_at).toLocaleString()}
            </div>
            
            <a href="${this.getFrontendUrl()}/requests/${request.id}" class="button">Review Request</a>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
            <p style="margin-top: 10px;">
              <a href="${process.env.FRONTEND_URL}/login" style="color: #f59e0b; text-decoration: underline;">Access Login Portal</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRequestApprovedTemplate(request, requestor, approver, stage) {
    const stageNames = {
      'department_approval': 'Department Approval',
      'it_manager_approval': 'IT Manager Approval',
      'service_desk_processing': 'Service Desk Processing'
    };

    const nextStage = stage === 'department_approval' ? 'IT Manager' :
      stage === 'it_manager_approval' ? 'Service Desk' :
        'Completed';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .button { display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Request Approved</h2>
          </div>
          <div class="content">
            <p>Hello ${requestor.first_name} ${requestor.last_name},</p>
            <p>Your equipment request has been approved by ${approver.first_name} ${approver.last_name} (${stageNames[stage]}).</p>
            
            <div class="info-row">
              <span class="label">Request Number:</span> ${request.request_number}
            </div>
            <div class="info-row">
              <span class="label">Status:</span> ${request.status}
            </div>
            ${request.status === 'completed' ? `
            <div class="info-row">
              <span class="label">Completed Date:</span> ${new Date(request.completed_at || new Date()).toLocaleString()}
            </div>
            ` : `
            <p>Your request is now pending ${nextStage} review.</p>
            `}
            
            <a href="${this.getFrontendUrl()}/track?code=${request.request_number}" class="button">View Request Status</a>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
            <p style="margin-top: 10px;">
              <a href="${this.getFrontendUrl()}/login" style="color: #10b981; text-decoration: underline;">Access Login Portal</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRequestDeclinedTemplate(request, requestor, approver, comments) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .comments { background-color: #fee2e2; padding: 15px; border-left: 4px solid #ef4444; margin: 15px 0; }
          .button { display: inline-block; padding: 10px 20px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Request Declined</h2>
          </div>
          <div class="content">
            <p>Hello ${requestor.first_name} ${requestor.last_name},</p>
            <p>Unfortunately, your equipment request has been declined by ${approver.first_name} ${approver.last_name}.</p>
            
            <div class="info-row">
              <span class="label">Request Number:</span> ${request.request_number}
            </div>
            <div class="info-row">
              <span class="label">Status:</span> ${request.status}
            </div>
            
            ${comments ? `
            <div class="comments">
              <strong>Comments:</strong><br>
              ${comments}
            </div>
            ` : ''}
            
            <a href="${this.getFrontendUrl()}/track?code=${request.request_number}" class="button">View Request Details</a>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
            <p style="margin-top: 10px;">
              <a href="${this.getFrontendUrl()}/login" style="color: #ef4444; text-decoration: underline;">Access Login Portal</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRequestReturnedTemplate(request, requestor, approver, returnReason) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .comments { background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0; }
          .button { display: inline-block; padding: 10px 20px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Request Returned for Revision</h2>
          </div>
          <div class="content">
            <p>Hello ${requestor.first_name} ${requestor.last_name},</p>
            <p>Your equipment request has been returned by ${approver.first_name} ${approver.last_name} for revision.</p>
            
            <div class="info-row">
              <span class="label">Request Number:</span> ${request.request_number}
            </div>
            
            ${returnReason ? `
            <div class="comments">
              <strong>Revision Required:</strong><br>
              ${returnReason}
            </div>
            ` : ''}
            
            <p>Please review the comments above and update your request accordingly.</p>
            
            <a href="${this.getFrontendUrl()}/requests/${request.id}" class="button">Update Request</a>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
            <p style="margin-top: 10px;">
              <a href="${process.env.FRONTEND_URL}/login" style="color: #f59e0b; text-decoration: underline;">Access Login Portal</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Send notification methods
  async notifyRequestSubmitted(request, requestor, departmentApprover) {
    if (!requestor.email) {
      console.log(`⚠️ Skipping email - requestor ${requestor.username} has no email`);
      return;
    }

    const subject = `Request Submitted: ${request.request_number}`;
    const html = this.getRequestSubmittedTemplate(request, requestor, departmentApprover);

    return await this.sendEmail(requestor.email, subject, html);
  }

  async notifyApprovalRequired(request, requestor, approver) {
    if (!approver.email) {
      console.log(`⚠️ Skipping email - approver ${approver.username} has no email`);
      return;
    }

    const subject = `Action Required: Approve Request ${request.request_number}`;
    const html = this.getApprovalRequestTemplate(request, requestor, approver);

    return await this.sendEmail(approver.email, subject, html);
  }

  async notifyRequestApproved(request, requestor, approver, stage) {
    if (!requestor.email) {
      console.log(`⚠️ Skipping email - requestor ${requestor.username} has no email`);
      return;
    }

    const subject = `Request Approved: ${request.request_number}`;
    const html = this.getRequestApprovedTemplate(request, requestor, approver, stage);

    return await this.sendEmail(requestor.email, subject, html);
  }

  async notifyRequestDeclined(request, requestor, approver, comments) {
    if (!requestor.email) {
      console.log(`⚠️ Skipping email - requestor ${requestor.username} has no email`);
      return;
    }

    const subject = `Request Declined: ${request.request_number}`;
    const html = this.getRequestDeclinedTemplate(request, requestor, approver, comments);

    return await this.sendEmail(requestor.email, subject, html);
  }

  async notifyRequestReturned(request, requestor, approver, returnReason) {
    if (!requestor.email) {
      console.log(`⚠️ Skipping email - requestor ${requestor.username} has no email`);
      return;
    }

    const subject = `Request Returned for Revision: ${request.request_number}`;
    const html = this.getRequestReturnedTemplate(request, requestor, approver, returnReason);

    return await this.sendEmail(requestor.email, subject, html);
  }

  // Vehicle Request Email Methods
  async notifyVehicleRequestSubmitted(vehicleRequest, requestor, departmentApprover) {
    if (!requestor?.email) {
      console.log(`⚠️ Skipping email - requestor has no email`);
      return;
    }

    const subject = `Vehicle Request Submitted: ${vehicleRequest.reference_code || vehicleRequest.id}`;
    const html = this.getVehicleRequestSubmittedTemplate(vehicleRequest, requestor, departmentApprover);
    const attachments = await this.prepareAttachments(vehicleRequest.attachments);

    return await this.sendEmail(requestor.email, subject, html, null, attachments);
  }

  async notifyVehicleApprovalRequired(vehicleRequest, requestor, approver) {
    if (!approver?.email) {
      console.log(`⚠️ Skipping email - approver ${approver?.username || 'unknown'} has no email`);
      return;
    }

    const subject = `Action Required: Approve Vehicle Request ${vehicleRequest.reference_code || vehicleRequest.id}`;
    const html = this.getVehicleApprovalRequestTemplate(vehicleRequest, requestor, approver);
    const attachments = await this.prepareAttachments(vehicleRequest.attachments);

    return await this.sendEmail(approver.email, subject, html, null, attachments);
  }

  async notifyVehicleRequestApproved(vehicleRequest, requestor, approver, isCompleted = true, nextApprover = null, approverComments = null) {
    if (!requestor?.email) {
      console.log(`⚠️ Skipping email - requestor has no email`);
      return;
    }

    const subject = isCompleted
      ? `Vehicle Request Approved: ${vehicleRequest.reference_code || vehicleRequest.id}`
      : `Vehicle Request Approved - Pending Next Approval: ${vehicleRequest.reference_code || vehicleRequest.id}`;
    const html = this.getVehicleRequestApprovedTemplate(vehicleRequest, requestor, approver, isCompleted, nextApprover, approverComments);
    const attachments = await this.prepareAttachments(vehicleRequest.attachments);

    return await this.sendEmail(requestor.email, subject, html, null, attachments);
  }

  async notifyVehicleRequestDeclined(vehicleRequest, requestor, approver, comments) {
    if (!requestor?.email) {
      console.log(`⚠️ Skipping email - requestor has no email`);
      return;
    }

    const subject = `Vehicle Request Declined: ${vehicleRequest.reference_code || vehicleRequest.id}`;
    const html = this.getVehicleRequestDeclinedTemplate(vehicleRequest, requestor, approver, comments);
    const attachments = await this.prepareAttachments(vehicleRequest.attachments);

    return await this.sendEmail(requestor.email, subject, html, null, attachments);
  }

  async notifyVehicleRequestReturned(vehicleRequest, requestor, approver, returnReason) {
    if (!requestor?.email) {
      console.log(`⚠️ Skipping email - requestor has no email`);
      return;
    }

    const subject = `Vehicle Request Returned for Revision: ${vehicleRequest.reference_code || vehicleRequest.id}`;
    const html = this.getVehicleRequestReturnedTemplate(vehicleRequest, requestor, approver, returnReason);
    const attachments = await this.prepareAttachments(vehicleRequest.attachments);

    return await this.sendEmail(requestor.email, subject, html, null, attachments);
  }

  // Prepare attachments for email
  async prepareAttachments(attachments) {
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      return [];
    }

    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const { dirname } = await import('path');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'vehicle-requests');

    const emailAttachments = [];

    for (const attachment of attachments) {
      const filePath = path.join(uploadsDir, attachment.filename);

      if (fs.existsSync(filePath)) {
        emailAttachments.push({
          filename: attachment.originalName || attachment.filename,
          path: filePath
        });
      } else {
        console.warn(`⚠️ Attachment file not found: ${filePath}`);
      }
    }

    return emailAttachments;
  }

  // Vehicle Request Email Templates
  getVehicleRequestSubmittedTemplate(vehicleRequest, requestor, departmentApprover) {
    const requestorName = requestor.first_name && requestor.last_name
      ? `${requestor.first_name} ${requestor.last_name}`
      : requestor.username || vehicleRequest.requestor_name;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Vehicle Request Submitted Successfully</h2>
          </div>
          <div class="content">
            <p>Hello ${requestorName},</p>
            <p>Your vehicle request has been submitted successfully and is now pending department approval.</p>
            
            <div class="info-row">
              <span class="label">Reference Code:</span> ${vehicleRequest.reference_code || vehicleRequest.id}
            </div>
            <div class="info-row">
              <span class="label">Request Type:</span> ${vehicleRequest.request_type || 'N/A'}
            </div>
            <div class="info-row">
              <span class="label">Travel Date:</span> ${vehicleRequest.travel_date_from ? new Date(vehicleRequest.travel_date_from).toLocaleDateString() : 'N/A'}
            </div>
            <div class="info-row">
              <span class="label">Submitted Date:</span> ${new Date(vehicleRequest.submitted_at || vehicleRequest.requested_date || new Date()).toLocaleString()}
            </div>
            
            <p>Your request is now awaiting approval from ${departmentApprover ? `${departmentApprover.first_name || ''} ${departmentApprover.last_name || ''}`.trim() || departmentApprover.username : 'your department approver'}.</p>
            
            <p>You will be notified once your request has been reviewed.</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p style="margin-top: 10px;">
              <a href="${process.env.FRONTEND_URL}/login" style="color: #2563eb; text-decoration: underline;">Access Login Portal</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getVehicleApprovalRequestTemplate(vehicleRequest, requestor, approver) {
    const requestorName = requestor.first_name && requestor.last_name
      ? `${requestor.first_name} ${requestor.last_name}`
      : requestor.username || vehicleRequest.requestor_name;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .button { display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Action Required: Vehicle Request Approval</h2>
          </div>
          <div class="content">
            <p>Hello ${approver.first_name || approver.username},</p>
            <p>A new vehicle request requires your approval.</p>
            
            <div class="info-row">
              <span class="label">Reference Code:</span> ${vehicleRequest.reference_code || vehicleRequest.id}
            </div>
            <div class="info-row">
              <span class="label">Requestor:</span> ${requestorName}
            </div>
            <div class="info-row">
              <span class="label">Request Type:</span> ${vehicleRequest.request_type || 'N/A'}
            </div>
            <div class="info-row">
              <span class="label">Travel Date:</span> ${vehicleRequest.travel_date_from ? new Date(vehicleRequest.travel_date_from).toLocaleDateString() : 'N/A'}
            </div>
            ${vehicleRequest.purpose ? `<div class="info-row"><span class="label">Purpose:</span> ${vehicleRequest.purpose}</div>` : ''}
            ${vehicleRequest.attachments && vehicleRequest.attachments.length > 0 ? `
            <div class="info-row">
              <span class="label">Attachments:</span> ${vehicleRequest.attachments.length} file(s) attached
            </div>
            ` : ''}
            
            <p>Please review and approve or decline this request in the system.</p>
            <p style="margin-top: 15px;">
              <a href="${this.getFrontendUrl()}/login" style="display: inline-block; padding: 10px 20px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 5px;">Access Login Portal</a>
            </p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p style="margin-top: 10px;">
              <a href="${process.env.FRONTEND_URL}/login" style="color: #dc2626; text-decoration: underline;">Access Login Portal</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getVehicleRequestApprovedTemplate(vehicleRequest, requestor, approver, isCompleted = true, nextApprover = null, approverComments = null) {
    const requestorName = requestor.first_name && requestor.last_name
      ? `${requestor.first_name} ${requestor.last_name}`
      : requestor.username || vehicleRequest.requestor_name;
    const approverName = approver.first_name && approver.last_name
      ? `${approver.first_name} ${approver.last_name}`
      : approver.username;
    const nextApproverName = nextApprover && nextApprover.first_name && nextApprover.last_name
      ? `${nextApprover.first_name} ${nextApprover.last_name}`
      : nextApprover?.username || nextApprover?.email || 'the next approver';

    // Use approverComments if provided, otherwise fall back to vehicleRequest.comments
    const commentsToShow = approverComments || vehicleRequest.comments;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .pending-notice { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Vehicle Request Approved</h2>
          </div>
          <div class="content">
            <p>Hello ${requestorName},</p>
            ${isCompleted ? `
            <p>Your vehicle request has been approved and completed.</p>
            ` : `
            <p>Your vehicle request has been approved by ${approverName}.</p>
            <div class="pending-notice">
              <strong>Note:</strong> Your request is now pending approval from ${nextApproverName}. You will be notified once all approvals are complete.
            </div>
            `}
            
            <div class="info-row">
              <span class="label">Reference Code:</span> ${vehicleRequest.reference_code || vehicleRequest.id}
            </div>
            <div class="info-row">
              <span class="label">Approved By:</span> ${approverName}
            </div>
            <div class="info-row">
              <span class="label">Approval Date:</span> ${vehicleRequest.approval_date ? new Date(vehicleRequest.approval_date).toLocaleString() : new Date().toLocaleString()}
            </div>
            ${commentsToShow ? `<div class="info-row"><span class="label">Comments from ${approverName}:</span> ${commentsToShow}</div>` : ''}
            
            ${isCompleted ? `
            <p>Your vehicle request is now complete. Please contact your department for further arrangements.</p>
            ` : `
            <p>Your request will be processed further once all required approvals are received.</p>
            `}
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p style="margin-top: 10px;">
              <a href="${this.getFrontendUrl()}/login" style="color: #16a34a; text-decoration: underline;">Access Login Portal</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getVehicleRequestDeclinedTemplate(vehicleRequest, requestor, approver, comments) {
    const requestorName = requestor.first_name && requestor.last_name
      ? `${requestor.first_name} ${requestor.last_name}`
      : requestor.username || vehicleRequest.requestor_name;
    const approverName = approver.first_name && approver.last_name
      ? `${approver.first_name} ${approver.last_name}`
      : approver.username;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .reason-box { background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Vehicle Request Declined</h2>
          </div>
          <div class="content">
            <p>Hello ${requestorName},</p>
            <p>Unfortunately, your vehicle request has been declined.</p>
            
            <div class="info-row">
              <span class="label">Reference Code:</span> ${vehicleRequest.reference_code || vehicleRequest.id}
            </div>
            <div class="info-row">
              <span class="label">Declined By:</span> ${approverName}
            </div>
            ${comments ? `<div class="reason-box"><strong>Reason:</strong><br>${comments}</div>` : ''}
            
            <p>If you have any questions, please contact ${approverName}.</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p style="margin-top: 10px;">
              <a href="${process.env.FRONTEND_URL}/login" style="color: #dc2626; text-decoration: underline;">Access Login Portal</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getVehicleRequestReturnedTemplate(vehicleRequest, requestor, approver, returnReason) {
    const requestorName = requestor.first_name && requestor.last_name
      ? `${requestor.first_name} ${requestor.last_name}`
      : requestor.username || vehicleRequest.requestor_name;
    const approverName = approver.first_name && approver.last_name
      ? `${approver.first_name} ${approver.last_name}`
      : approver.username;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .reason-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Vehicle Request Returned for Revision</h2>
          </div>
          <div class="content">
            <p>Hello ${requestorName},</p>
            <p>Your vehicle request has been returned for revision.</p>
            
            <div class="info-row">
              <span class="label">Reference Code:</span> ${vehicleRequest.reference_code || vehicleRequest.id}
            </div>
            <div class="info-row">
              <span class="label">Returned By:</span> ${approverName}
            </div>
            ${returnReason ? `<div class="reason-box"><strong>Revision Required:</strong><br>${returnReason}</div>` : ''}
            
            <p>Please review the comments above and resubmit your request with the necessary changes.</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p style="margin-top: 10px;">
              <a href="${process.env.FRONTEND_URL}/login" style="color: #f59e0b; text-decoration: underline;">Access Login Portal</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getVehicleAttachmentUploadedTemplate(vehicleRequest, requestor, uploadedBy, attachmentCount) {
    const requestorName = requestor.first_name && requestor.last_name
      ? `${requestor.first_name} ${requestor.last_name}`
      : requestor.username || vehicleRequest.requestor_name;
    const uploaderName = uploadedBy.first_name && uploadedBy.last_name
      ? `${uploadedBy.first_name} ${uploadedBy.last_name}`
      : uploadedBy.username;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .attachment-box { background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Attachments Added to Vehicle Request</h2>
          </div>
          <div class="content">
            <p>Hello ${requestorName},</p>
            <p>New attachment(s) have been added to your vehicle request.</p>
            
            <div class="info-row">
              <span class="label">Reference Code:</span> ${vehicleRequest.reference_code || vehicleRequest.id}
            </div>
            <div class="info-row">
              <span class="label">Uploaded By:</span> ${uploaderName}
            </div>
            <div class="info-row">
              <span class="label">Number of Files:</span> ${attachmentCount}
            </div>
            <div class="info-row">
              <span class="label">Upload Date:</span> ${new Date().toLocaleString()}
            </div>
            
            <div class="attachment-box">
              <strong>📎 Attachments:</strong><br>
              ${attachmentCount} file(s) ${attachmentCount === 1 ? 'has' : 'have'} been attached to this request. Please check the request details in the system to view the files.
            </div>
            
            <p>You can view the attachments by accessing the request in the system.</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p style="margin-top: 10px;">
              <a href="${this.getFrontendUrl()}/login" style="color: #3b82f6; text-decoration: underline;">Access Login Portal</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async notifyVehicleAttachmentUploaded(vehicleRequest, requestor, uploadedBy, attachmentCount, newAttachments = []) {
    // Debug logging
    console.log('📧 notifyVehicleAttachmentUploaded called:');
    console.log('   Requestor object:', JSON.stringify(requestor, null, 2));
    console.log('   Requestor email:', requestor?.email);
    console.log('   Requestor email (alternative):', requestor?.email || requestor?.Email);

    if (!requestor?.email) {
      console.log(`⚠️ Skipping email - requestor has no email`);
      console.log(`   Available requestor fields:`, Object.keys(requestor || {}));
      return;
    }

    const subject = `New Attachments Added: ${vehicleRequest.reference_code || vehicleRequest.id}`;
    const html = this.getVehicleAttachmentUploadedTemplate(vehicleRequest, requestor, uploadedBy, attachmentCount);

    // Prepare only the newly uploaded attachments for email
    const emailAttachments = await this.prepareAttachments(newAttachments);

    return await this.sendEmail(requestor.email, subject, html, null, emailAttachments);
  }
}

// Export singleton instance
const emailService = new EmailService();
export default emailService;