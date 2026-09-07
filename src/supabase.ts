import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cache client instance
let supabaseClientInstance: SupabaseClient | null = null;

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  url: string | null;
  hasKey: boolean;
  source: 'env' | 'custom' | 'none';
}

export interface SupabaseProductRecord {
  id: number;
  title: string;
  category: string;
  description: string;
  price: number;
  old_price?: number;
  discount?: string;
  rating?: number;
  reviews_count?: number;
  image?: string;
  in_stock: boolean;
  created_at?: string;
}

export interface SupabaseOrderRecord {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  shipping_address: string;
  total_amount: number;
  items: string;
  status: string;
  payment_method: string;
  email_notification_sent?: boolean;
  created_at?: string;
}

function sanitizeUrl(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const match = raw.match(/https?:\/\/[^\s\)\'\"\]]+/i);
  return match ? match[0].trim() : raw.trim();
}

function sanitizeKey(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const token = raw.trim().split(/\s+/)[0];
  return token || raw.trim();
}

/**
 * Retrieve active Supabase credentials (checking environment first, then localStorage)
 */
export function getActiveSupabaseCredentials(): { url: string; key: string; source: 'env' | 'custom' | 'none' } {
  // 1. Check Vite Environment Variables
  const envUrl = sanitizeUrl((import.meta as any).env?.VITE_SUPABASE_URL || '');
  const envKey = sanitizeKey((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '');

  if (envUrl && envKey && (envUrl.startsWith('https://') || envUrl.startsWith('http://'))) {
    return {
      url: envUrl,
      key: envKey,
      source: 'env',
    };
  }

  // 2. Check Local Storage custom configuration
  try {
    const localUrl = sanitizeUrl(localStorage.getItem('technova_supabase_url') || '');
    const localKey = sanitizeKey(localStorage.getItem('technova_supabase_key') || '');
    if (localUrl && localKey && (localUrl.startsWith('https://') || localUrl.startsWith('http://'))) {
      return {
        url: localUrl,
        key: localKey,
        source: 'custom',
      };
    }
  } catch (e) {
    // Ignore storage issues in private browsing
  }

  return { url: '', key: '', source: 'none' };
}

/**
 * Check if Supabase is currently configured
 */
export function isSupabaseConfigured(): boolean {
  const { url, key } = getActiveSupabaseCredentials();
  return Boolean(url && key);
}

/**
 * Get detailed status of the Supabase connection
 */
export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const { url, key, source } = getActiveSupabaseCredentials();
  return {
    isConfigured: Boolean(url && key),
    url: url || null,
    hasKey: Boolean(key),
    source,
  };
}

/**
 * Save custom credentials to browser storage and re-initialize client
 */
export function saveCustomSupabaseCredentials(url: string, key: string): void {
  try {
    localStorage.setItem('technova_supabase_url', url.trim());
    localStorage.setItem('technova_supabase_key', key.trim());
  } catch (e) {
    console.error('Failed to save Supabase credentials to localStorage:', e);
  }
  supabaseClientInstance = null;
}

/**
 * Clear custom credentials
 */
export function clearCustomSupabaseCredentials(): void {
  try {
    localStorage.removeItem('technova_supabase_url');
    localStorage.removeItem('technova_supabase_key');
  } catch (e) {}
  supabaseClientInstance = null;
}

/**
 * Get or instantiate the Supabase Client
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  const { url, key } = getActiveSupabaseCredentials();
  if (!url || !key) {
    return null;
  }

  try {
    supabaseClientInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return supabaseClientInstance;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Test connectivity to the configured Supabase instance
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; projectUrl?: string }> {
  const client = getSupabaseClient();
  const { url } = getActiveSupabaseCredentials();

  if (!client) {
    return {
      success: false,
      message: 'Supabase credentials are not configured. Please supply your Supabase URL and Anon Key.',
    };
  }

  try {
    // Attempt a light ping by querying public.products table
    const { data, error } = await client.from('products').select('id').limit(1);

    if (error) {
      // If table doesn't exist yet, it's still a connected database!
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return {
          success: true,
          message: 'Connected to Supabase project! (Tables not yet created; run the provided SQL setup script).',
          projectUrl: url,
        };
      }
      return {
        success: false,
        message: `Connection error: ${error.message} (code ${error.code})`,
        projectUrl: url,
      };
    }

    return {
      success: true,
      message: `Successfully connected to Supabase! Found ${data ? data.length : 0} existing product record(s).`,
      projectUrl: url,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Network or host error connecting to Supabase: ${err.message || err}`,
      projectUrl: url,
    };
  }
}

/**
 * Batch upload products from the storefront catalog into the Supabase 'products' table
 */
export async function uploadProductsToSupabase(products: any[]): Promise<{
  success: boolean;
  count: number;
  message: string;
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      count: 0,
      message: 'Supabase is not configured. Please provide your Supabase URL and API Key.',
    };
  }

  const rows: SupabaseProductRecord[] = products.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    description: p.description || '',
    price: Number(p.price) || 0,
    old_price: p.oldPrice ? Number(p.oldPrice) : undefined,
    discount: p.discount || '',
    rating: Number(p.rating) || 5.0,
    reviews_count: Number(p.reviewsCount) || 0,
    image: p.image || '',
    in_stock: true,
  }));

  try {
    const { data, error } = await client.from('products').upsert(rows, { onConflict: 'id' });

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return {
          success: false,
          count: 0,
          message: "The 'products' table does not exist in your Supabase project yet. Please execute the provided SQL setup script in your Supabase SQL Editor.",
          error: error.message,
        };
      }
      return {
        success: false,
        count: 0,
        message: `Failed to upload products: ${error.message}`,
        error: error.message,
      };
    }

    return {
      success: true,
      count: rows.length,
      message: `Successfully uploaded ${rows.length} product(s) to the Supabase 'products' table!`,
    };
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      message: `Error during product upload: ${err.message || err}`,
      error: String(err),
    };
  }
}

/**
 * Upload an order to the Supabase 'orders' table
 */
export async function uploadOrderToSupabase(order: {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress: string;
  totalAmount: number;
  items: string;
  status?: string;
  emailNotificationSent?: boolean;
}): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase is not configured' };
  }

  const record: SupabaseOrderRecord = {
    id: order.id,
    customer_name: order.customerName,
    customer_email: order.customerEmail,
    customer_phone: order.customerPhone || '',
    shipping_address: order.shippingAddress,
    total_amount: Number(order.totalAmount) || 0,
    items: order.items,
    status: order.status || 'Confirmed',
    payment_method: 'Cash on Delivery (COD)',
    email_notification_sent: Boolean(order.emailNotificationSent),
  };

  try {
    const { error } = await client.from('orders').upsert([record], { onConflict: 'id' });
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Order synchronized with Supabase' };
  } catch (err: any) {
    return { success: false, message: err.message || String(err) };
  }
}

/**
 * Fetch products list from Supabase
 */
export async function fetchSupabaseProducts(): Promise<{ success: boolean; data: SupabaseProductRecord[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, data: [], error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await client.from('products').select('*').order('id', { ascending: true });
    if (error) {
      return { success: false, data: [], error: error.message };
    }
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message || String(err) };
  }
}

/**
 * Fetch orders list from Supabase
 */
export async function fetchSupabaseOrders(): Promise<{ success: boolean; data: SupabaseOrderRecord[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, data: [], error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await client.from('orders').select('*').order('created_at', { ascending: false }).limit(20);
    if (error) {
      return { success: false, data: [], error: error.message };
    }
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message || String(err) };
  }
}
