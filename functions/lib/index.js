"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOrderEmailConfirmation = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const nodemailer = __importStar(require("nodemailer"));
// Initialize Firebase Admin SDK
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
// Named Firestore database ID from configuration
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID ||
    "ai-studio-technovapremiumt-fe7589e8-b91c-4b95-9589-8f598b2a6cb3";
const STORE_URL = process.env.STORE_URL ||
    "https://ais-dev-aiswyfa5ltuogyc5gsknkp-694878567962.asia-southeast1.run.app";
/**
 * Configure Nodemailer Transport
 * Uses environment variables if configured, or falls back to an ethereal/preview
 * transporter for testing and safe dev execution.
 */
async function createTransporter() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    if (host && user && pass) {
        logger.info("Using configured production SMTP transporter", { host, port, user });
        return nodemailer.createTransport({
            host,
            port,
            secure,
            auth: { user, pass }
        });
    }
    // Development / Test fallback: Ethereal test account or local logger
    logger.warn("SMTP credentials not fully configured in environment. Using test transporter.");
    try {
        const testAccount = await nodemailer.createTestAccount();
        return nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
    }
    catch (err) {
        logger.warn("Could not create ethereal test account, falling back to json/stream transport", err);
        return nodemailer.createTransport({
            jsonTransport: true
        });
    }
}
/**
 * Generate Responsive Branded Cyberpunk/Tech HTML Confirmation Email
 */
function generateOrderEmailHtml(order) {
    const formattedTotal = new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        maximumFractionDigits: 0
    }).format(order.totalAmount);
    const trackingUrl = `${STORE_URL}#order-tracking`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation - ${order.id}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #09090b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e4e4e7;
    }
    .wrapper {
      width: 100%;
      background-color: #09090b;
      padding: 40px 10px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #141417;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6);
    }
    .header {
      background: linear-gradient(135deg, #09090b 0%, #18181b 100%);
      padding: 30px;
      text-align: center;
      border-bottom: 2px solid #06b6d4;
    }
    .logo-badge {
      display: inline-block;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 0.15em;
      color: #ffffff;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .logo-badge span {
      color: #06b6d4;
    }
    .subtitle {
      font-size: 12px;
      letter-spacing: 0.2em;
      color: #71717a;
      text-transform: uppercase;
    }
    .body-content {
      padding: 30px;
    }
    .badge-confirmed {
      display: inline-block;
      background-color: rgba(34, 197, 94, 0.15);
      border: 1px solid #22c55e;
      color: #4ade80;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 12px 0;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #a1a1aa;
      margin: 0 0 16px 0;
    }
    .order-box {
      background-color: #1a1a1e;
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
    }
    .order-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .order-label {
      color: #71717a;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.05em;
    }
    .order-val {
      color: #ffffff;
      font-weight: 600;
    }
    .order-id-highlight {
      font-family: monospace;
      color: #06b6d4;
      font-weight: 700;
      font-size: 13px;
    }
    .items-box {
      background-color: #0d0d10;
      border-left: 3px solid #06b6d4;
      padding: 14px 16px;
      margin: 16px 0;
      border-radius: 4px;
      font-size: 13px;
      color: #e4e4e7;
    }
    .cta-button {
      display: block;
      width: fit-content;
      margin: 28px auto 10px;
      background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      padding: 14px 28px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      text-align: center;
      box-shadow: 0 4px 14px rgba(6, 182, 212, 0.4);
    }
    .footer {
      background-color: #0d0d10;
      padding: 24px 30px;
      text-align: center;
      font-size: 12px;
      color: #52525b;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
    .footer a {
      color: #06b6d4;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-badge">TECH<span>NOVA</span></div>
        <div class="subtitle">Next-Gen Hardware &amp; Cyber Gear</div>
      </div>
      <div class="body-content">
        <div class="badge-confirmed">✓ Order Received &amp; Verified</div>
        <h1>Thank you, ${order.customerName}!</h1>
        <p>
          We have successfully recorded your order in our live database. Our fulfillment facility in Pakistan is packing your equipment for courier dispatch.
        </p>

        <div class="order-box">
          <div style="margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;">
            <div class="order-label">Order Reference ID</div>
            <div class="order-id-highlight">${order.id}</div>
          </div>
          <div style="margin-bottom: 12px;">
            <div class="order-label">Delivery Destination</div>
            <div class="order-val">${order.shippingAddress}</div>
          </div>
          <div style="margin-bottom: 12px;">
            <div class="order-label">Contact Details</div>
            <div class="order-val">${order.customerEmail} ${order.customerPhone ? '• ' + order.customerPhone : ''}</div>
          </div>
          <div>
            <div class="order-label">Payment Method</div>
            <div class="order-val" style="color: #4ade80;">Cash on Delivery (COD) — Payable on Delivery</div>
          </div>
        </div>

        <div style="margin-top: 20px;">
          <div class="order-label" style="margin-bottom: 6px;">Selected Products:</div>
          <div class="items-box">
            ${order.items.replace(/\n/g, '<br/>')}
          </div>
        </div>

        <div style="text-align: right; margin-top: 16px; font-size: 16px; color: #ffffff;">
          Total Payable: <strong style="color: #06b6d4; font-size: 19px;">${formattedTotal}</strong>
        </div>

        <a href="${trackingUrl}" class="cta-button" target="_blank">
          🚚 Track Order Progress Live
        </a>
      </div>
      <div class="footer">
        <p style="margin-bottom: 8px;">TECHNOVA Official E-Commerce Store Pakistan</p>
        <p style="margin-bottom: 8px;">All devices covered by 1-Year Official Replacement Warranty.</p>
        <p>Need support? Contact <a href="mailto:support@technovastore.com">support@technovastore.com</a> or WhatsApp 0300-1234567.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
/**
 * Firebase Cloud Function: sendOrderEmailConfirmation
 *
 * Trigger: Firestore onDocumentCreated on "orders/{orderId}" in the named database
 * Action:
 *  1. Reads new order document from Firestore.
 *  2. Generates responsive branded HTML email.
 *  3. Sends automated confirmation email to customerEmail via Nodemailer.
 *  4. Updates the Firestore order document with emailNotificationSent status.
 */
exports.sendOrderEmailConfirmation = (0, firestore_1.onDocumentCreated)({
    document: "orders/{orderId}",
    database: FIRESTORE_DATABASE_ID,
    region: "asia-southeast1",
    retry: true
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.warn("No data associated with the event, skipping.");
        return;
    }
    const orderId = event.params.orderId;
    const orderData = snapshot.data();
    logger.info(`New order detected in Firestore [${orderId}]:`, {
        orderId,
        customerEmail: orderData.customerEmail,
        totalAmount: orderData.totalAmount
    });
    // Prevent duplicate emails if already marked as sent
    if (orderData.emailNotificationSent) {
        logger.info(`Order [${orderId}] already has emailNotificationSent=true. Skipping.`);
        return;
    }
    const customerEmail = (orderData.customerEmail || "").trim();
    if (!customerEmail || !customerEmail.includes("@")) {
        logger.error(`Order [${orderId}] has invalid customerEmail: "${customerEmail}". Cannot send confirmation.`);
        return;
    }
    const customerName = orderData.customerName || "Valued Customer";
    const shippingAddress = orderData.shippingAddress || "Pakistan";
    const customerPhone = orderData.customerPhone || "";
    const items = orderData.items || "Order Items";
    const totalAmount = Number(orderData.totalAmount) || 0;
    const createdAt = orderData.createdAt || new Date().toISOString();
    // Generate HTML
    const emailHtml = generateOrderEmailHtml({
        id: orderId,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        totalAmount,
        items,
        createdAt
    });
    // Plain-text fallback
    const emailText = `Thank you for your order, ${customerName}!\n\nOrder ID: ${orderId}\nTotal: PKR ${totalAmount}\nShipping Address: ${shippingAddress}\n\nTrack your order online: ${STORE_URL}#order-tracking\n\nTECHNOVA Pakistan`;
    try {
        const transporter = await createTransporter();
        const senderFrom = process.env.SMTP_FROM || '"TECHNOVA Official" <orders@technovastore.com>';
        logger.info(`Dispatching confirmation email to ${customerEmail}...`);
        const mailOptions = {
            from: senderFrom,
            to: customerEmail,
            subject: `Order Confirmation #${orderId} - TECHNOVA Pakistan`,
            text: emailText,
            html: emailHtml
        };
        const info = await transporter.sendMail(mailOptions);
        logger.info(`Confirmation email sent successfully for order [${orderId}]:`, {
            messageId: info.messageId,
            response: info.response
        });
        // Update Firestore document with email status using admin privileges
        const db = (0, firestore_2.getFirestore)(FIRESTORE_DATABASE_ID);
        await db.collection("orders").doc(orderId).update({
            emailNotificationSent: true,
            emailNotificationSentAt: firestore_2.FieldValue.serverTimestamp(),
            emailRecipient: customerEmail
        });
        logger.info(`Order [${orderId}] updated in Firestore with emailNotificationSent=true.`);
    }
    catch (error) {
        logger.error(`Failed to send order confirmation email for order [${orderId}]:`, error);
        throw error; // Let Cloud Functions retry policy handle transient failures
    }
});
//# sourceMappingURL=index.js.map