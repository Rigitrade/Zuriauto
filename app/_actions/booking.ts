"use server";

import type {
  FormData,
  Package,
} from "@/components/car-rental/booking/types";
import {
  generateAdminNotificationEmail,
  generateUserConfirmationEmail,
  sendEmail,
} from "./email";

/**
 * Booking mailer, as a server action.
 *
 * Replaces public/email.php, which could not work on Vercel: there is no PHP
 * runtime, so that file was served as static text - exposing its hardcoded SMTP
 * credentials and silently failing to send anything. Credentials now come from
 * the SMTP_USER and SMTP_PASS environment variables only.
 *
 * A server action rather than a route handler because `trailingSlash: true` in
 * next.config.ts makes Next 308-redirect /api/x to /api/x/, which then 404s.
 * Actions are not routed by URL, so the two settings cannot conflict.
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "info@zuriauto.ch";

// Kept identical to the subjects the PHP backend used, so nothing changes in
// customers' or staff inboxes.
const USER_SUBJECT = "Booking Confirmation - ZURIAUTO";
const ADMIN_SUBJECT_PREFIX = "New Car Rental Booking Request - ";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BookingResult = { success: boolean; error?: string };

export async function submitBooking(payload: {
  formData: FormData;
  selectedPackage?: Package;
  days?: number;
  totalPrice?: string;
}): Promise<BookingResult> {
  const { formData, selectedPackage, days, totalPrice } = payload ?? {};

  if (!formData?.firstName || !formData?.lastName || !formData?.email) {
    return { success: false, error: "Missing required customer information" };
  }
  if (!EMAIL_RE.test(formData.email)) {
    return { success: false, error: "Invalid email address" };
  }

  try {
    const [userHtml, adminHtml] = await Promise.all([
      generateUserConfirmationEmail(
        formData,
        selectedPackage,
        days,
        totalPrice
      ),
      generateAdminNotificationEmail(
        formData,
        selectedPackage,
        days,
        totalPrice
      ),
    ]);

    const [userResult, adminResult] = await Promise.all([
      sendEmail({ to: formData.email, subject: USER_SUBJECT, html: userHtml }),
      sendEmail({
        to: ADMIN_EMAIL,
        subject: `${ADMIN_SUBJECT_PREFIX}${formData.firstName} ${formData.lastName}`,
        html: adminHtml,
        replyTo: formData.email,
      }),
    ]);

    if (!userResult.success || !adminResult.success) {
      console.error(
        "Booking email failure:",
        [
          userResult.success ? null : `customer: ${userResult.error}`,
          adminResult.success ? null : `admin: ${adminResult.error}`,
        ]
          .filter(Boolean)
          .join("; ")
      );
      return { success: false, error: "The booking email could not be sent" };
    }

    return { success: true };
  } catch (error) {
    // sendEmail throws when SMTP_USER or SMTP_PASS is unset. Log the detail and
    // return something generic, since this value reaches the browser.
    console.error(
      "Booking mailer error:",
      error instanceof Error ? error.message : error
    );
    return { success: false, error: "The booking email could not be sent" };
  }
}
