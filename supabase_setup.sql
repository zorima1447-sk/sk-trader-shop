-- SQL Script for Supabase Database & Storage Setup
-- Open Supabase -> SQL Editor -> New Query -> Paste & Run

-- 1. Create Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    original_price NUMERIC DEFAULT 0,
    discounted_price NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    image_url TEXT,
    category_name TEXT DEFAULT 'Hair Care',
    stock_quantity INT DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_no TEXT UNIQUE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    payment_method TEXT DEFAULT 'COD',
    payment_status TEXT DEFAULT 'Pending',
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Public Access RLS Policies
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow All Categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- 5. Storage Bucket Setup for Product Images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Read Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Public Upload Access" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Public Update Access" ON storage.objects 
FOR UPDATE USING (bucket_id = 'product-images');

CREATE POLICY "Public Delete Access" ON storage.objects 
FOR DELETE USING (bucket_id = 'product-images');
