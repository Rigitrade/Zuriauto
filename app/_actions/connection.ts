// emailService.js - Client-side email service for ZURIAUTO car rental booking
// Connects to the PHP email-service.php backend

import { Package, FormData } from "@/components/car-rental/booking/types";

// Get the current domain for the API URL
const EMAIL_API_URL =
  typeof window !== "undefined"
    ? process.env.NODE_ENV === "development"
      ? "http://localhost:8000/email.php" // Local PHP server
      : `${window.location.origin}/email.php` // Production
    : "/email.php";

/**
 * Test the email service connection
 */
export async function testEmailService() {
  try {
    const response = await fetch(EMAIL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "test",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Test failed");
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Email service test failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send user confirmation email for car rental booking
 */
export async function sendUserConfirmationEmail({
  formData,
  selectedPackage,
  days,
  totalPrice,
}: {
  formData: FormData;
  selectedPackage?: Package;
  days?: number;
  totalPrice?: string;
}) {
  try {
    const response = await fetch(EMAIL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "user_confirmation",
        formData,
        selectedPackage,
        days,
        totalPrice,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Failed to send confirmation email");
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Failed to send user confirmation email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send admin notification email for new booking request
 */
export async function sendAdminNotificationEmail({
  formData,
  selectedPackage,
  days,
  totalPrice,
  adminEmail = "info@zuriauto.ch",
}: {
  formData: FormData;
  selectedPackage?: Package;
  days?: number;
  totalPrice?: string;
  adminEmail?: string;
}) {
  try {
    const response = await fetch(EMAIL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "admin_notification",
        formData,
        selectedPackage,
        days,
        totalPrice,
        adminEmail,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Failed to send admin notification");
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Failed to send admin notification email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send both user confirmation and admin notification emails
 * This is the main function to use in the booking wizard
 */
export async function sendBookingEmails({
  formData,
  selectedPackage,
  days,
  totalPrice,
  adminEmail = "info@zuriauto.ch",
}: {
  formData: FormData;
  selectedPackage?: Package;
  days?: number;
  totalPrice?: string;
  adminEmail?: string;
}) {
  try {
    // Send both emails in parallel
    const [userResult, adminResult] = await Promise.all([
      sendUserConfirmationEmail({
        formData,
        selectedPackage,
        days,
        totalPrice,
      }),
      sendAdminNotificationEmail({
        formData,
        selectedPackage,
        days,
        totalPrice,
        adminEmail,
      }),
    ]);

    // Check if both emails were sent successfully
    if (!userResult.success || !adminResult.success) {
      const errors = [
        !userResult.success ? `User email: ${userResult.error}` : null,
        !adminResult.success ? `Admin email: ${adminResult.error}` : null,
      ].filter(Boolean);

      throw new Error(`Email sending failed: ${errors.join(", ")}`);
    }

    return {
      success: true,
      data: {
        userEmail: userResult.data,
        adminEmail: adminResult.data,
      },
    };
  } catch (error) {
    console.error("Failed to send booking emails:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generic email sender (for custom use cases)
 */
export async function sendCustomEmail({
  to,
  subject,
  html,
  replyTo,
  from,
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  from?: string;
}) {
  try {
    const response = await fetch(EMAIL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "custom",
        to,
        subject,
        html,
        replyTo,
        from,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Failed to send email");
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Failed to send custom email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Legacy support functions (for compatibility with existing code)
/**
 * @deprecated Use sendUserConfirmationEmail instead
 */
export async function generateUserConfirmationEmail(
  formData: FormData,
  selectedPackage: Package | undefined,
  days: number | undefined,
  totalPrice: string | undefined
) {
  console.warn(
    "generateUserConfirmationEmail is deprecated. Email generation is now handled by PHP backend."
  );
  return sendUserConfirmationEmail({
    formData,
    selectedPackage,
    days,
    totalPrice,
  });
}

/**
 * @deprecated Use sendAdminNotificationEmail instead
 */
export async function generateAdminNotificationEmail(
  formData: FormData,
  selectedPackage: Package | undefined,
  days: number | undefined,
  totalPrice: string | undefined
) {
  console.warn(
    "generateAdminNotificationEmail is deprecated. Email generation is now handled by PHP backend."
  );
  return sendAdminNotificationEmail({
    formData,
    selectedPackage,
    days,
    totalPrice,
  });
}

/**
 * @deprecated Use sendCustomEmail instead
 */
export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
  from,
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  from?: string;
}) {
  console.warn(
    "sendEmail is deprecated. Use sendCustomEmail or specific booking email functions."
  );
  return sendCustomEmail({
    to,
    subject,
    html,
    replyTo,
    from,
  });
}
