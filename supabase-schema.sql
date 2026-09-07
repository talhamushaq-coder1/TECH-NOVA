-- ============================================================================
-- TECHNOVA STORE - SUPABASE POSTGRESQL SCHEMA SETUP
-- Run this SQL in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- 1. Create 'products' table for the store catalog
CREATE TABLE IF NOT EXISTS public.products (
    id BIGINT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL,
    old_price NUMERIC(12, 2),
    discount TEXT,
    rating NUMERIC(3, 2) DEFAULT 5.0,
    reviews_count INTEGER DEFAULT 0,
    image TEXT,
    in_stock BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create 'orders' table for checkout transactions
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    shipping_address TEXT NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    items TEXT NOT NULL,
    status TEXT DEFAULT 'Confirmed',
    payment_method TEXT DEFAULT 'Cash on Delivery (COD)',
    email_notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for Public Access (via Supabase Anon Key)
DROP POLICY IF EXISTS "Allow public read-write for products" ON public.products;
CREATE POLICY "Allow public read-write for products" ON public.products
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read-write for orders" ON public.orders;
CREATE POLICY "Allow public read-write for orders" ON public.orders
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- 5. Create helpful indices
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
