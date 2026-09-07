# TECHNOVA Firebase Cloud Functions

This directory contains the automated Firebase Cloud Function (`sendOrderEmailConfirmation`) that listens to newly created orders in Firestore and dispatches an automated HTML confirmation email to the customer.

## Features

- **Firestore Trigger**: Triggered on `orders/{orderId}` creation (`onDocumentCreated`) in the designated database (`ai-studio-technovapremiumt-fe7589e8-b91c-4b95-9589-8f598b2a6cb3`).
- **Cyberpunk / Neon Branded Email**: Generates a responsive HTML email with order reference ID, delivery address, items table, and direct tracking link.
- **Delivery Transport**: Uses `nodemailer` with standard SMTP (Gmail App Passwords, SendGrid, Postmark, Mailgun, Amazon SES).
- **Firestore Status Update**: Updates the order document with `emailNotificationSent: true` and `emailNotificationSentAt: serverTimestamp()`.
- **Duplicate Prevention**: Skips execution if `emailNotificationSent` is already `true`.

## Deployment Instructions

### 1. Install Functions Dependencies
```bash
cd functions
npm install
```

### 2. Configure SMTP Credentials in Firebase Secret Manager
You can securely store your SMTP credentials using Firebase Functions secrets:
```bash
firebase functions:secrets:set SMTP_HOST
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
firebase functions:secrets:set SMTP_FROM
```

Or configure environment variables in `functions/.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-store-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="TECHNOVA Store" <orders@technovastore.com>
```

### 3. Build & Deploy
From the root directory:
```bash
firebase deploy --only functions
```
Or from the `functions` directory:
```bash
npm run build
firebase deploy --only functions:sendOrderEmailConfirmation
```

### 4. View Execution Logs
```bash
firebase functions:log
```
