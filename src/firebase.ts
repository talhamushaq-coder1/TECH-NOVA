import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  getDocFromServer,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom database ID if specified
const dbId = (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-technovapremiumt-fe7589e8-b91c-4b95-9589-8f598b2a6cb3';
export const db = getFirestore(app, dbId);

// Test connection on boot as required by the Firebase Integration Skill
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Database connection verified.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Database client is offline or initializing.');
    }
  }
}

// Save customer order to the database
export async function createOrder(order: {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress: string;
  totalAmount: number;
  items: string;
}) {
  const orderId = 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const orderRef = doc(db, 'orders', orderId);
  await setDoc(orderRef, {
    ...order,
    status: 'Confirmed',
    emailNotificationSent: false,
    emailRecipient: order.customerEmail,
    createdAt: new Date().toISOString()
  });
  return orderId;
}

// Save newsletter subscription to database
export async function subscribeNewsletter(email: string) {
  const subId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const subRef = doc(db, 'subscribers', subId);
  await setDoc(subRef, {
    email,
    subscribedAt: new Date().toISOString()
  });
  return subId;
}

// Fetch all products from the database (optional dynamic catalog)
export async function getProductsFromDb() {
  try {
    const querySnapshot = await getDocs(collection(db, 'products'));
    const products: any[] = [];
    querySnapshot.forEach((d) => {
      products.push({ id: d.id, ...d.data() });
    });
    return products;
  } catch (err) {
    console.warn('Using local product catalog fallback:', err);
    return null;
  }
}

// Fetch order status and details by Order ID
export interface OrderData {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress: string;
  totalAmount: number;
  items: string;
  status: string;
  createdAt: string;
  emailNotificationSent?: boolean;
  emailNotificationSentAt?: string;
  emailRecipient?: string;
}

export async function getOrderById(orderId: string): Promise<OrderData | null> {
  const cleanId = orderId.trim();
  if (!cleanId) return null;
  try {
    const orderRef = doc(db, 'orders', cleanId);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    return {
      id: snap.id,
      customerName: data.customerName || 'Valued Customer',
      customerEmail: data.customerEmail || '',
      customerPhone: data.customerPhone || '',
      shippingAddress: data.shippingAddress || '',
      totalAmount: data.totalAmount || 0,
      items: data.items || '',
      status: data.status || 'Confirmed',
      createdAt: data.createdAt || '',
      emailNotificationSent: Boolean(data.emailNotificationSent),
      emailNotificationSentAt: data.emailNotificationSentAt ? String(data.emailNotificationSentAt) : undefined,
      emailRecipient: data.emailRecipient || data.customerEmail || ''
    };
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    throw error;
  }
}

// Automatically verify connection
testConnection();
