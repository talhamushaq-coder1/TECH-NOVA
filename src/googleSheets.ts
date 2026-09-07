import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import { app } from './firebase';

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory token cache (Do NOT store in localStorage per security guidelines)
let cachedAccessToken: string | null = null;
let currentUser: User | null = null;
let isSigningIn = false;

export interface GoogleSheetsState {
  isSignedIn: boolean;
  user: {
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  } | null;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  spreadsheetTitle: string;
  hasToken: boolean;
}

const STORAGE_KEY_SHEET_ID = 'technova_orders_spreadsheet_id';
const STORAGE_KEY_SHEET_URL = 'technova_orders_spreadsheet_url';
const STORAGE_KEY_PENDING_ORDERS = 'technova_pending_sheet_orders';

/**
 * Initialize Firebase Auth listener for Google Workspace
 */
export function initGoogleAuth(
  onSuccess?: (user: User, token: string | null) => void,
  onFailure?: () => void
) {
  return onAuthStateChanged(auth, async (user: User | null) => {
    currentUser = user;
    if (user) {
      if (cachedAccessToken) {
        if (onSuccess) onSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token must be acquired via interactive sign-in
        if (onSuccess) onSuccess(user, null);
      }
    } else {
      cachedAccessToken = null;
      if (onFailure) onFailure();
    }
  });
}

/**
 * Sign in with Google to grant Google Sheets & Drive access
 */
export async function signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain access token from Google sign-in.');
    }
    cachedAccessToken = credential.accessToken;
    currentUser = result.user;

    // Auto-ensure the "Orders" Google Sheet exists
    try {
      await ensureOrdersSpreadsheet();
      // Flush any queued orders
      await flushPendingOrdersToSheet();
    } catch (sheetErr) {
      console.warn('Initial sheet setup warning:', sheetErr);
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Sign out from Google Auth
 */
export async function signOutFromGoogle(): Promise<void> {
  await signOut(auth);
  cachedAccessToken = null;
  currentUser = null;
}

/**
 * Get current cached access token
 */
export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

/**
 * Get current Google User
 */
export function getCurrentGoogleUser(): User | null {
  return currentUser || auth.currentUser;
}

/**
 * Retrieve saved Spreadsheet ID
 */
export function getSavedSpreadsheetId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_SHEET_ID);
  } catch (e) {
    return null;
  }
}

/**
 * Retrieve saved Spreadsheet URL
 */
export function getSavedSpreadsheetUrl(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_SHEET_URL);
  } catch (e) {
    return null;
  }
}

/**
 * Check or create the Google Sheet named "Orders"
 */
export async function ensureOrdersSpreadsheet(): Promise<{ id: string; url: string }> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('Google account not connected. Please sign in with Google first.');
  }

  // 1. Check if we already have an existing spreadsheet ID saved
  const savedId = getSavedSpreadsheetId();
  if (savedId) {
    try {
      const verifyRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${savedId}?fields=spreadsheetId,properties.title,spreadsheetUrl`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (verifyRes.ok) {
        const data = await verifyRes.json();
        const url = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${savedId}/edit`;
        localStorage.setItem(STORAGE_KEY_SHEET_URL, url);
        return { id: savedId, url };
      }
    } catch (e) {
      console.warn('Could not verify existing spreadsheet, searching drive...', e);
    }
  }

  // 2. Search user's Drive for an existing spreadsheet named "Orders"
  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='Orders' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name,webViewLink)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const found = searchData.files[0];
        const url = found.webViewLink || `https://docs.google.com/spreadsheets/d/${found.id}/edit`;
        localStorage.setItem(STORAGE_KEY_SHEET_ID, found.id);
        localStorage.setItem(STORAGE_KEY_SHEET_URL, url);
        return { id: found.id, url };
      }
    }
  } catch (e) {
    console.warn('Drive search skipped or failed:', e);
  }

  // 3. Create a brand new Google Sheet named "Orders"
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: 'Orders'
      },
      sheets: [
        {
          properties: {
            title: 'Orders',
            gridProperties: {
              frozenRowCount: 1
            }
          }
        }
      ]
    })
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Failed to create "Orders" Google Sheet: ${errorText}`);
  }

  const newSheet = await createRes.json();
  const spreadsheetId = newSheet.spreadsheetId;
  const spreadsheetUrl = newSheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  localStorage.setItem(STORAGE_KEY_SHEET_ID, spreadsheetId);
  localStorage.setItem(STORAGE_KEY_SHEET_URL, spreadsheetUrl);

  // Initialize Header Row with professional column headers
  const headers = [
    'Order ID',
    'Timestamp',
    'Customer Name',
    'Customer Email',
    'Customer Phone',
    'Shipping Address',
    'Items Ordered',
    'Total Amount (Rs)',
    'Payment Method',
    'Status'
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A1:J1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: 'Orders!A1:J1',
        majorDimension: 'ROWS',
        values: [headers]
      })
    }
  );

  return { id: spreadsheetId, url: spreadsheetUrl };
}

export interface SheetOrderPayload {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress: string;
  totalAmount: number;
  items: string;
  status?: string;
  createdAt?: string;
  paymentMethod?: string;
}

/**
 * Append an order row directly to the "Orders" Google Sheet
 */
export async function appendOrderToGoogleSheet(order: SheetOrderPayload): Promise<{
  success: boolean;
  sheetUrl?: string;
  message: string;
}> {
  const token = cachedAccessToken;
  if (!token) {
    // Queue the order for automatic sync as soon as user connects
    queuePendingOrder(order);
    return {
      success: false,
      message: 'Order saved locally & queued for Google Sheets. Connect Google Sheets to sync.'
    };
  }

  try {
    const { id: spreadsheetId, url: sheetUrl } = await ensureOrdersSpreadsheet();

    const timestamp = order.createdAt || new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });
    const rowValues = [
      order.id,
      timestamp,
      order.customerName,
      order.customerEmail,
      order.customerPhone || 'N/A',
      order.shippingAddress,
      order.items,
      order.totalAmount,
      order.paymentMethod || 'Cash on Delivery (COD)',
      order.status || 'Confirmed'
    ];

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [rowValues]
        })
      }
    );

    if (!appendRes.ok) {
      const errText = await appendRes.text();
      queuePendingOrder(order);
      return {
        success: false,
        sheetUrl,
        message: `Sheet append error: ${errText}`
      };
    }

    return {
      success: true,
      sheetUrl,
      message: `Order ${order.id} automatically recorded in Google Sheet "Orders"`
    };
  } catch (err: any) {
    queuePendingOrder(order);
    return {
      success: false,
      message: err.message || 'Error writing to Google Sheet'
    };
  }
}

/**
 * Queue order in localStorage if offline or token not yet ready
 */
function queuePendingOrder(order: SheetOrderPayload) {
  try {
    const existing = getPendingOrders();
    // Prevent duplicate entries
    if (!existing.some((o) => o.id === order.id)) {
      existing.push(order);
      localStorage.setItem(STORAGE_KEY_PENDING_ORDERS, JSON.stringify(existing));
    }
  } catch (e) {
    console.error('Failed to queue pending order:', e);
  }
}

/**
 * Get pending orders list
 */
export function getPendingOrders(): SheetOrderPayload[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PENDING_ORDERS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Flush queued orders to the Google Sheet once authenticated
 */
export async function flushPendingOrdersToSheet(): Promise<number> {
  const pending = getPendingOrders();
  if (pending.length === 0 || !cachedAccessToken) return 0;

  let syncedCount = 0;
  const remaining: SheetOrderPayload[] = [];

  for (const order of pending) {
    const res = await appendOrderToGoogleSheet(order);
    if (res.success) {
      syncedCount++;
    } else {
      remaining.push(order);
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY_PENDING_ORDERS, JSON.stringify(remaining));
  } catch (e) {}

  return syncedCount;
}

/**
 * Read recent rows from the Orders Google Sheet
 */
export async function fetchRecentSheetOrders(): Promise<{
  success: boolean;
  rows: string[][];
  error?: string;
}> {
  const token = cachedAccessToken;
  if (!token) {
    return { success: false, rows: [], error: 'Google account not signed in' };
  }

  try {
    const { id: spreadsheetId } = await ensureOrdersSpreadsheet();
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A1:J50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      return { success: false, rows: [], error: err };
    }

    const data = await res.json();
    return { success: true, rows: data.values || [] };
  } catch (e: any) {
    return { success: false, rows: [], error: e.message || String(e) };
  }
}
