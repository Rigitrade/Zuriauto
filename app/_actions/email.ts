// "use server";

import { FormData, Package } from "@/components/car-rental/booking/types";

import nodemailer from "nodemailer";

type EmailData = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  from?: string;
};

/**
 * Thrown when SMTP_USER or SMTP_PASS is absent, as opposed to a delivery
 * failure. Callers distinguish the two so the site can say "not configured"
 * instead of a generic "could not be sent", which is otherwise impossible to
 * diagnose from the browser.
 */
export class EmailNotConfiguredError extends Error {
  constructor() {
    super("SMTP_USER and SMTP_PASS are not set");
    this.name = "EmailNotConfiguredError";
  }
}

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
  from,
}: EmailData) {
  // Check required environment variables
  const SMTP_HOST = process.env.SMTP_HOST || "smtp.hostinger.com";
  const SMTP_PORT = process.env.SMTP_PORT || "465";
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;

  if (!SMTP_USER || !SMTP_PASS) {
    throw new EmailNotConfiguredError();
  }

  try {
    // Create transporter using SMTP settings
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT),
      secure: true, // Use SSL/TLS for port 465
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
      // Serverless functions are killed at their timeout (10s by default on
      // Vercel's Hobby plan). Without these, an unreachable or slow SMTP host
      // hangs until the platform kills the function, which surfaces as an
      // opaque failure with nothing useful in the logs.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
    });

    const senderEmail = from || SMTP_USER;

    const mailOptions = {
      from: `ZURIAUTO <${senderEmail}>`,
      to,
      subject,
      html,
      ...(replyTo && { replyTo }),
    };

    await transporter.sendMail(mailOptions);

    return { success: true };
  } catch (error) {
    console.error("Failed to send email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Generates the user-facing booking confirmation email HTML.
 * UPDATED for package-based booking (3-step flow).
 * @param formData The complete form data from the booking wizard.
 * @returns A promise that resolves to the HTML content of the email.
 */
export const generateUserConfirmationEmail = async (
  formData: FormData,
  selectedPackage?: Package,
  days?: number,
  totalPrice?: string
): Promise<string> => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmation</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07); }
        .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 2rem 1.5rem; text-align: center; }
        .header h1 { margin: 0; font-size: 2rem; font-weight: 700; letter-spacing: 3px; }
        .header p { margin: 0.5rem 0 0 0; opacity: 0.9; font-size: 1.1rem; }
        .content { padding: 2rem 1.5rem; }
        .status-section { text-align: center; margin-bottom: 2rem; }
        .status-section h2 { color: #1e293b; margin-bottom: 1rem; font-size: 1.5rem; }
        .status-badge { background-color: #fef3c7; color: #92400e; padding: 0.5rem 1rem; border-radius: 25px; font-size: 0.875rem; font-weight: 600; display: inline-block; }
        .booking-reference { background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-left: 4px solid #3b82f6; padding: 1.5rem; margin: 1.5rem 0; border-radius: 8px; }
        .booking-reference h3 { margin-top: 0; color: #1e293b; font-size: 1.1rem; }
        .booking-reference p { font-family: 'Courier New', monospace; font-size: 1.1rem; font-weight: bold; margin: 0.5rem 0 0 0; color: #3b82f6; }
        .section { margin-bottom: 2rem; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
        .section-header { background-color: #f8fafc; padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; }
        .section-header h2 { color: #1e293b; font-size: 1.2rem; margin: 0; font-weight: 600; }
        .section-content { padding: 1.5rem; }
        .info-grid { display: grid; gap: 1rem; }
        .info-item { display: flex; justify-content: space-between; align-items: flex-start; padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9; }
        .info-item:last-child { border-bottom: none; }
        .info-label { font-weight: 600; color: #64748b; min-width: 120px; flex-shrink: 0; }
        .info-value { color: #1e293b; text-align: right; flex-grow: 1; }
        .total-section { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 2rem; margin: 2rem 0; text-align: center; border-radius: 12px; }
        .total-label { font-size: 1.1rem; margin-bottom: 0.5rem; opacity: 0.9; }
        .total-amount { font-size: 2.5rem; font-weight: 700; margin: 0.5rem 0; }
        .total-duration { font-size: 1rem; opacity: 0.8; }
        .next-steps { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 1px solid #a7f3d0; padding: 1.5rem; border-radius: 12px; margin: 2rem 0; }
        .next-steps h3 { margin-top: 0; color: #065f46; font-size: 1.2rem; }
        .next-steps ul { color: #064e3b; margin: 0; padding-left: 1.25rem; line-height: 1.7; }
        .footer { background-color: #64748b; color: white; padding: 1.5rem; text-align: center; font-size: 0.875rem; }
        .footer p { margin: 0.5rem 0; }
        @media (max-width: 640px) {
            .info-item { flex-direction: column; align-items: flex-start; gap: 0.25rem; }
            .info-value { text-align: left; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ZURIAUTO</h1>
            <p>Premium Car Rental Service</p>
        </div>
        <div class="content">
            <div class="status-section">
                <h2>Booking Confirmation</h2>
                <span class="status-badge">PENDING CONFIRMATION</span>
            </div>
            <p>Dear ${formData.firstName} ${formData.lastName},</p>
            <p>Thank you for choosing ZURIAUTO! We have received your car rental reservation and will process it shortly.</p>
            <div class="booking-reference">
                <h3>Booking Reference</h3>
                <p>#BR-${Date.now()}</p>
            </div>
            <div class="section">
                <div class="section-header"><h2>Customer Information</h2></div>
                <div class="section-content">
                    <div class="info-grid">
                        <div class="info-item"><span class="info-label">Name</span><span class="info-value">${
                          formData.firstName
                        } ${formData.lastName}</span></div>
                        <div class="info-item"><span class="info-label">Email</span><span class="info-value">${
                          formData.email
                        }</span></div>
                        <div class="info-item"><span class="info-label">Phone</span><span class="info-value">+${
                          formData.phone
                        }</span></div>
                        ${
                          formData.bookingType === "company"
                            ? `<div class="info-item"><span class="info-label">Company</span><span class="info-value">${formData.companyName}</span></div>`
                            : ""
                        }
                    </div>
                </div>
            </div>
            <div class="section">
                <div class="section-header"><h2>Booking Details</h2></div>
                <div class="section-content">
                    <div class="info-grid">
                        <div class="info-item"><span class="info-label">Package Type</span><span class="info-value">${
                          selectedPackage?.name || "N/A"
                        }</span></div>
                        <div class="info-item"><span class="info-label">Pickup</span><span class="info-value">${
                          formData.pickupLocation
                        }</span></div>
                        <div class="info-item"><span class="info-label">Pickup Date</span><span class="info-value">${
                          formData.pickupDate
                        } at ${formData.pickupTime}</span></div>
                        <div class="info-item"><span class="info-label">Dropoff</span><span class="info-value">${
                          formData.dropoffLocation
                        }</span></div>
                        <div class="info-item"><span class="info-label">Dropoff Date</span><span class="info-value">${
                          formData.dropoffDate
                        } at ${formData.dropoffTime}</span></div>
                        <div class="info-item"><span class="info-label">Duration</span><span class="info-value">${days} day(s)</span></div>
                    </div>
                </div>
            </div>
            <div class="total-section">
                <div class="total-label">Estimated Total</div>
                <div class="total-amount">${totalPrice}</div>
                <div class="total-duration">For ${days} day(s)</div>
            </div>
            <div class="next-steps">
                <h3>What happens next?</h3>
                <ul>
                    <li>We will review your booking request within 24 hours.</li>
                    <li>You will receive a confirmation email with payment instructions.</li>
                    <li>Please ensure you have a valid driver's license for pickup.</li>
                </ul>
            </div>
            <p><strong>Best regards,</strong><br>The ZURIAUTO Team</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ZURIAUTO Car Rental. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `;
};

/**
 * Generates the admin notification email HTML for a new booking request.
 * UPDATED for package-based booking (3-step flow).
 * @param formData The complete form data from the booking wizard.
 * @returns A promise that resolves to the HTML content of the email.
 */
export const generateAdminNotificationEmail = async (
  formData: FormData,
  selectedPackage?: Package,
  days?: number,
  totalPrice?: string
): Promise<string> => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Booking Request</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; line-height: 1.6; }
        .container { max-width: 700px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07); }
        .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 1.5rem; text-align: center; }
        .header h1 { margin: 0; font-size: 1.5rem; font-weight: 700; }
        .alert { background-color: #fef2f2; border-left: 4px solid #dc2626; color: #991b1b; padding: 1rem 1.5rem; margin: 0; font-weight: 500; }
        .content { padding: 1.5rem; }
        .booking-reference { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 1.5rem; text-align: center; margin: 1.5rem 0; border-radius: 8px; }
        .booking-reference h2 { margin: 0; font-size: 1.25rem; }
        .booking-reference p { margin: 0.5rem 0 0 0; opacity: 0.9; }
        .section { margin-bottom: 1.5rem; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        .section-header { background-color: #f8fafc; padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; }
        .section-header h2 { margin: 0; font-size: 1.1rem; color: #1e293b; font-weight: 600; }
        .section-content { background-color: white; padding: 0; }
        .info-table { width: 100%; border-collapse: collapse; }
        .info-table td { padding: 0.75rem 1.5rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        .info-table tr:last-child td { border-bottom: none; }
        .info-table td:first-child { font-weight: 600; color: #64748b; width: 180px; background-color: #f8fafc; }
        .info-table td:last-child { color: #1e293b; }
        .financial-summary { background-color: #fffbeb; border-left: 4px solid #f59e0b; }
        .total-row { background-color: #1e293b !important; color: white !important; }
        .total-row td { font-weight: 700 !important; font-size: 1.1rem !important; color: white !important; }
        .actions-section { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 1.5rem; text-align: center; margin: 1.5rem 0; border-radius: 8px; }
        .actions-section h2 { margin: 0 0 1rem 0; font-size: 1.2rem; }
        .actions-list { text-align: left; max-width: 500px; margin: 0 auto; padding-left: 1.25rem; }
        .contact-button { background-color: #059669; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; margin-top: 1rem; }
        .footer { background-color: #64748b; color: white; padding: 1rem; text-align: center; font-size: 0.875rem; }
        @media (max-width: 480px) {
            .info-table td { display: block; width: 100% !important; }
            .info-table td:first-child { background-color: #f1f5f9; border-bottom: none; padding-bottom: 0.25rem; }
            .info-table td:last-child { padding-top: 0.25rem; border-bottom: 1px solid #f1f5f9; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>🚗 NEW BOOKING REQUEST</h1></div>
        <div class="alert"><strong>Action Required:</strong> A new car rental booking has been submitted.</div>
        <div class="content">
            <div class="booking-reference">
                <h2>Booking Reference: #BR-${Date.now()}</h2>
                <p>Submitted: ${new Date().toLocaleString()}</p>
            </div>
            <div class="section">
                <div class="section-header"><h2>👤 Customer Information</h2></div>
                <div class="section-content">
                    <table class="info-table">
                        <tr><td>Full Name</td><td>${formData.firstName} ${
    formData.lastName
  }</td></tr>
                        <tr><td>Email</td><td><a href="mailto:${
                          formData.email
                        }" style="color: #3b82f6;">${
    formData.email
  }</a></td></tr>
                        <tr><td>Phone</td><td><a href="tel:+${
                          formData.phone
                        }" style="color: #3b82f6;">+${
    formData.phone
  }</a></td></tr>
                        <tr><td>Date of Birth</td><td>${
                          formData.dateOfBirth
                        }</td></tr>
                        <tr><td>Address</td><td>${formData.street}, ${
    formData.postalCode
  }, ${formData.country}</td></tr>
                        <tr><td>License Number</td><td>${
                          formData.licenseNumber
                        }</td></tr>
                        <tr><td>License Since</td><td>${
                          formData.licenseSince
                        }</td></tr>
                        <tr><td>Issuing Authority</td><td>${
                          formData.issuingCity
                        }, ${formData.issuingCountry}</td></tr>
                        <tr><td>Booking Type</td><td>${
                          formData.bookingType
                        }</td></tr>
                        ${
                          formData.bookingType === "company"
                            ? `<tr><td>Company Name</td><td>${formData.companyName}</td></tr>`
                            : ""
                        }
                    </table>
                </div>
            </div>
            <div class="section">
                <div class="section-header"><h2>📅 Booking Details</h2></div>
                <div class="section-content">
                    <table class="info-table">
                        <tr><td>Package Type</td><td>${
                          selectedPackage?.name || "N/A"
                        }</td></tr>
                        <tr><td>Pickup Location</td><td>${
                          formData.pickupLocation
                        }</td></tr>
                        <tr><td>Pickup Date & Time</td><td>${
                          formData.pickupDate
                        } at ${formData.pickupTime}</td></tr>
                        <tr><td>Dropoff Location</td><td>${
                          formData.dropoffLocation
                        }</td></tr>
                        <tr><td>Dropoff Date & Time</td><td>${
                          formData.dropoffDate
                        } at ${formData.dropoffTime}</td></tr>
                        <tr><td>Rental Duration</td><td>${days} day(s)</td></tr>
                    </table>
                </div>
            </div>
            <div class="section financial-summary">
                <div class="section-header"><h2>💰 Financial Summary</h2></div>
                <div class="section-content">
                    <table class="info-table">
                        <tr><td>Package Cost</td><td>${
                          selectedPackage?.price || "N/A"
                        }</td></tr>
                        <tr class="total-row">
                            <td>TOTAL ESTIMATED</td><td>${totalPrice}</td>
                        </tr>
                    </table>
                </div>
            </div>
            <div class="actions-section">
                <h2>⚡ Actions Required</h2>
                <ul class="actions-list">
                    <li>Verify customer information and license validity.</li>
                    <li>Confirm package details and availability.</li>
                    <li>Send confirmation email to customer with payment instructions.</li>
                </ul>
                <div style="margin-top: 1.5rem;">
                    <a href="mailto:${
                      formData.email
                    }?subject=Re: Your Car Rental Booking Request" class="contact-button">
                        Reply to Customer
                    </a>
                </div>
            </div>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ZURIAUTO Car Rental - Admin Dashboard</p>
        </div>
    </div>
</body>
</html>
  `;
};
