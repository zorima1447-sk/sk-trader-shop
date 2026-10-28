-- ============================================================================
-- SK TRADER v22 - About / Privacy Policy / Terms / Contact pages and the Blog
-- Run once in Supabase > SQL Editor (safe to run again; it never overwrites your edits).
-- ============================================================================

-- ---------- PAGES & BLOG (About, Privacy Policy, Terms, Contact, blog articles) ----------
create table if not exists public.site_posts (
  id uuid default gen_random_uuid() primary key,
  kind text not null default 'blog',          -- 'page' (About, Privacy ...) or 'blog' (article)
  slug text not null unique,                  -- the link: /about, /blog/<slug>
  title text not null,
  description text,                           -- short summary for Google and the blog list
  cover_url text,                             -- main picture
  body text,                                  -- the text (rich text / HTML)
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.site_posts enable row level security;
drop policy if exists "site_posts read" on public.site_posts;
drop policy if exists "site_posts admin" on public.site_posts;
create policy "site_posts read" on public.site_posts for select using (published or public.is_admin());
create policy "site_posts admin" on public.site_posts for all using (public.is_admin()) with check (public.is_admin());
grant select on public.site_posts to anon, authenticated;
grant insert, update, delete on public.site_posts to anon, authenticated;

-- First content (only added when the page does not exist yet; your own changes are never overwritten)
insert into public.site_posts (kind, slug, title, description, body, sort_order) values
  ('page', 'about', $sk$About SK Trader$sk$, $sk$Learn about SK Trader, Karachi: authentic cosmetics, hair care and beauty products, wholesale and retail across Pakistan.$sk$, $sk$<p>Welcome to <b>SK Trader</b> (sktraderpk.com), your trusted partner for high-quality cosmetics, beauty and personal care products. Based in Karachi, Pakistan, we specialize in providing top-tier cosmetic solutions, including premium facial kits, Signature brand ranges, professional hair colors, masks and specialized shampoos.</p>
<h2>Our Mission</h2>
<p>At SK Trader, our mission is to deliver authentic, safe and effective beauty and hair care products to our customers and business partners. We aim to bridge the gap between quality cosmetic manufacturing and retail distribution, ensuring our clients receive the best results for their personal care needs.</p>
<h2>What We Offer</h2>
<ul>
<li><b>Cosmetics &amp; Facial Kits:</b> High-grade facial skincare products designed for glowing and healthy skin.</li>
<li><b>Hair Care Range:</b> Premium hair color shades, nourishing hair masks and repair shampoos.</li>
<li><b>Distribution &amp; Wholesale:</b> Reliable supply and distribution services for cosmetic brands.</li>
</ul>
<h2>Why Choose Us?</h2>
<ul>
<li>100% authentic and tested cosmetic formulations.</li>
<li>Dedicated customer support and reliable delivery across Pakistan.</li>
<li>Commitment to quality, safety and customer satisfaction.</li>
</ul>
<h2>Visit or Contact Us</h2>
<p><b>Business Office:</b> Office # 12, 3rd Floor, Zohra Plaza, Block 13-C, Gulshan-e-Iqbal, Main University Road, Karachi, Pakistan.<br><b>Email:</b> <a href="mailto:info@sktraderpk.com">info@sktraderpk.com</a><br><b>Phone:</b> <a href="tel:+923001550311">+92 300 1550311</a></p>$sk$, 1),
  ('page', 'contact', $sk$Contact Us$sk$, $sk$Contact SK Trader Karachi for orders, wholesale prices and product advice: phone, WhatsApp, email and office address.$sk$, $sk$<p>We are happy to help with orders, wholesale prices, delivery and product advice. Send us a message on WhatsApp, call us or email us. You can also visit our office.</p>
<h2>Business Office</h2>
<p>Office # 12, 3rd Floor, Zohra Plaza, Block 13-C, Gulshan-e-Iqbal, Main University Road, Karachi, Pakistan.</p>
<h2>Phone &amp; Email</h2>
<p><b>Phone:</b> <a href="tel:+923001550311">+92 300 1550311</a><br><b>Email:</b> <a href="mailto:info@sktraderpk.com">info@sktraderpk.com</a></p>
<h2>Wholesale &amp; Business Enquiries</h2>
<p>Salons, beauty shops and resellers are welcome. Contact us for wholesale prices and regular supply.</p>$sk$, 2),
  ('page', 'privacy-policy', $sk$Privacy Policy$sk$, $sk$Privacy Policy of SK Trader (sktraderpk.com): what information we collect, how we use it, cookies and Google AdSense.$sk$, $sk$<p><b>Effective Date:</b> October 2026<br><b>Website:</b> <a href="https://www.sktraderpk.com">https://www.sktraderpk.com</a></p>
<p>At SK Trader, accessible from sktraderpk.com, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains the types of information that are collected and recorded by SK Trader and how we use them.</p>
<h2>1. Information We Collect</h2>
<p>When you visit or make a purchase on sktraderpk.com, we may collect personal information such as:</p>
<ul>
<li>Name, shipping address and phone number for order fulfillment.</li>
<li>Email address for order tracking and inquiries.</li>
<li>Log files (IP address, browser type, ISP, date/time stamp, referring pages).</li>
<li>Anonymous visit statistics (pages and products viewed, city, device type) to improve our shop.</li>
</ul>
<h2>2. How We Use Your Information</h2>
<p>We use the collected information to:</p>
<ul>
<li>Process and deliver your orders for cosmetic and hair care products.</li>
<li>Improve, personalize and expand our website services.</li>
<li>Communicate with you regarding order updates or customer support.</li>
<li>Prevent fraudulent transactions and ensure website security.</li>
</ul>
<h2>3. Third-Party Advertising &amp; Cookies (Google AdSense)</h2>
<ul>
<li><b>Cookies:</b> SK Trader uses cookies and similar browser storage to store information including visitors' preferences (for example your cart and chosen currency) and the pages on the website that the visitor accessed or visited.</li>
<li><b>Google DoubleClick DART Cookie:</b> Google is one of the third-party vendors on our site. It also uses cookies, known as DART cookies, to serve ads to our site visitors based upon their visit to sktraderpk.com and other sites on the internet.</li>
<li>Visitors may choose to decline the use of DART cookies by visiting the Google ad and content network Privacy Policy at the following URL: <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener">https://policies.google.com/technologies/ads</a></li>
</ul>
<h2>4. Third-Party Privacy Policies</h2>
<p>SK Trader's Privacy Policy does not apply to other advertisers or websites. Thus, we advise you to consult the respective Privacy Policies of these third-party ad servers (such as Google AdSense) for more detailed information.</p>
<h2>5. Contact Us</h2>
<p>If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us at <a href="mailto:info@sktraderpk.com">info@sktraderpk.com</a>.</p>$sk$, 3),
  ('page', 'terms-and-conditions', $sk$Terms and Conditions$sk$, $sk$Terms and Conditions for using sktraderpk.com and ordering cosmetic and hair care products from SK Trader.$sk$, $sk$<p><b>Effective Date:</b> October 2026<br><b>Website:</b> <a href="https://www.sktraderpk.com">https://www.sktraderpk.com</a></p>
<p>Welcome to SK Trader! These terms and conditions outline the rules and regulations for the use of SK Trader's website, located at sktraderpk.com.</p>
<h2>1. Intellectual Property Rights</h2>
<p>Unless otherwise stated, SK Trader and/or its licensors own the intellectual property rights for all material on sktraderpk.com. All intellectual property rights are reserved.</p>
<h2>2. Products and Orders</h2>
<ul>
<li><b>Product Information:</b> We strive to display the colors, descriptions and packaging of our cosmetic and hair care products as accurately as possible.</li>
<li><b>Pricing &amp; Availability:</b> All prices and product availability are subject to change without prior notice.</li>
<li><b>Order Acceptance:</b> We reserve the right to refuse or cancel any order for reasons including inventory stock, errors in pricing or suspected unauthorized transactions.</li>
</ul>
<h2>3. User Responsibilities</h2>
<p>You must not:</p>
<ul>
<li>Republish material from sktraderpk.com without permission.</li>
<li>Sell, rent or sub-license material from sktraderpk.com.</li>
<li>Use this website in any way that causes, or may cause, damage to the website or impairment of the availability or accessibility of the website.</li>
</ul>
<h2>4. Limitation of Liability</h2>
<p>In no event shall SK Trader, nor any of its officers, directors and employees, be held liable for anything arising out of or in any way connected with your use of this website.</p>
<h2>5. Governing Law</h2>
<p>These terms and conditions are governed by and construed in accordance with the laws of Pakistan.</p>
<h2>6. Contact Information</h2>
<p>If you have any questions regarding these Terms, please contact us at:<br><b>Email:</b> <a href="mailto:info@sktraderpk.com">info@sktraderpk.com</a><br><b>Phone:</b> <a href="tel:+923001550311">+92 300 1550311</a></p>$sk$, 4),
  ('blog', 'baalon-ka-girna-kaise-rokein-hair-fall-control', $sk$Baalon Ka Girna Kaise Rokein? Hair Fall Control Aur Repair Ka Sahi Tareeqa$sk$, $sk$Hair fall kyun hota hai aur baalon ko majboot kaise banayein: shampoo, hair mask, oiling aur diet ke aasan aur asar-daar tareeqay.$sk$, $sk$<p>Aaj kal badalte mausam, ziyada tension, aur ghalat shampoo ya chemical products use karne ki wajah se baalon ka girna (hair fall) ek aam masla ban chuka hai. Chahe mard hon ya aurtein, har koi baalon ke patle hone aur girne se pareshan rehta hai.</p>
<p>Lekin achhi baat yeh hai ke agar aap waqt par apne baalon ki sahi hifazat (hair care routine) shuru kar dein, to hair fall ko na sirf roka ja sakta hai balki baalon ki growth ko bhi dobara behtar banaya ja sakta hai. Is article mein hum baat karenge un aasan aur asar-daar tareeqon ki jin se aap apne baal majboot bana sakte hain.</p>
<h2>1. Hair Fall Kyun Hota Hai? (Buniyaadi Wajoohaat)</h2>
<p>Baalon ke girne ki sab se bari wajahein yeh hoti hain:</p>
<ul>
<li><b>Severe Dandruff &amp; Scalp Dryness:</b> Agar sar mein khushki ho to baalon ki jarein (roots) kamzor ho jati hain.</li>
<li><b>Harsh Chemical Shampoos:</b> Aise shampoos jin mein harmful sulfates hote hain, woh baalon ka natural moisture khatam kar dete hain.</li>
<li><b>Nutritional Deficiency:</b> Khane mein proteins aur vitamins ki kami.</li>
</ul>
<h2>2. Baalon Ko Majboot Banane Ke Zaroori Steps</h2>
<h3>Step 1: Scalp Ko Saaf Aur Hydrated Rakhein</h3>
<p>Aap ka scalp jitna clean aur khushki-free rahega, baal utne hi kam girenge. Is ke liye hafte mein 2 se 3 baar ek achha nourishing shampoo use karein jo baalon ko dry kiye baghair saaf kare.</p>
<h3>Step 2: Hair Mask Ka Use Karein (Deep Conditioning)</h3>
<p>Sirf shampoo lagana kaafi nahi hota. Hair mask baalon ki deep conditioning karta hai aur damaged baalon ko repair kar ke unhein tootne se bachata hai. Hafte mein ek baar hair mask zaroor lagayein.</p>
<p>[[products: shampoo, mask | Kya Aap Baal Girne Aur Dryness Se Pareshan Hain? SK Trader ki Nourishing Shampoo &amp; Hair Repair Mask range dekhein]]</p>
<h2>3. Natural Tips Jo Aap Ghar Par Kar Sakte Hain</h2>
<ul>
<li><b>Gentle Oiling:</b> Hafte mein ek se do baar halki oiling (coconut ya almond oil) karein.</li>
<li><b>Heat Styling Se Bachein:</b> Hair dryer aur straightener ka ziyada use baalon ko kamzor karta hai.</li>
<li><b>Diet Behtar Karein:</b> Apni khuraak mein anda, doodh aur hari sabziyan shamil karein.</li>
</ul>
<h2>Khulasa (Conclusion)</h2>
<p>Hair fall ko control karna ek din ka kaam nahi hai, is ke liye regular care ki zaroorat hoti hai. Sahi hair care products ka intekhab karein aur chemical-heavy shampoos se parhez karein. Agar aap apne baalon ko sahi nourishment denge to kuch hi hafton mein aap ko baalon ki strength mein numayan farq dikhai dega.</p>
<p><i>Note: Agar baal bohat tezi se gir rahe hon ya jagah jagah se ganjapan ho, to kisi skin specialist (dermatologist) se zaroor mashwara karein.</i></p>$sk$, 0)

on conflict (slug) do nothing;

-- Google AdSense publisher ID (ca-pub-...) - Admin > Blog & Pages
alter table public.store_settings add column if not exists adsense_client text;

-- Pictures for articles can be uploaded (file names starting with "blog-")
do $$
begin
  drop policy if exists "site-assets insert" on storage.objects;
  create policy "site-assets insert" on storage.objects for insert
    with check (bucket_id = 'site-assets' and name ~ '^(logo|slide|variant|product|blog)-[0-9a-z-]+\.(png|jpg)$');
exception when others then
  raise notice 'Storage policy skipped: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
