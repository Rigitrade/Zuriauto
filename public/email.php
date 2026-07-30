<?php
// Disable HTML error output and force JSON responses
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Start output buffering to catch any unexpected output
ob_start();

// Ensure we always return JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    ob_end_clean();
    exit(0);
}

// Function to safely return JSON and exit
function returnJson($data, $status = 200) {
    ob_end_clean(); // Clear any buffered output
    http_response_code($status);
    echo json_encode($data);
    exit;
}

// Function to log errors safely
function logError($message) {
    $timestamp = date('Y-m-d H:i:s');
    error_log("[ZURIAUTO-EMAIL] $timestamp - $message");
}

try {
    // Only allow POST requests (except OPTIONS)
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        returnJson(['success' => false, 'error' => 'Method not allowed'], 405);
    }

    // Email configuration - You can set these as environment variables or constants
    $SMTP_HOST = $_ENV['SMTP_HOST'] ?? 'smtp.hostinger.com';
    $SMTP_PORT = $_ENV['SMTP_PORT'] ?? '465';
    $SMTP_USER = $_ENV['SMTP_USER'] ?? 'hi@primaswiss.com';
    $SMTP_PASS = $_ENV['SMTP_PASS'] ?? 'Prima4swiss+';
    $FROM_EMAIL = 'info@zuriauto.ch'; // Default from email
    $FROM_NAME = 'ZURIAUTO';

    logError("Email service started");

    // Email sending function using PHPMailer or built-in mail()
    function sendEmail($to, $subject, $html, $replyTo = null, $from = null) {
        global $SMTP_HOST, $SMTP_PORT, $SMTP_USER, $SMTP_PASS, $FROM_EMAIL, $FROM_NAME;
        
        if (empty($SMTP_USER) || empty($SMTP_PASS)) {
            logError("Missing SMTP credentials");
            return ['success' => false, 'error' => 'Missing email configuration'];
        }
        
        logError("Attempting to send email to: $to");
        
        // Use PHPMailer if available, otherwise fall back to mail()
        if (class_exists('PHPMailer\PHPMailer\PHPMailer')) {
            return sendEmailWithPHPMailer($to, $subject, $html, $replyTo, $from);
        } else {
            return sendEmailWithBuiltIn($to, $subject, $html, $replyTo, $from);
        }
    }

    // PHPMailer implementation (preferred)
    function sendEmailWithPHPMailer($to, $subject, $html, $replyTo = null, $from = null) {
        global $SMTP_HOST, $SMTP_PORT, $SMTP_USER, $SMTP_PASS, $FROM_EMAIL, $FROM_NAME;
        
        require_once 'PHPMailer/src/Exception.php';
        require_once 'PHPMailer/src/PHPMailer.php';
        require_once 'PHPMailer/src/SMTP.php';
        
        $mail = new PHPMailer\PHPMailer\PHPMailer(true);
        
        try {
            // Server settings
            $mail->isSMTP();
            $mail->Host = $SMTP_HOST;
            $mail->SMTPAuth = true;
            $mail->Username = $SMTP_USER;
            $mail->Password = $SMTP_PASS;
            $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port = intval($SMTP_PORT);
            
            // Recipients
            $senderEmail = $from ?: $SMTP_USER;
            $mail->setFrom($senderEmail, $FROM_NAME);
            $mail->addAddress($to);
            
            if ($replyTo && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
                $mail->addReplyTo($replyTo);
            }
            
            // Content
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $html;
            
            $mail->send();
            logError("Email sent successfully via PHPMailer");
            return ['success' => true];
            
        } catch (Exception $e) {
            logError("PHPMailer Error: " . $mail->ErrorInfo);
            return ['success' => false, 'error' => $mail->ErrorInfo];
        }
    }

    // Built-in mail() fallback
    function sendEmailWithBuiltIn($to, $subject, $html, $replyTo = null, $from = null) {
        global $FROM_EMAIL, $FROM_NAME;
        
        $senderEmail = $from ?: $FROM_EMAIL;
        
        $headers = [
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            "From: ZURIAUTO <$senderEmail>",
            'X-Mailer: PHP/' . phpversion(),
            'X-Priority: 3',
            'X-MSMail-Priority: Normal',
            'Importance: Normal'
        ];
        
        if ($replyTo && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
            $headers[] = "Reply-To: $replyTo";
        }
        
        $headerString = implode("\r\n", $headers);
        $success = mail($to, $subject, $html, $headerString);
        
        logError("Email send result (built-in): " . ($success ? 'Success' : 'Failed'));
        
        return [
            'success' => $success,
            'error' => $success ? null : 'Failed to send email'
        ];
    }

    // Generate user confirmation email HTML
    function generateUserConfirmationEmail($formData, $selectedPackage = null, $days = null, $totalPrice = null) {
        $bookingRef = '#BR-' . time();
        $currentYear = date('Y');
        
        $packageName = $selectedPackage['name'] ?? 'N/A';
        $packagePrice = $selectedPackage['price'] ?? 'N/A';
        
        $companyRow = '';
        if ($formData['bookingType'] === 'company' && !empty($formData['companyName'])) {
            $companyRow = '<div class="info-item"><span class="info-label">Company</span><span class="info-value">' . htmlspecialchars($formData['companyName']) . '</span></div>';
        }
        
        return '
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmation</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; line-height: 1.6; }
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
        .booking-reference p { font-family: "Courier New", monospace; font-size: 1.1rem; font-weight: bold; margin: 0.5rem 0 0 0; color: #3b82f6; }
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
            <p>Dear ' . htmlspecialchars($formData['firstName']) . ' ' . htmlspecialchars($formData['lastName']) . ',</p>
            <p>Thank you for choosing ZURIAUTO! We have received your car rental reservation and will process it shortly.</p>
            <div class="booking-reference">
                <h3>Booking Reference</h3>
                <p>' . $bookingRef . '</p>
            </div>
            <div class="section">
                <div class="section-header"><h2>Customer Information</h2></div>
                <div class="section-content">
                    <div class="info-grid">
                        <div class="info-item"><span class="info-label">Name</span><span class="info-value">' . htmlspecialchars($formData['firstName']) . ' ' . htmlspecialchars($formData['lastName']) . '</span></div>
                        <div class="info-item"><span class="info-label">Email</span><span class="info-value">' . htmlspecialchars($formData['email']) . '</span></div>
                        <div class="info-item"><span class="info-label">Phone</span><span class="info-value">+' . htmlspecialchars($formData['phone']) . '</span></div>
                        ' . $companyRow . '
                    </div>
                </div>
            </div>
            <div class="section">
                <div class="section-header"><h2>Booking Details</h2></div>
                <div class="section-content">
                    <div class="info-grid">
                        <div class="info-item"><span class="info-label">Package Type</span><span class="info-value">' . htmlspecialchars($packageName) . '</span></div>
                        <div class="info-item"><span class="info-label">Pickup</span><span class="info-value">' . htmlspecialchars($formData['pickupLocation']) . '</span></div>
                        <div class="info-item"><span class="info-label">Pickup Date</span><span class="info-value">' . htmlspecialchars($formData['pickupDate']) . ' at ' . htmlspecialchars($formData['pickupTime']) . '</span></div>
                        <div class="info-item"><span class="info-label">Dropoff</span><span class="info-value">' . htmlspecialchars($formData['dropoffLocation']) . '</span></div>
                        <div class="info-item"><span class="info-label">Dropoff Date</span><span class="info-value">' . htmlspecialchars($formData['dropoffDate']) . ' at ' . htmlspecialchars($formData['dropoffTime']) . '</span></div>
                        <div class="info-item"><span class="info-label">Duration</span><span class="info-value">' . ($days ?: 'N/A') . ' day(s)</span></div>
                    </div>
                </div>
            </div>
            <div class="total-section">
                <div class="total-label">Estimated Total</div>
                <div class="total-amount">' . ($totalPrice ?: 'TBD') . '</div>
                <div class="total-duration">For ' . ($days ?: 'N/A') . ' day(s)</div>
            </div>
            <div class="next-steps">
                <h3>What happens next?</h3>
                <ul>
                    <li>We will review your booking request within 24 hours.</li>
                    <li>You will receive a confirmation email with payment instructions.</li>
                    <li>Please ensure you have a valid driver\'s license for pickup.</li>
                </ul>
            </div>
            <p><strong>Best regards,</strong><br>The ZURIAUTO Team</p>
        </div>
        <div class="footer">
            <p>&copy; ' . $currentYear . ' ZURIAUTO Car Rental. All rights reserved.</p>
        </div>
    </div>
</body>
</html>';
    }

    // Generate admin notification email HTML
    function generateAdminNotificationEmail($formData, $selectedPackage = null, $days = null, $totalPrice = null) {
        $bookingRef = '#BR-' . time();
        $currentYear = date('Y');
        $currentDateTime = date('Y-m-d H:i:s');
        
        $packageName = $selectedPackage['name'] ?? 'N/A';
        $packagePrice = $selectedPackage['price'] ?? 'N/A';
        
        $companyRow = '';
        if ($formData['bookingType'] === 'company' && !empty($formData['companyName'])) {
            $companyRow = '<tr><td>Company Name</td><td>' . htmlspecialchars($formData['companyName']) . '</td></tr>';
        }
        
        return '
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Booking Request</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; line-height: 1.6; }
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
                <h2>Booking Reference: ' . $bookingRef . '</h2>
                <p>Submitted: ' . $currentDateTime . '</p>
            </div>
            <div class="section">
                <div class="section-header"><h2>👤 Customer Information</h2></div>
                <div class="section-content">
                    <table class="info-table">
                        <tr><td>Full Name</td><td>' . htmlspecialchars($formData['firstName']) . ' ' . htmlspecialchars($formData['lastName']) . '</td></tr>
                        <tr><td>Email</td><td><a href="mailto:' . htmlspecialchars($formData['email']) . '" style="color: #3b82f6;">' . htmlspecialchars($formData['email']) . '</a></td></tr>
                        <tr><td>Phone</td><td><a href="tel:+' . htmlspecialchars($formData['phone']) . '" style="color: #3b82f6;">+' . htmlspecialchars($formData['phone']) . '</a></td></tr>
                        <tr><td>Date of Birth</td><td>' . htmlspecialchars($formData['dateOfBirth'] ?? 'N/A') . '</td></tr>
                        <tr><td>Address</td><td>' . htmlspecialchars($formData['street'] ?? '') . ', ' . htmlspecialchars($formData['postalCode'] ?? '') . ', ' . htmlspecialchars($formData['country'] ?? '') . '</td></tr>
                        <tr><td>License Number</td><td>' . htmlspecialchars($formData['licenseNumber'] ?? 'N/A') . '</td></tr>
                        <tr><td>License Since</td><td>' . htmlspecialchars($formData['licenseSince'] ?? 'N/A') . '</td></tr>
                        <tr><td>Issuing Authority</td><td>' . htmlspecialchars($formData['issuingCity'] ?? '') . ', ' . htmlspecialchars($formData['issuingCountry'] ?? '') . '</td></tr>
                        <tr><td>Booking Type</td><td>' . htmlspecialchars($formData['bookingType'] ?? 'individual') . '</td></tr>
                        ' . $companyRow . '
                    </table>
                </div>
            </div>
            <div class="section">
                <div class="section-header"><h2>📅 Booking Details</h2></div>
                <div class="section-content">
                    <table class="info-table">
                        <tr><td>Package Type</td><td>' . htmlspecialchars($packageName) . '</td></tr>
                        <tr><td>Pickup Location</td><td>' . htmlspecialchars($formData['pickupLocation']) . '</td></tr>
                        <tr><td>Pickup Date & Time</td><td>' . htmlspecialchars($formData['pickupDate']) . ' at ' . htmlspecialchars($formData['pickupTime']) . '</td></tr>
                        <tr><td>Dropoff Location</td><td>' . htmlspecialchars($formData['dropoffLocation']) . '</td></tr>
                        <tr><td>Dropoff Date & Time</td><td>' . htmlspecialchars($formData['dropoffDate']) . ' at ' . htmlspecialchars($formData['dropoffTime']) . '</td></tr>
                        <tr><td>Rental Duration</td><td>' . ($days ?: 'N/A') . ' day(s)</td></tr>
                    </table>
                </div>
            </div>
            <div class="section financial-summary">
                <div class="section-header"><h2>💰 Financial Summary</h2></div>
                <div class="section-content">
                    <table class="info-table">
                        <tr><td>Package Cost</td><td>' . htmlspecialchars($packagePrice) . '</td></tr>
                        <tr class="total-row">
                            <td>TOTAL ESTIMATED</td><td>' . ($totalPrice ?: 'TBD') . '</td>
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
                    <a href="mailto:' . htmlspecialchars($formData['email']) . '?subject=Re: Your Car Rental Booking Request" class="contact-button">
                        Reply to Customer
                    </a>
                </div>
            </div>
        </div>
        <div class="footer">
            <p>&copy; ' . $currentYear . ' ZURIAUTO Car Rental - Admin Dashboard</p>
        </div>
    </div>
</body>
</html>';
    }

    // Get request data
    $rawInput = file_get_contents('php://input');
    logError("Raw input: " . substr($rawInput, 0, 200) . (strlen($rawInput) > 200 ? '...' : ''));
    
    if (empty($rawInput)) {
        returnJson(['success' => false, 'error' => 'No input data received'], 400);
    }
    
    $input = json_decode($rawInput, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        logError("JSON decode error: " . json_last_error_msg());
        returnJson(['success' => false, 'error' => 'Invalid JSON: ' . json_last_error_msg()], 400);
    }
    
    $action = $input['action'] ?? '';
    logError("Processing action: $action");
    
    // Validate action
    $validActions = ['user_confirmation', 'admin_notification', 'custom', 'test'];
    if (!in_array($action, $validActions)) {
        returnJson(['success' => false, 'error' => 'Invalid action. Must be: ' . implode(', ', $validActions)], 400);
    }
    
    switch ($action) {
        case 'test':
            logError("Test endpoint called");
            returnJson([
                'success' => true,
                'message' => 'ZURIAUTO email service is working',
                'server_info' => [
                    'php_version' => phpversion(),
                    'mail_function' => function_exists('mail'),
                    'phpmailer_available' => class_exists('PHPMailer\PHPMailer\PHPMailer'),
                    'time' => date('Y-m-d H:i:s')
                ]
            ]);
            break;
            
        case 'user_confirmation':
            // Validate required fields
            $formData = $input['formData'] ?? [];
            $selectedPackage = $input['selectedPackage'] ?? null;
            $days = $input['days'] ?? null;
            $totalPrice = $input['totalPrice'] ?? null;
            
            if (empty($formData['firstName']) || empty($formData['lastName']) || empty($formData['email'])) {
                returnJson(['success' => false, 'error' => 'Missing required customer information'], 400);
            }
            
            if (!filter_var($formData['email'], FILTER_VALIDATE_EMAIL)) {
                returnJson(['success' => false, 'error' => 'Invalid email address'], 400);
            }
            
            // Generate and send user confirmation email
            $html = generateUserConfirmationEmail($formData, $selectedPackage, $days, $totalPrice);
            $result = sendEmail($formData['email'], 'Booking Confirmation - ZURIAUTO', $html);
            
            returnJson($result);
            break;
            
        case 'admin_notification':
            // Validate required fields
            $formData = $input['formData'] ?? [];
            $selectedPackage = $input['selectedPackage'] ?? null;
            $days = $input['days'] ?? null;
            $totalPrice = $input['totalPrice'] ?? null;
            $adminEmail = $input['adminEmail'] ?? 'info@zuriauto.ch';
            
            if (empty($formData['firstName']) || empty($formData['lastName']) || empty($formData['email'])) {
                returnJson(['success' => false, 'error' => 'Missing required customer information'], 400);
            }
            
            if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
                returnJson(['success' => false, 'error' => 'Invalid admin email address'], 400);
            }
            
            // Generate and send admin notification email
            $html = generateAdminNotificationEmail($formData, $selectedPackage, $days, $totalPrice);
            $subject = 'New Car Rental Booking Request - ' . $formData['firstName'] . ' ' . $formData['lastName'];
            $result = sendEmail($adminEmail, $subject, $html, $formData['email']);
            
            returnJson($result);
            break;
            
        case 'custom':
            $to = trim($input['to'] ?? '');
            $subject = trim($input['subject'] ?? '');
            $html = trim($input['html'] ?? '');
            $replyTo = trim($input['replyTo'] ?? '');
            $from = trim($input['from'] ?? '');
            
            if (empty($to) || empty($subject) || empty($html)) {
                returnJson(['success' => false, 'error' => 'Missing required fields: to, subject, html'], 400);
            }
            
            if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
                returnJson(['success' => false, 'error' => 'Invalid email address'], 400);
            }
            
            $result = sendEmail($to, $subject, $html, $replyTo, $from);
            returnJson($result);
            break;
            
        default:
            returnJson(['success' => false, 'error' => 'Invalid action'], 400);
    }
    
} catch (Exception $e) {
    logError("Exception: " . $e->getMessage());
    returnJson(['success' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
} catch (Throwable $e) {
    logError("Throwable: " . $e->getMessage());
    returnJson(['success' => false, 'error' => 'Unexpected error occurred'], 500);
}

// If we get here, something went wrong
logError("Reached end of script unexpectedly");
returnJson(['success' => false, 'error' => 'Unexpected script termination'], 500);
?>