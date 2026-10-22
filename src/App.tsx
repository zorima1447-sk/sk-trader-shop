import React, { useEffect, useState } from 'react';
import { supabase, setAdminToken, getAdminToken } from './supabaseClient';
import { GeoFields, GeoValue, emptyGeo, resolveGeo, localNumber } from './GeoFields';
import SettingsPanel, { SettingsTab } from './SettingsPanel';
import { AuthPage, AccountPage, AuthMode, addressFromMeta } from './CustomerAuth';
import AiChatBubble, { ChatPanel } from './AiChat';
import { COURIERS, TrackOrderPage, trackingLink } from './Tracking';
import { InvoiceDocument, InvoiceItem, printInvoice } from './Invoice';
import { StoreSettings, defaultSettings, fetchStoreSettings, accentCss, mergeSettings, readShopCache, writeShopCache, deliveryChargeFor, gstFor } from './storeSettings';
import PkAddressFields from './PkAddressFields';
import { PkAddress, emptyPkAddress, checkPkAddress, fullPkAddress, cityFromText } from './pakistan';
import { ShopIcon } from './icons';
import { 
  ShoppingCart, Package, CheckCircle2, Phone, MapPin, User, Trash2, Edit, Building, 
  Hash, CreditCard, Plus, Settings, Lock, Upload, Tag, ListFilter, DollarSign, 
  FileText, Users, Eye, LogOut, LayoutDashboard, Search, Image as ImageIcon,
  UserPlus, Shield, Wallet, Save, RefreshCw, X,
  Heart, ChevronLeft, ChevronRight, Truck, Flame, ShieldCheck, BadgeCheck, MessageCircle, Star, Minus, ArrowUp, ArrowDown, Printer, Mail
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  original_price: number;
  discounted_price: number;
  price: number;
  image_url: string;
  category_name: string;
  stock_quantity: number;
  sold_quantity?: number;
  created_at?: string;
  variants?: Variant[] | null;
  variant_label?: string | null; // what the options are called: Size, Shade, Color, Pack ...
}

// One size / pack of a product, e.g. "250 ML" or "500 ML" (each with its own price and stock)
interface Variant {
  name: string;
  price: number;
  original_price?: number;
  stock: number;
  color?: string; // optional swatch colour (e.g. hair colour shade), "#8b4513"
}

interface CartItem extends Product {
  quantity: number;
  cartKey: string;   // product id, or "product id|size" when a size was chosen
  variant?: string;  // chosen size / shade
  variantLabel?: string; // "Size", "Shade", ...
}

const variantsOf = (p: { variants?: Variant[] | null }): Variant[] =>
  Array.isArray(p.variants) ? p.variants.filter(v => v && String(v.name || '').trim()) : [];

interface OrderItem {
  id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  order_items?: OrderItem[];
  invoice_no: string;
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  status: string;
  transaction_id?: string;
  payment_account_label?: string | null;
  payer_name?: string | null;
  payer_account?: string | null;
  payer_amount?: number | null;
  payer_paid_at?: string | null;
  has_payment_proof?: boolean | null;
  delivered_at?: string | null;
  city?: string | null;
  province?: string | null;
  area?: string | null;
  delivery_charge?: number | null;
  courier?: string | null;
  tracking_no?: string | null;
  tracking_url?: string | null;
  shipped_at?: string | null;
  confirmed_at?: string | null;
  paid_amount?: number | null;
  paid_at?: string | null;
  customer_id?: string | null;
  customer_email?: string | null;
  created_at: string;
}

interface Review {
  id: string;
  product_id: string;
  order_id?: string | null;
  customer_name: string;
  rating: number;
  remark: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone_iso?: string | null;
  phone_code?: string | null;
  phone?: string | null;
  country_iso?: string | null;
  country?: string | null;
  province_iso?: string | null;
  province?: string | null;
  city?: string | null;
  area?: string | null;
  address?: string | null;
  marketing_opt_in?: boolean | null;
  created_at: string;
}

interface Payment {
  id: string;
  order_id: string;
  amount: number;
  method: string;
  category: string;
  account_id?: string | null;
  account_label?: string | null;
  reference?: string | null;
  note?: string | null;
  received_at: string;
}

interface Slide {
  id?: string;
  title: string;
  text: string;
  cta: string;
  bg: string;
  image_url?: string | null;
  sort_order?: number;
  active?: boolean;
}

interface AdminUser {
  id: string;
  username: string;
  password?: string;
  role: string;
}

interface PaymentAccount {
  id: string;
  type: string;
  account_number: string;
  account_title: string;
  is_active: boolean;
}

// Shown in the login page, admin header and footer. If you cannot see it, an old version is deployed.
const BUILD = 'v13 (22-Oct-2026)';

const BG_PRESETS: Record<string, string> = {
  gold: 'from-slate-950 via-slate-900 to-amber-900',
  amber: 'from-amber-900 via-slate-900 to-slate-950',
  green: 'from-slate-900 via-emerald-950 to-slate-950',
  blue: 'from-slate-950 via-blue-950 to-slate-900',
  rose: 'from-slate-950 via-rose-950 to-slate-900'
};

// Default slides, used only when no slide has been created in the admin panel.
const HERO_SLIDES: Slide[] = [
  { title: 'Summer Sale Is Live Now', text: 'Original salon-grade hair care at discounted prices.', cta: 'Shop Now', bg: 'gold' },
  { title: 'Trusted by Professionals', text: 'Hair color, masks, shampoos & treatments in one place.', cta: 'Browse Products', bg: 'amber' },
  { title: 'Cash on Delivery', text: 'Order today and pay when it reaches your door.', cta: 'Order Now', bg: 'green' }
];

// Shop data saved by the last visit (see writeShopCache) - lets a reload show the real shop at once.
const BOOT_CACHE: any = readShopCache();

// Shrinks a picked image and returns it as a JPEG data URL.
function resizeImage(file: File, maxW: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('This file is not an image.'));
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// Uploads a data-URL image to Supabase Storage (bucket "site-assets") and returns its public link.
// If the upload is not possible the image stays embedded (it still works, the page is just heavier).
async function uploadSiteImage(dataUrl: string, prefix: 'slide'): Promise<string> {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from('site-assets').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    return supabase.storage.from('site-assets').getPublicUrl(path).data.publicUrl;
  } catch (err) {
    console.warn('Image upload failed, keeping the embedded image', err);
    return dataUrl;
  }
}

const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#f1f5f9"/><text x="150" y="155" font-family="Arial" font-size="18" fill="#94a3b8" text-anchor="middle">No image</text></svg>');

// ---- Search: short names, part of a word, several words and small spelling mistakes all match ----
const normText = (t: string) => (t || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();

function withinOneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function isSubsequence(q: string, w: string) {
  let i = 0;
  for (const ch of w) if (ch === q[i]) i++;
  return i === q.length;
}

function wordScore(t: string, words: string[]) {
  let best = 0;
  for (const w of words) {
    if (!w) continue;
    let sc = 0;
    if (w === t) sc = 3;
    else if (w.startsWith(t)) sc = 2.5;
    else if (t.length >= 2 && w.includes(t)) sc = 1.5;
    else if (t.length >= 3 && w[0] === t[0] && isSubsequence(t, w)) sc = 1; // "strtng" -> "straightening"
    else if (t.length >= 4 && (withinOneEdit(t, w) || withinOneEdit(t, w.slice(0, t.length)))) sc = 0.8; // small typo
    if (sc > best) best = sc;
  }
  return best;
}

// 0 = no match; higher = better match
function searchScore(p: { name: string; category_name?: string; description?: string }, query: string) {
  const terms = normText(query).split(' ').filter(Boolean);
  if (terms.length === 0) return 1;
  const nameWords = normText(p.name).split(' ');
  const otherWords = normText(`${p.category_name || ''} ${p.description || ''}`).split(' ');
  const nameJoined = nameWords.join('');
  let total = 0;
  for (const t of terms) {
    let best = Math.max(wordScore(t, nameWords) * 2, wordScore(t, otherWords));
    if (!best && t.length >= 3 && nameJoined.includes(t)) best = 2; // "500ml" matches "500 ML"
    if (!best) return 0;
    total += best;
  }
  return total;
}

const money = (n: number | string | null | undefined) => 'Rs. ' + Number(n || 0).toLocaleString('en-PK');

export default function App() {
  // a link like  /?track=SK-261022-1005  opens the Track Order page
  const [currentView, setCurrentView] = useState<'store' | 'login' | 'admin' | 'auth' | 'account' | 'track'>(
    () => (new URLSearchParams(window.location.search).has('track') ? 'track' : 'store')
  );
  const [courierEdit, setCourierEdit] = useState<{ order: Order; courier: string; tracking_no: string; tracking_url: string; ship: boolean } | null>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('look');
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  // Customer account (Supabase Auth)
  const [authUser, setAuthUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  // Item the visitor wanted to add before logging in; added automatically after login / sign-up
  const [pendingCart, setPendingCart] = useState<{ product: Product; qty: number; variant?: Variant; buyNow?: boolean } | null>(null);
  
  // Store States
  const [products, setProducts] = useState<Product[]>(BOOT_CACHE?.products || []);
  const [categories, setCategories] = useState<Category[]>(BOOT_CACHE?.categories || []);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shareItem, setShareItem] = useState<{ title: string; url: string } | null>(null);
  const [qvVariant, setQvVariant] = useState<string>('');
  // Admin: city filter + sort for Orders and Customers
  const [orderCity, setOrderCity] = useState('All');
  const [orderSort, setOrderSort] = useState<'new' | 'old' | 'city' | 'amount'>('new');
  const [custCity, setCustCity] = useState('All');
  const [custSort, setCustSort] = useState<'new' | 'name' | 'city' | 'spent'>('new');
  const [sortBy, setSortBy] = useState<'best' | 'low' | 'high' | 'new' | 'popular'>('best');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rvName, setRvName] = useState('');
  const [rvEmail, setRvEmail] = useState('');
  const [rvPhone, setRvPhone] = useState('');
  const [qvQty, setQvQty] = useState(1);
  const [rvRating, setRvRating] = useState(5);
  const [rvRemark, setRvRemark] = useState('');
  const [purchased, setPurchased] = useState<{ order_id: string; customer_name: string; items: { id: string; name: string }[] } | null>(null);
  const [rateDrafts, setRateDrafts] = useState<Record<string, { rating: number; remark: string; done?: boolean }>>({});
  // checkout customer details
  const [geo, setGeo] = useState<GeoValue>(emptyGeo());
  const [customerEmail, setCustomerEmail] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  // Online payment details asked from the customer
  const [payAccountId, setPayAccountId] = useState<string>('');
  const [payerName, setPayerName] = useState('');
  const [payerAccount, setPayerAccount] = useState('');
  const [payerAmount, setPayerAmount] = useState('');
  const [payerPaidAt, setPayerPaidAt] = useState('');
  const [paymentProof, setPaymentProof] = useState('');
  const [proofView, setProofView] = useState<string | null>(null);
  const [settings, setSettings] = useState<StoreSettings>(BOOT_CACHE?.settings ? mergeSettings(BOOT_CACHE.settings) : defaultSettings);
  const [booted, setBooted] = useState<boolean>(!!BOOT_CACHE?.settings); // true = something real to show
  const [fresh, setFresh] = useState(false); // true = data from the database has arrived
  const [notifyCustomers, setNotifyCustomers] = useState(false);
  const [cOptIn, setCOptIn] = useState(true);
  const [campSubject, setCampSubject] = useState('');
  const [campMessage, setCampMessage] = useState('');
  const [campBusy, setCampBusy] = useState(false);
  const [placedInvoice, setPlacedInvoice] = useState<{ order: any; items: InvoiceItem[] } | null>(null);
  const [invoiceView, setInvoiceView] = useState<{ order: any; items: InvoiceItem[] } | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState('');
  // customers (admin)
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cGeo, setCGeo] = useState<GeoValue>(emptyGeo());
  const [customerSearch, setCustomerSearch] = useState('');
  // payments (admin)
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payModal, setPayModal] = useState<Order | null>(null);
  const [pmAmount, setPmAmount] = useState('');
  const [pmMethod, setPmMethod] = useState('cash');
  const [pmRef, setPmRef] = useState('');
  const [pmNote, setPmNote] = useState('');
  const [pmDate, setPmDate] = useState('');
  // edit order (admin)
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [eoName, setEoName] = useState('');
  const [eoPhone, setEoPhone] = useState('');
  const [eoEmail, setEoEmail] = useState('');
  const [eoAddress, setEoAddress] = useState('');
  // hero slides
  const [slides, setSlides] = useState<Slide[]>(BOOT_CACHE?.slides || []);
  const [slideBusy, setSlideBusy] = useState('');
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [slTitle, setSlTitle] = useState('');
  const [slText, setSlText] = useState('');
  const [slCta, setSlCta] = useState('');
  const [slBg, setSlBg] = useState('gold');
  const [slImage, setSlImage] = useState('');
  const [slActive, setSlActive] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState<'All' | 'Unpaid' | 'Partial' | 'Paid'>('All');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Admin Portal States
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [loggedInUserRole, setLoggedInUserRole] = useState('Super Admin');
  const [loggedInUserName, setLoggedInUserName] = useState('');
  const [adminTab, setAdminTab] = useState<'dashboard' | 'ai' | 'products' | 'categories' | 'orders' | 'users' | 'accounts' | 'notifications' | 'payments' | 'reviews' | 'customers' | 'slides' | 'settings'>('dashboard');

  // Product Form State (Add / Edit)
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [discountedPrice, setDiscountedPrice] = useState('');
  const [productStock, setProductStock] = useState('');
  const [pVariants, setPVariants] = useState<{ name: string; price: string; original_price: string; stock: string; color: string }[]>([]);
  const [pVariantLabel, setPVariantLabel] = useState('Size');
  const [bulkShades, setBulkShades] = useState<string | null>(null); // "add many" text box (one name per line)
  const [productCategory, setProductCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Category State
  const [newCategoryName, setNewCategoryName] = useState('');

  // Admin Data Lists
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [notif, setNotif] = useState({
    email_enabled: false,
    email_to: '',
    whatsapp_enabled: false,
    whatsapp_phone: ''
  });
  const [notifBusy, setNotifBusy] = useState(false);

  // Payment Accounts State (including UBL, EasyPaisa, JazzCash etc with full custom add/delete support)
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([
    { id: '1', type: 'EasyPaisa', account_number: '0300-1234567', account_title: 'Zorima Official Account', is_active: true },
    { id: '2', type: 'JazzCash', account_number: '0300-7654321', account_title: 'Zorima Business Account', is_active: true },
    { id: '3', type: 'UBL Bank', account_number: 'PK12-UBL-0000-1234-5678', account_title: 'Zorima UBL Account', is_active: true },
    { id: '4', type: 'Meezan Bank', account_number: 'PK12-MEZN-0000-1234-5678', account_title: 'Zorima Meezan Account', is_active: true }
  ]);

  // Editing Admin User State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('Staff Admin');

  // Editing Account State
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState('UBL Bank');
  const [accNumber, setAccNumber] = useState('');
  const [accTitle, setAccTitle] = useState('');

  // Customer Checkout Form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shipAddr, setShipAddr] = useState<PkAddress>(emptyPkAddress()); // checkout address (Pakistan)
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cod');
  const [transactionId, setTransactionId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [confirmedInvoice, setConfirmedInvoice] = useState('');

  useEffect(() => {
    // Show a short loading screen (first visit only) instead of the built-in default look.
    const giveUp = setTimeout(() => setBooted(true), 6000);
    Promise.all([
      fetchProducts(),
      fetchCategories(),
      fetchSlides(),
      fetchStoreSettings(supabase).then(setSettings)
    ]).finally(() => {
      clearTimeout(giveUp);
      setFresh(true);
      setBooted(true);
    });
    fetchPaymentAccounts();
    fetchReviews();
  }, []);

  // Customer login state (also handles the "set a new password" link from the email)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => setAuthUser(data && data.session ? data.session.user : null));
    const { data: sub } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      setAuthUser(session ? session.user : null);
      if (event === 'PASSWORD_RECOVERY') { setAuthMode('reset'); setCurrentView('auth'); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // After login / sign-up: add the item the customer wanted, then go back to the shop
  useEffect(() => {
    if (!authUser || !pendingCart) return;
    const pc = pendingCart;
    setPendingCart(null);
    setCurrentView('store');
    if (addToCart(pc.product, pc.qty, pc.variant, false, true) && pc.buyNow) setIsCartOpen(true);
  }, [authUser]);

  // Logged-in customer: fill the checkout form from his profile
  useEffect(() => {
    if (!authUser) return;
    const m = authUser.user_metadata || {};
    if (m.name) setCustomerName(prev => prev || m.name);
    if (authUser.email) setCustomerEmail(prev => prev || authUser.email);
    const saved = addressFromMeta(m);
    setShipAddr(prev => {
      // keep what the customer already typed; fill only the empty parts
      if (prev.province && saved.province && prev.province !== saved.province) return { ...prev, mobile: prev.mobile || saved.mobile };
      return {
        mobile: prev.mobile || saved.mobile,
        province: prev.province || saved.province,
        city: prev.city || saved.city,
        area: prev.area || saved.area,
        address: prev.address || saved.address,
        zip: prev.zip || saved.zip
      };
    });
  }, [authUser, isCartOpen]);

  // Cash on Delivery only inside Karachi (Settings > Delivery Charges)
  const codAllowed = !settings.cod_karachi_only || !shipAddr.city || shipAddr.city.trim().toLowerCase() === 'karachi';
  useEffect(() => {
    if (!codAllowed && paymentMethod === 'cod') {
      const acc = paymentAccounts.find(a => a.is_active !== false);
      if (acc) {
        setPaymentMethod('online');
        if (!payAccountId) setPayAccountId(acc.id);
        const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        if (!payerPaidAt) setPayerPaidAt(d.toISOString().slice(0, 16));
        if (!payerAmount) setPayerAmount(String(totalAmount));
      }
    }
  }, [codAllowed]);

  // Back / forward buttons open or close the product page
  useEffect(() => {
    const onPop = () => {
      const id = new URLSearchParams(window.location.search).get('product');
      setQuickView(id ? (products.find(p => p.id === id) || null) : null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [products]);

  // A shared product link (?product=<id>) opens that product
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('product');
    if (!id || quickView) return;
    const hit = products.find(p => p.id === id);
    if (hit) { setQuickView(hit); setQvQty(1); }
  }, [products]);

  // Remember the latest shop data for the next visit.
  useEffect(() => {
    if (fresh) writeShopCache({ settings, slides, categories, products });
  }, [fresh, settings, slides, categories, products]);

  useEffect(() => {
    document.title = settings.store_name || 'Online Store';
  }, [settings.store_name]);

  useEffect(() => {
    setNotifyCustomers(settings.notify_new_product);
  }, [settings.notify_new_product]);

  useEffect(() => {
    const t = setInterval(() => setHeroIndex(i => i + 1), 5000);
    return () => clearInterval(t);
  }, []);

  function reportError(where: string, error: { message: string } | null | undefined) {
    if (!error) return false;
    console.error(`[Supabase] ${where}:`, error);
    setDbError(`${where}: ${error.message}`);
    alert(`Database error (${where}):\n${error.message}`);
    return true;
  }

  async function fetchCategories() {
    const { data, error } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
    if (error) { console.error('categories fetch', error); setDbError(`categories: ${error.message}`); return; }
    setCategories(data || []);
  }

  async function fetchProducts() {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) { console.error('products fetch', error); setDbError(`products: ${error.message}`); return; }
    setProducts(data || []);
  }

  async function fetchPaymentAccounts() {
    const { data, error } = await supabase.from('payment_accounts').select('*').order('created_at', { ascending: true });
    if (error) { console.error('payment_accounts fetch', error); return; }
    if (data && data.length > 0) setPaymentAccounts(data);
  }

  async function fetchUsers() {
    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) { reportError('admin users fetch', error); return; }
    setAdminUsers(data || []);
  }

  async function fetchOrders() {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { reportError('orders fetch', error); return; }

    const list: Order[] = orders || [];
    if (list.length > 0) {
      const { data: items, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', list.map(o => o.id));
      if (itemsErr) { reportError('order items fetch', itemsErr); }
      list.forEach(o => {
        o.order_items = (items || []).filter((it: any) => it.order_id === o.id);
      });
    }
    setAdminOrders(list);
  }

  async function fetchReviews() {
    // Visitors only get name / stars / remark; a logged-in admin also gets the reviewer's email and phone.
    const { data, error } = getAdminToken()
      ? await supabase.rpc('admin_list_reviews')
      : await supabase.from('reviews')
          .select('id, product_id, order_id, customer_name, rating, remark, created_at')
          .order('created_at', { ascending: false });
    if (error) { console.error('reviews fetch', error); return; }
    setReviews(data || []);
  }

  const ratingOf = (pid: string) => {
    const rs = reviews.filter(r => r.product_id === pid);
    const count = rs.length;
    const avg = count ? rs.reduce((a, r) => a + r.rating, 0) / count : 0;
    return { avg, count };
  };

  const renderStars = (value: number, cls = 'w-3.5 h-3.5') => (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`${cls} ${n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
      ))}
    </span>
  );

  const starPicker = (value: number, onChange: (n: number) => void) => (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)} className="cursor-pointer" aria-label={`${n} star`}>
          <Star className={`w-6 h-6 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
        </button>
      ))}
    </span>
  );

  async function submitReview(
    product_id: string,
    order_id: string | null,
    customer_name: string,
    rating: number,
    remark: string,
    email = '',
    phone = ''
  ) {
    if (order_id && reviews.some(r => r.order_id === order_id && r.product_id === product_id)) {
      alert('A review for this product has already been submitted for this order.');
      return false;
    }
    const { data, error } = await supabase.rpc('submit_review', {
      p_product_id: product_id,
      p_order_id: order_id,
      p_name: customer_name,
      p_rating: rating,
      p_remark: remark.trim(),
      p_email: email.trim(),
      p_phone: phone.trim()
    });
    if (reportError('review', error)) return false;
    if (data) setReviews(prev => [data, ...prev]);
    return true;
  }

  const handleSubmitReview = async (product: Product) => {
    if (!rvName.trim()) { alert('Please enter your name.'); return; }
    const ok = await submitReview(product.id, null, rvName.trim(), rvRating, rvRemark, rvEmail, rvPhone);
    if (ok) {
      alert('Thank you! Your review has been submitted.');
      setRvName(''); setRvEmail(''); setRvPhone(''); setRvRemark(''); setRvRating(5);
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!window.confirm('Delete this review?')) return;
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (reportError('review delete', error)) return;
    setReviews(prev => prev.filter(r => r.id !== id));
  };

  // ---- Payments ----
  const payInfo = (o: Order) => {
    const total = Number(o.total_amount || 0);
    const paid = Number(o.paid_amount || 0);
    const status = total > 0 && paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';
    return { total, paid, balance: Math.max(total - paid, 0), status };
  };

  const nowLocalInput = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const openPayModal = (o: Order) => {
    setPayModal(o);
    setPmAmount(String(payInfo(o).balance));
    setPmMethod('cash');
    setPmRef('');
    setPmNote('');
    setPmDate(nowLocalInput());
  };

  const updateOrderPaid = async (orderId: string, total: number, newPaid: number) => {
    const paid = Math.max(0, Math.min(newPaid, total));
    const label = total > 0 && paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';
    const paid_at = paid > 0 ? new Date().toISOString() : null;
    const { error } = await supabase
      .from('orders').update({ paid_amount: paid, payment_status: label, paid_at }).eq('id', orderId);
    if (reportError('order payment update', error)) return false;
    setAdminOrders(prev => prev.map(x => x.id === orderId ? { ...x, paid_amount: paid, payment_status: label, paid_at } : x));
    return true;
  };

  const handleSavePaymentEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const o = payModal;
    if (!o) return;
    const info = payInfo(o);
    const amt = parseFloat(pmAmount);
    if (isNaN(amt) || amt <= 0) { alert('Please enter a valid amount.'); return; }
    if (amt > info.balance + 0.0001) { alert(`Amount cannot be more than the balance (PKR ${info.balance}).`); return; }

    let method = 'Cash';
    let category = 'Cash';
    let account_id: string | null = null;
    let account_label = 'Cash';
    if (pmMethod.startsWith('acc:')) {
      const a = paymentAccounts.find(x => x.id === pmMethod.slice(4));
      if (a) {
        method = a.type;
        category = /easypaisa|jazzcash|sadapay|nayapay|upaisa|wallet/i.test(a.type) ? 'Mobile Wallet' : 'Bank Transfer';
        account_id = a.id;
        account_label = `${a.type} - ${a.account_title} (${a.account_number})`;
      }
    } else if (pmMethod === 'other') {
      method = 'Other';
      category = 'Other';
      account_label = 'Other';
    }

    const received_at = pmDate ? new Date(pmDate).toISOString() : new Date().toISOString();
    const { data, error } = await supabase.from('payments').insert([{
      order_id: o.id,
      amount: amt,
      method,
      category,
      account_id,
      account_label,
      reference: pmRef.trim() || null,
      note: pmNote.trim() || null,
      received_at
    }]).select();
    if (reportError('payment insert', error)) return;
    if (data && data[0]) setPayments(prev => [data[0], ...prev]);
    await updateOrderPaid(o.id, info.total, info.paid + amt);
    setPayModal(null);
  };

  const handleDeletePaymentEntry = async (pay: Payment) => {
    if (!window.confirm('Delete this payment entry?')) return;
    const { error } = await supabase.from('payments').delete().eq('id', pay.id);
    if (reportError('payment delete', error)) return;
    setPayments(prev => prev.filter(x => x.id !== pay.id));
    const o = adminOrders.find(x => x.id === pay.order_id);
    if (o) await updateOrderPaid(o.id, Number(o.total_amount || 0), Number(o.paid_amount || 0) - Number(pay.amount));
  };

  const handleResetOrderPayments = async (o: Order) => {
    if (!window.confirm('Remove all payments of this order and set it back to Unpaid?')) return;
    const { error } = await supabase.from('payments').delete().eq('order_id', o.id);
    if (reportError('payments reset', error)) return;
    setPayments(prev => prev.filter(x => x.order_id !== o.id));
    await updateOrderPaid(o.id, Number(o.total_amount || 0), 0);
  };

  async function fetchPayments() {
    const { data, error } = await supabase.from('payments').select('*').order('received_at', { ascending: false });
    if (error) { reportError('payments fetch', error); return; }
    setPayments(data || []);
  }

  // ---- Edit order ----
  const openEditOrder = (o: Order) => {
    setEditOrder(o);
    setEoName(o.customer_name || '');
    setEoPhone(o.customer_phone || '');
    setEoEmail(o.customer_email || '');
    setEoAddress(o.shipping_address || '');
  };

  const handleSaveEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrder) return;
    if (!eoName.trim() || eoPhone.replace(/\D/g, '').length < 7) {
      alert('Please enter a name and a valid phone number.');
      return;
    }
    const patch = {
      customer_name: eoName.trim(),
      customer_phone: eoPhone.trim(),
      customer_email: eoEmail.trim() || null,
      shipping_address: eoAddress.trim()
    };
    const { error } = await supabase.from('orders').update(patch).eq('id', editOrder.id);
    if (reportError('order update', error)) return;
    setAdminOrders(prev => prev.map(x => x.id === editOrder.id ? { ...x, ...patch } : x));
    setEditOrder(null);
  };

  // ---- Customers ----
  const last10 = (v: any) => String(v ?? '').replace(/\D/g, '').slice(-10);

  async function fetchCustomers() {
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (error) { reportError('customers fetch', error); return; }
    setCustomers(data || []);
  }

  const resetCustomerForm = () => {
    setEditingCustomerId(null);
    setCName(''); setCEmail(''); setCAddress('');
    setCOptIn(true);
    setCGeo(emptyGeo());
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim()) { alert('Customer name is required.'); return; }
    if (!localNumber(cGeo.phoneNumber)) { alert('Mobile number is required.'); return; }

    const r = await resolveGeo(cGeo);
    const row = {
      name: cName.trim(),
      email: cEmail.trim() || null,
      phone_iso: cGeo.phoneIso,
      phone_code: r.phoneCode,
      phone: localNumber(cGeo.phoneNumber),
      country_iso: cGeo.countryIso,
      country: r.countryName,
      province_iso: cGeo.stateIso,
      province: r.stateName,
      city: cGeo.city,
      address: cAddress.trim(),
      marketing_opt_in: cOptIn
    };

    const dup = customers.find(c => c.id !== editingCustomerId && c.phone_code === row.phone_code && c.phone === row.phone);
    if (dup) { alert(`A customer with this mobile number already exists (${dup.name}).`); return; }

    if (editingCustomerId) {
      const { error } = await supabase.from('customers').update(row).eq('id', editingCustomerId);
      if (reportError('customer update', error)) return;
      alert('Customer updated successfully!');
    } else {
      const { error } = await supabase.from('customers').insert([row]);
      if (reportError('customer insert', error)) return;
      alert('Customer saved successfully!');
    }
    resetCustomerForm();
    fetchCustomers();
  };

  const handleEditCustomer = (c: Customer) => {
    setEditingCustomerId(c.id);
    setCName(c.name || '');
    setCEmail(c.email || '');
    setCAddress(c.address || '');
    setCOptIn(c.marketing_opt_in !== false);
    setCGeo({
      countryIso: c.country_iso || 'PK',
      stateIso: c.province_iso || '',
      city: c.city || '',
      phoneIso: c.phone_iso || c.country_iso || 'PK',
      phoneNumber: c.phone || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCustomer = async (c: Customer) => {
    if (!window.confirm(`Delete customer "${c.name}"? Their past orders will stay.`)) return;
    const { error } = await supabase.from('customers').delete().eq('id', c.id);
    if (reportError('customer delete', error)) return;
    setCustomers(prev => prev.filter(x => x.id !== c.id));
  };

  // ---- Hero slides ----
  async function fetchSlides() {
    const { data, error } = await supabase.from('hero_slides').select('*').order('sort_order', { ascending: true });
    if (error) { console.error('hero_slides fetch', error); return; }
    setSlides(data || []);
  }

  const resetSlideForm = () => {
    setEditingSlideId(null);
    setSlTitle(''); setSlText(''); setSlCta(''); setSlBg('gold'); setSlImage(''); setSlActive(true);
  };

  const handleSlideImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try { setSlImage(await resizeImage(file, 1600)); } catch (err: any) { alert(err.message || String(err)); }
  };

  // Adds one picture-only slide per selected image (pick 5-6 images at once).
  const handleAddManySlides = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    let next = slides.reduce((m, x) => Math.max(m, x.sort_order || 0), 0) + 1;
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      setSlideBusy(`Uploading image ${i + 1} of ${files.length}...`);
      try {
        const url = await uploadSiteImage(await resizeImage(files[i], 1600), 'slide');
        const { error } = await supabase.from('hero_slides')
          .insert([{ title: '', text: '', cta: '', bg: 'gold', image_url: url, active: true, sort_order: next++ }]);
        if (reportError('slide insert', error)) break;
        added++;
      } catch (err: any) {
        alert(`${files[i].name}: ${err.message || err}`);
      }
    }
    setSlideBusy('');
    await fetchSlides();
    if (added) alert(`${added} banner image(s) added. They will change automatically on the home page.`);
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slTitle.trim() && !slImage) { alert('Add a picture, or a title, for this slide.'); return; }
    setSlideBusy('Saving...');
    const imageUrl = slImage ? await uploadSiteImage(slImage, 'slide') : null;
    setSlideBusy('');
    const row = { title: slTitle.trim(), text: slText.trim(), cta: slCta.trim(), bg: slBg, image_url: imageUrl, active: slActive };
    if (editingSlideId) {
      const { error } = await supabase.from('hero_slides').update(row).eq('id', editingSlideId);
      if (reportError('slide update', error)) return;
      alert('Slide updated successfully!');
    } else {
      const next = slides.reduce((m, x) => Math.max(m, x.sort_order || 0), 0) + 1;
      const { error } = await supabase.from('hero_slides').insert([{ ...row, sort_order: next }]);
      if (reportError('slide insert', error)) return;
      alert('Slide added successfully!');
    }
    resetSlideForm();
    fetchSlides();
  };

  const handleEditSlide = (sl: Slide) => {
    setEditingSlideId(sl.id || null);
    setSlTitle(sl.title); setSlText(sl.text || ''); setSlCta(sl.cta || '');
    setSlBg(sl.bg || 'gold'); setSlImage(sl.image_url || ''); setSlActive(sl.active !== false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSlide = async (id: string) => {
    if (!window.confirm('Delete this slide?')) return;
    const { error } = await supabase.from('hero_slides').delete().eq('id', id);
    if (reportError('slide delete', error)) return;
    setSlides(prev => prev.filter(x => x.id !== id));
  };

  const handleToggleSlide = async (sl: Slide) => {
    const { error } = await supabase.from('hero_slides').update({ active: !(sl.active !== false) }).eq('id', sl.id);
    if (reportError('slide toggle', error)) return;
    fetchSlides();
  };

  const handleMoveSlide = async (index: number, dir: -1 | 1) => {
    const a = slides[index];
    const b = slides[index + dir];
    if (!a || !b) return;
    const e1 = await supabase.from('hero_slides').update({ sort_order: b.sort_order }).eq('id', a.id);
    const e2 = await supabase.from('hero_slides').update({ sort_order: a.sort_order }).eq('id', b.id);
    if (reportError('slide reorder', e1.error || e2.error)) return;
    fetchSlides();
  };

  const callCustomersFunction = async (payload: any): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('notify-customers', {
      body: { ...payload, site_url: window.location.origin }
    });
    if (error) return 'Customer emails could not be sent: ' + error.message + ' (is the "notify-customers" Edge Function deployed?)';
    if (data && data.error) return 'Customer emails failed: ' + data.error;
    return `Customer emails: ${data.sent} sent, ${data.failed} failed.${data.note ? ' ' + data.note : ''}`;
  };

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campSubject.trim() || !campMessage.trim()) { alert('Please enter a subject and a message.'); return; }
    if (!window.confirm('Send this email to all customers who agreed to receive offers?')) return;
    setCampBusy(true);
    const msg = await callCustomersFunction({ type: 'custom', subject: campSubject.trim(), message: campMessage.trim() });
    setCampBusy(false);
    alert(msg);
    if (msg.startsWith('Customer emails:')) { setCampSubject(''); setCampMessage(''); }
  };

  const openInvoice = (o: Order) =>
    setInvoiceView({
      order: o,
      items: (o.order_items || []).map((it: any) => ({ product_name: it.product_name, quantity: it.quantity, unit_price: it.unit_price }))
    });

  const handleEmailInvoice = async (o: any) => {
    if (!o.customer_email) { alert('This order has no customer email. Use Edit order to add one first.'); return; }
    const { data, error } = await supabase.functions.invoke('notify-order', {
      body: { order_id: o.id, resend_invoice: true, site_url: window.location.origin }
    });
    if (error) { alert('Could not send: ' + error.message + ' (is the "notify-order" Edge Function deployed?)'); return; }
    if (data && data.error) { alert('Could not send: ' + data.error); return; }
    alert('Invoice email result: ' + (data && data.invoice_email ? data.invoice_email : 'unknown'));
  };

  async function fetchNotifSettings() {
    const { data, error } = await supabase.from('notification_settings').select('*').eq('id', 1).maybeSingle();
    if (error) { console.error('notification_settings fetch', error); return; }
    if (data) {
      setNotif({
        email_enabled: !!data.email_enabled,
        email_to: data.email_to || '',
        whatsapp_enabled: !!data.whatsapp_enabled,
        whatsapp_phone: data.whatsapp_phone || ''
      });
    }
  }

  const saveNotifSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('notification_settings').upsert({
      id: 1,
      ...notif,
      updated_at: new Date().toISOString()
    });
    if (reportError('notification settings save', error)) return;
    alert('Notification settings saved!');
  };

  const sendTestAlert = async () => {
    setNotifBusy(true);
    const { data, error } = await supabase.functions.invoke('notify-order', { body: { test: true } });
    setNotifBusy(false);
    if (error) {
      alert('Test alert failed. Is the Edge Function "notify-order" deployed?\n' + error.message);
      return;
    }
    alert(data && data.error ? 'Test failed: ' + data.error : 'Test result:\n' + JSON.stringify(data, null, 2));
  };

  function beep() {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      osc.frequency.value = 880;
      osc.connect(ctx.destination);
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 350);
    } catch (e) { /* ignore */ }
  }

  // Live alert for new orders while the admin is logged in: checks for new orders every 20 seconds.
  useEffect(() => {
    if (!isAdminLoggedIn) return;
    let lastSeen = new Date().toISOString();
    const timer = setInterval(async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, invoice_no, customer_name, total_amount, created_at')
        .gt('created_at', lastSeen)
        .order('created_at', { ascending: true });
      if (error || !data || data.length === 0) return;
      lastSeen = data[data.length - 1].created_at;
      const o: any = data[data.length - 1];
      setNewOrderCount(c => c + data.length);
      setToastMessage(`NEW ORDER ${o.invoice_no || ''} - ${o.customer_name || ''} - PKR ${o.total_amount || ''}`);
      setTimeout(() => setToastMessage(null), 9000);
      beep();
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New Order Received', { body: `${o.customer_name || ''} - PKR ${o.total_amount || ''}` });
        }
      } catch (e) { /* ignore */ }
      fetchOrders();
    }, 20000);
    return () => clearInterval(timer);
  }, [isAdminLoggedIn]);

  const handleDeleteOrder = async (o: Order) => {
    if (!window.confirm(`Delete order ${o.invoice_no || ''} of ${o.customer_name}?\n\nThis cannot be undone.`)) return;
    const restock = o.status !== 'Delivered' &&
      window.confirm('Put the items of this order back in stock?\n\nOK = yes, add them back\nCancel = no, keep the stock as it is');
    const { error } = await supabase.rpc('admin_delete_order', { p_id: o.id, p_restock: restock });
    if (reportError('delete order', error)) return;
    setAdminOrders(prev => prev.filter(x => x.id !== o.id));
    if (restock) fetchProducts();
    setToastMessage(`Order ${o.invoice_no || ''} deleted`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const showPaymentProof = async (orderId: string) => {
    const { data, error } = await supabase.from('payment_proofs').select('image').eq('order_id', orderId).maybeSingle();
    if (reportError('payment screenshot', error)) return;
    if (!data || !data.image) { alert('No screenshot found.'); return; }
    setProofView(data.image);
  };

  const handleUpdateOrderStatus = async (id: string, status: string) => {
    const now = new Date().toISOString();
    const cur: any = adminOrders.find(o => o.id === id) || {};
    const patch: any = { status, delivered_at: status === 'Delivered' ? now : null };
    // remember when each step happened (shown to the customer on "Track Order")
    if (['Confirmed', 'Shipped', 'Delivered'].includes(status) && !cur.confirmed_at) patch.confirmed_at = now;
    if (['Shipped', 'Delivered'].includes(status) && !cur.shipped_at) patch.shipped_at = now;
    const { error } = await supabase.from('orders').update(patch).eq('id', id);
    if (reportError('order status update', error)) return;
    setAdminOrders(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
  };

  // Courier + tracking number for an order (Admin > Orders)
  const saveCourier = async () => {
    if (!courierEdit) return;
    const { order, courier, tracking_no, tracking_url, ship } = courierEdit;
    const now = new Date().toISOString();
    const cur: any = order;
    const patch: any = { courier: courier || null, tracking_no: tracking_no.trim() || null, tracking_url: tracking_url.trim() || null };
    if (ship && order.status !== 'Delivered') {
      patch.status = 'Shipped';
      if (!cur.shipped_at) patch.shipped_at = now;
      if (!cur.confirmed_at) patch.confirmed_at = now;
    }
    const { error } = await supabase.from('orders').update(patch).eq('id', order.id);
    if (reportError('courier save', error)) return;
    setAdminOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...patch } : o));
    setCourierEdit(null);
  };

  const trackingMessage = (o: any) => {
    const link = trackingLink(o);
    return `Assalam o Alaikum ${o.customer_name}! Your order ${o.invoice_no || ''} from ${settings.store_name} has been shipped.` +
      (o.courier ? `\nCourier: ${o.courier}` : '') +
      (o.tracking_no ? `\nTracking no: ${o.tracking_no}` : '') +
      (link ? `\nTrack: ${link}` : '') +
      `\nOrder status: ${window.location.origin}/?track=${encodeURIComponent(o.invoice_no || '')}`;
  };

  const fmtDateTime = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '-';

  const waLink = (phone: string, text: string) => {
    let d = (phone || '').replace(/\D/g, '');
    if (d.startsWith('0')) d = '92' + d.slice(1);
    return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // The password is checked inside the database (admin_login); it is never downloaded to the browser.
    const { data, error } = await supabase.rpc('admin_login', { p_username: adminUsername.trim(), p_password: adminPassword });
    if (error) { reportError('login', error); return; }
    if (!data || !data.ok) {
      alert((data && data.error) || 'Invalid User ID or Password!');
      return;
    }
    const user = data;
    setAdminToken(data.token);
    setAdminPassword('');
    setIsAdminLoggedIn(true);
    setLoggedInUserRole(user.role);
    setLoggedInUserName(user.username);
    setCurrentView('admin');
    setAdminTab('dashboard');
    setNewOrderCount(0);
    fetchOrders();
    fetchUsers();
    fetchNotifSettings();
    fetchCustomers();
    fetchPayments();
    fetchReviews();
    fetchPaymentAccounts();
    if (data.weak_password) {
      setAdminTab('users');
      alert('Your password is too weak (for example "123").\nPlease set a new password of at least 6 characters now: Admin Users > Edit.');
    }
    try {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    } catch (err) { /* ignore */ }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Result = reader.result as string;
        setImagePreview(base64Result);
        setImageUrl(base64Result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanVariants: Variant[] = pVariants
      .filter(v => v.name.trim())
      .map(v => ({
        name: v.name.trim(),
        price: parseFloat(v.price) || 0,
        original_price: parseFloat(v.original_price) || parseFloat(v.price) || 0,
        stock: parseInt(v.stock) || 0,
        ...(v.color ? { color: v.color } : {})
      }));
    if (cleanVariants.some(v => !(v.price > 0))) { alert('Please enter a selling price for every size.'); return; }
    if (!productName || (!discountedPrice && cleanVariants.length === 0)) {
      alert('Product Name and Discounted Price are required!');
      return;
    }
    // With sizes, the product shows the cheapest size's price and the total stock of all sizes
    const cheapest = cleanVariants.slice().sort((a, b) => a.price - b.price)[0];

    setIsUploading(true);
    let finalImageUrl = imageUrl || imagePreview || 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=500&auto=format&fit=crop&q=60';

    const prodData = {
      name: productName,
      description: productDesc,
      original_price: cheapest ? Number(cheapest.original_price || cheapest.price) : (parseFloat(originalPrice) || parseFloat(discountedPrice)),
      discounted_price: cheapest ? cheapest.price : parseFloat(discountedPrice),
      price: cheapest ? cheapest.price : parseFloat(discountedPrice),
      category_name: productCategory || 'Hair Care',
      image_url: finalImageUrl,
      stock_quantity: cheapest ? cleanVariants.reduce((t, v) => t + v.stock, 0) : (parseInt(productStock) || 0),
      variants: cleanVariants.length ? cleanVariants : null,
      variant_label: cleanVariants.length ? (pVariantLabel.trim() || 'Size') : null
    };

    if (editingProductId) {
      const { data, error } = await supabase.from('products').update(prodData).eq('id', editingProductId).select();
      if (reportError('product update', error)) { setIsUploading(false); return; }
      setProducts(prev => prev.map(p => p.id === editingProductId ? (data && data[0] ? data[0] : { ...p, ...prodData }) : p));
      alert('Product updated successfully!');
    } else {
      const { data, error } = await supabase.from('products').insert([prodData]).select();
      if (reportError('product insert', error)) { setIsUploading(false); return; }
      if (data && data[0]) setProducts(prev => [data[0], ...prev]);
      let msg = 'New product saved to database!';
      if (notifyCustomers && data && data[0]) {
        msg += '\n\n' + (await callCustomersFunction({ type: 'product', product_id: data[0].id }));
      }
      alert(msg);
    }

    setIsUploading(false);
    resetProductForm();
  };

  const handleEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setProductName(p.name);
    setProductDesc(p.description);
    setOriginalPrice(String(p.original_price));
    setDiscountedPrice(String(p.discounted_price || p.price));
    setProductStock(String(p.stock_quantity ?? 0));
    setProductCategory(p.category_name);
    setImageUrl(p.image_url);
    setImagePreview(p.image_url);
    setPVariants(variantsOf(p).map(v => ({ name: v.name, price: String(v.price), original_price: String(v.original_price || ''), stock: String(v.stock ?? 0), color: v.color || '' })));
    setPVariantLabel(p.variant_label || 'Size');
    setBulkShades(null);
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (reportError('product delete', error)) return;
      setProducts(prev => prev.filter(p => p.id !== id));
      alert('Product deleted successfully!');
    }
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProductName('');
    setProductDesc('');
    setOriginalPrice('');
    setDiscountedPrice('');
    setProductStock('');
    setProductCategory('');
    setImageUrl('');
    setImageFile(null);
    setImagePreview(null);
    setPVariants([]);
    setPVariantLabel('Size');
    setBulkShades(null);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const { data, error } = await supabase.from('categories').insert([{ name: newCategoryName.trim() }]).select();
    if (reportError('category insert', error)) return;
    if (data && data[0]) setCategories(prev => [...prev, data[0]]);
    setNewCategoryName('');
    alert('New category created successfully!');
  };

  const handleDeleteCategory = async (id: string) => {
    if (window.confirm('Delete this category?')) {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (reportError('category delete', error)) return;
      setCategories(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const uname = newUsername.trim();
    if (!uname) { alert('Please enter a User ID.'); return; }
    if (!editingUserId && !newUserPassword) { alert('Please enter a password.'); return; }
    if (newUserPassword && newUserPassword.length < 6) { alert('Password must be at least 6 characters.'); return; }

    // Passwords are stored as a secure hash inside the database (admin_save_user).
    const { error } = await supabase.rpc('admin_save_user', {
      p_id: editingUserId,
      p_username: uname,
      p_password: newUserPassword,
      p_role: newUserRole
    });
    if (reportError('save user', error)) return;
    alert(editingUserId
      ? 'Admin user updated!'
      : `New admin user (${uname}) saved!\nYou can now log in with this User ID and password.`);
    if (editingUserId && uname.toLowerCase() === loggedInUserName.toLowerCase()) setLoggedInUserName(uname);
    setEditingUserId(null);
    setNewUsername('');
    setNewUserPassword('');
    await fetchUsers(); // reload the list from the database
  };

  const handleEditUser = (u: AdminUser) => {
    setEditingUserId(u.id);
    setNewUsername(u.username);
    setNewUserPassword(''); // empty = keep the current password
    setNewUserRole(u.role);
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('Delete this admin user?')) {
      const { error } = await supabase.rpc('admin_delete_user', { p_id: id });
      if (reportError('delete user', error)) return;
      setAdminUsers(prev => prev.filter(u => u.id !== id));
      alert('Admin user deleted successfully!');
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accNumber || !accTitle) return;

    const row = { type: accountType, account_number: accNumber, account_title: accTitle };

    if (editingAccountId) {
      const { data, error } = await supabase.from('payment_accounts').update(row).eq('id', editingAccountId).select();
      if (reportError('payment account update', error)) return;
      setPaymentAccounts(prev => prev.map(a => a.id === editingAccountId ? (data && data[0] ? data[0] : { ...a, ...row }) : a));
      alert('Payment account updated successfully!');
    } else {
      const { data, error } = await supabase.from('payment_accounts').insert([{ ...row, is_active: true }]).select();
      if (reportError('payment account insert', error)) return;
      if (data && data[0]) setPaymentAccounts(prev => [...prev, data[0]]);
      alert('New payment account added successfully!');
    }
    setEditingAccountId(null);
    setAccNumber('');
    setAccTitle('');
  };

  const handleEditAccount = (a: PaymentAccount) => {
    setEditingAccountId(a.id);
    setAccountType(a.type);
    setAccNumber(a.account_number);
    setAccTitle(a.account_title);
  };

  const handleDeleteAccount = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this payment account?')) {
      const { error } = await supabase.from('payment_accounts').delete().eq('id', id);
      if (reportError('payment account delete', error)) return;
      setPaymentAccounts(prev => prev.filter(a => a.id !== id));
      alert('Payment account deleted successfully!');
    }
  };

  const addToCart = (base: Product, qty = 1, variant?: Variant, buyNow = false, skipLoginCheck = false) => {
    // A product with sizes: the size must be chosen on the product page first
    if (!variant && variantsOf(base).length > 0) { openProduct(base); return false; }
    // Not logged in: ask to log in / register first (like big marketplaces), then add it automatically
    if (!authUser && !skipLoginCheck) {
      setPendingCart({ product: base, qty, variant, buyNow });
      if (quickView) closeProduct();
      setIsCartOpen(false);
      setAuthMode('login');
      setCurrentView('auth');
      window.scrollTo({ top: 0 });
      return false;
    }
    const product: Product = variant
      ? { ...base, discounted_price: Number(variant.price), price: Number(variant.price), original_price: Number(variant.original_price || variant.price), stock_quantity: Number(variant.stock || 0) }
      : base;
    const key = variant ? `${base.id}|${variant.name}` : base.id;
    const inCart = cart.find(i => i.cartKey === key)?.quantity || 0;
    if (typeof product.stock_quantity === 'number' && inCart + qty > product.stock_quantity) {
      setToastMessage(
        product.stock_quantity <= 0
          ? 'Sorry, this product is out of stock.'
          : `Only ${product.stock_quantity} in stock (${inCart} already in your cart).`
      );
      setTimeout(() => setToastMessage(null), 2500);
      return false;
    }
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.cartKey === key);
      if (existing) {
        return prevCart.map((item) =>
          item.cartKey === key ? { ...item, quantity: item.quantity + qty } : item
        );
      }
      return [...prevCart, { ...product, quantity: qty, cartKey: key, variant: variant ? variant.name : undefined, variantLabel: base.variant_label || 'Size' }];
    });

    setToastMessage(`${qty} x ${product.name}${variant ? ` (${variant.name})` : ''} added to cart!`);
    setTimeout(() => setToastMessage(null), 2500);
    return true;
  };

  const changeCartQty = (id: string, delta: number) => {
    const item = cart.find(i => i.cartKey === id);
    if (!item) return;
    const next = item.quantity + delta;
    if (next <= 0) { removeFromCart(id); return; }
    if (typeof item.stock_quantity === 'number' && next > item.stock_quantity) {
      setToastMessage(`Only ${item.stock_quantity} in stock.`);
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }
    setCart(prev => prev.map(i => i.cartKey === id ? { ...i, quantity: next } : i));
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.cartKey !== id));
  };

  const subtotalAmount = cart.reduce((sum, item) => sum + (item.discounted_price || item.price) * item.quantity, 0);
  const deliveryCharge = cart.length ? deliveryChargeFor(settings, shipAddr.province, shipAddr.city, subtotalAmount) : 0;
  const gst = gstFor(settings, subtotalAmount);
  const totalAmount = Math.round((subtotalAmount + deliveryCharge + (gst.inclusive ? 0 : gst.amount)) * 100) / 100;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) { alert('Please enter your full name.'); return; }
    const addrProblem = checkPkAddress(shipAddr);
    if (addrProblem) { alert(addrProblem); return; }

    if (!/^\S+@\S+\.\S+$/.test(customerEmail.trim())) {
      alert('Please enter a valid email address.');
      return;
    }

    if (paymentMethod === 'cod' && !codAllowed) {
      alert(`Cash on Delivery is only for Karachi. For ${shipAddr.city}, please choose Online Payment.`);
      return;
    }
    const payAccount = paymentAccounts.find(a => a.id === payAccountId);
    if (paymentMethod !== 'cod') {
      if (!payAccount) { alert('Please choose the account you paid to.'); return; }
      if (!payerName.trim() || !payerAccount.trim()) { alert('Please enter the name and the mobile / account number you paid from.'); return; }
      if (transactionId.trim().length < 4) { alert('Please enter the Transaction ID (TID) from your payment message.'); return; }
      if (!(Number(payerAmount) > 0)) { alert('Please enter the amount you paid.'); return; }
    }

    setIsSubmitting(true);

    try {
      const fullPhone = `+92${shipAddr.mobile}`;
      const fullAddress = fullPkAddress(shipAddr);

      // The order is saved by place_order() in the database: it saves the customer, takes the prices
      // from the products table (not from the browser), saves the items and reduces the stock.
      const { data: placed, error: orderError } = await supabase.rpc('place_order', {
        p_customer: {
          name: customerName.trim(),
          email: customerEmail.trim() || null,
          phone_iso: 'PK',
          phone_code: '+92',
          phone: shipAddr.mobile,
          country_iso: 'PK',
          country: 'Pakistan',
          province_iso: '',
          province: shipAddr.province,
          city: shipAddr.city,
          area: shipAddr.area.trim(),
          zip: shipAddr.zip.trim(),
          address: shipAddr.address.trim(),
          marketing_opt_in: marketingOptIn
        },
        p_order: {
          customer_name: customerName.trim(),
          customer_phone: fullPhone,
          customer_email: customerEmail.trim() || null,
          shipping_address: fullAddress,
          province: shipAddr.province,
          city: shipAddr.city,
          area: shipAddr.area.trim(),
          zip: shipAddr.zip.trim(),
          payment_method: paymentMethod === 'cod' ? 'cod' : (payAccount ? payAccount.type : 'online'),
          transaction_id: paymentMethod === 'cod' ? null : (transactionId.trim() || null),
          payment_account_id: paymentMethod === 'cod' ? null : payAccountId,
          payment_account_label: paymentMethod === 'cod' || !payAccount ? null : `${payAccount.type} - ${payAccount.account_title} - ${payAccount.account_number}`,
          payer_name: paymentMethod === 'cod' ? null : payerName.trim(),
          payer_account: paymentMethod === 'cod' ? null : payerAccount.trim(),
          payer_amount: paymentMethod === 'cod' ? null : Number(payerAmount),
          payer_paid_at: paymentMethod === 'cod' || !payerPaidAt ? null : new Date(payerPaidAt).toISOString(),
          payment_proof: paymentMethod === 'cod' ? null : (paymentProof || null)
        },
        p_items: cart.map(item => ({ product_id: item.id, quantity: item.quantity, variant: item.variant || null }))
      });

      if (orderError || !placed || !placed.order) {
        reportError('order', orderError || { message: 'Order was not saved.' });
        return;
      }

      const order = placed.order;
      const placedItems: InvoiceItem[] = (placed.items || []).map((i: any) => ({
        product_name: i.product_name, quantity: Number(i.quantity), unit_price: Number(i.unit_price)
      }));

      fetchProducts();

      // Invoice for the customer + order alert to the owner (Edge Function).
      // A failure here does not affect the order.
      setPlacedInvoice({ order: { ...order }, items: placedItems });
      setInvoiceStatus('Preparing your invoice email...');
      const emailUsed = customerEmail.trim();
      supabase.functions.invoke('notify-order', { body: { order_id: order.id, site_url: window.location.origin } })
        .then(({ data: nData, error: nErr }) => {
          if (nErr) {
            console.warn('notify-order:', nErr.message);
            setInvoiceStatus('We could not email the invoice automatically. You can view or download it below.');
            return;
          }
          setInvoiceStatus(
            nData && nData.invoice_email === 'sent'
              ? `Your invoice has been emailed to ${emailUsed}.`
              : 'The invoice email could not be sent right now. You can view or download it below.'
          );
        });

      setPurchased({
        order_id: order.id,
        customer_name: customerName.trim(),
        items: cart.map(i => ({ id: i.id, name: i.name }))
      });
      setRateDrafts({});
      setConfirmedInvoice(order.invoice_no || String(order.id).slice(0, 8).toUpperCase());
      setOrderSuccess(true);
      setTransactionId(''); setPayerName(''); setPayerAccount(''); setPayerAmount(''); setPayerPaidAt(''); setPaymentProof('');
      // Logged-in customer: remember this address in his account for next time
      if (authUser) {
        supabase.auth.updateUser({
          data: {
            name: customerName.trim(), phone: '92' + shipAddr.mobile, province: shipAddr.province, city: shipAddr.city,
            area: shipAddr.area.trim(), address: shipAddr.address.trim(), zip: shipAddr.zip.trim()
          }
        }).then(() => { /* ignore */ });
      }
      setCart([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = selectedCategory === 'All' 
    ? products 
    : products.filter(p => p.category_name === selectedCategory);

  // Default slides only when the database really has none (never while it is still loading).
  const activeSlides = slides.filter(x => x.active !== false);
  const displaySlides: Slide[] = activeSlides.length > 0 ? activeSlides : (fresh ? HERO_SLIDES : []);
  const hi = displaySlides.length ? heroIndex % displaySlides.length : 0;

  const priceOf = (p: Product) => Number(p.discounted_price || p.price || 0);
  const q = searchQuery.trim();
  const scoreMap = new Map<string, number>();
  if (q) products.forEach(p => scoreMap.set(p.id, searchScore(p, q)));
  const visibleProducts = filteredProducts
    .filter(p => !q || (scoreMap.get(p.id) || 0) > 0)
    .slice()
    .sort((a, b) => {
      if (q && sortBy === 'best') return (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0);
      if (sortBy === 'low') return priceOf(a) - priceOf(b);
      if (sortBy === 'high') return priceOf(b) - priceOf(a);
      if (sortBy === 'new') return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      if (sortBy === 'popular') return (b.sold_quantity || 0) - (a.sold_quantity || 0);
      return 0;
    });

  const toggleWishlist = (id: string) =>
    setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const scrollToProducts = () =>
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });

  const discountPct = (p: Product) => {
    const now = p.discounted_price || p.price;
    return p.original_price > now ? Math.round((1 - now / p.original_price) * 100) : 0;
  };

  // ---- Product page: has its own link (?product=<id>) and closes with the phone's Back button ----
  const openProduct = (p: Product, replace = false) => {
    setQuickView(p);
    setQvQty(1);
    const vs = variantsOf(p);
    setQvVariant((vs.find(v => Number(v.stock) > 0) || vs[0] || { name: '' }).name);
    try {
      const url = `${window.location.pathname}?product=${p.id}`;
      if (replace && window.history.state && window.history.state.product) window.history.replaceState({ product: p.id }, '', url);
      else window.history.pushState({ product: p.id }, '', url);
    } catch { /* ignore */ }
  };
  const closeProduct = () => {
    if (window.history.state && window.history.state.product) window.history.back();
    else {
      setQuickView(null);
      try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ }
    }
  };

  const adminLogout = async () => {
    await supabase.rpc('admin_logout');
    setAdminToken(null);
    setIsAdminLoggedIn(false);
    setAdminOrders([]);
    setAdminUsers([]);
    setAdminMenuOpen(false);
    setCurrentView('store');
    fetchReviews();
  };

  const cityOfOrder = (o: Order) => o.city || cityFromText(o.shipping_address || '') || 'Unknown';
  const cityOfCustomer = (c: Customer) => c.city || 'Unknown';
  const countBy = (names: string[]) => {
    const m = new Map<string, number>();
    names.forEach(n => m.set(n, (m.get(n) || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const cityBar = (counts: [string, number][], total: number, value: string, onChange: (v: string) => void) => (
    <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3">
      {[['All', total] as [string, number], ...counts].map(([ct, n]) => (
        <button
          key={ct}
          onClick={() => onChange(ct)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border cursor-pointer ${value === ct ? 'bg-slate-900 text-amber-400 border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
        >
          {ct === 'All' ? 'All cities' : ct} ({n})
        </button>
      ))}
    </div>
  );

  // Admin side menu (grouped like a seller centre)
  const ADMIN_MENU: { title: string; items: { id: string; label: string; icon: any; open?: () => void; badge?: () => number }[] }[] = [
    { title: 'Overview', items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, open: () => fetchOrders() },
      { id: 'ai', label: 'AI Assistant', icon: MessageCircle }
    ] },
    { title: 'Orders', items: [
      { id: 'orders', label: 'Orders', icon: FileText, open: () => { setNewOrderCount(0); fetchOrders(); }, badge: () => newOrderCount },
      { id: 'payments', label: 'Payments', icon: Wallet, open: () => fetchOrders() },
      { id: 'customers', label: 'Customers', icon: Users, open: () => fetchCustomers() },
      { id: 'reviews', label: 'Reviews', icon: Star, open: () => fetchReviews() }
    ] },
    { title: 'Products', items: [
      { id: 'products', label: 'Products', icon: Package },
      { id: 'categories', label: 'Categories', icon: Tag }
    ] },
    { title: 'Store Design', items: [
      { id: 'slides', label: 'Home Banner', icon: ImageIcon, open: () => fetchSlides() },
      { id: 'settings:look', label: 'Theme & Look', icon: Settings }
    ] },
    { title: 'Settings', items: [
      { id: 'settings:profile', label: 'Store Profile', icon: Building },
      { id: 'accounts', label: 'Payment Accounts', icon: CreditCard },
      { id: 'settings:delivery', label: 'Delivery Charges', icon: Truck },
      { id: 'settings:invoice', label: 'Invoice', icon: Printer },
      { id: 'settings:messages', label: 'Customer Messages', icon: Mail },
      { id: 'notifications', label: 'Order Alerts', icon: MessageCircle },
      { id: 'users', label: 'Admin Users', icon: UserPlus }
    ] }
  ];

  // Live suggestions under the search box
  const suggestions = q
    ? products.filter(p => (scoreMap.get(p.id) || 0) > 0).sort((a, b) => (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0)).slice(0, 6)
    : [];
  const categoryHits = q ? categories.filter(c => searchScore({ name: c.name }, q) > 0).slice(0, 4) : [];

  // Header colours for the chosen theme (Settings > Website Look)
  const H = settings.header_style === 'dark'
    ? { bar: 'bg-slate-900 text-white', name: 'text-white', sub: 'text-amber-400', btn: 'bg-amber-600 hover:bg-amber-700', icon: 'text-white', hover: 'hover:bg-white/10', input: 'bg-white', badge: 'bg-amber-500 text-white' }
    : settings.header_style === 'light'
      ? { bar: 'bg-white text-slate-900 border-b', name: 'text-slate-900', sub: 'text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700', icon: 'text-slate-700', hover: 'hover:bg-slate-100', input: 'bg-slate-100', badge: 'bg-amber-600 text-white' }
      : { bar: 'bg-amber-600 text-white', name: 'text-white', sub: 'text-white/80', btn: 'bg-amber-800 hover:bg-amber-900', icon: 'text-white', hover: 'hover:bg-white/10', input: 'bg-white', badge: 'bg-white text-amber-700' };
  const pageBg = settings.page_bg === 'white' ? 'bg-white' : settings.page_bg === 'warm' ? 'bg-stone-100' : 'bg-slate-100';

  const searchBox = (phone: boolean) => (
    <form
      onSubmit={(e) => { e.preventDefault(); setSearchOpen(false); (document.activeElement as HTMLElement)?.blur?.(); scrollToProducts(); }}
      className={phone ? 'sm:hidden flex mt-2 relative' : 'hidden sm:flex flex-1 max-w-2xl relative'}
      role="search"
    >
      <input
        type="search"
        placeholder={`Search in ${settings.store_name}`}
        value={searchQuery}
        onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
        onFocus={() => setSearchOpen(true)}
        onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
        className={`flex-1 min-w-0 ${phone ? 'px-3 py-2' : 'px-4 py-2.5'} rounded-l-lg text-sm text-slate-800 ${H.input} focus:outline-none`}
      />
      <button type="submit" className={`${H.btn} ${phone ? 'px-3' : 'px-4'} rounded-r-lg cursor-pointer`} aria-label="Search">
        <Search className={`${phone ? 'w-4 h-4' : 'w-5 h-5'} text-white`} />
      </button>
      {searchOpen && q && (suggestions.length > 0 || categoryHits.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white text-slate-800 rounded-lg shadow-2xl border z-50 overflow-hidden">
          {categoryHits.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-3 pb-2 border-b">
              {categoryHits.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setSelectedCategory(c.name); setSearchQuery(''); setSearchOpen(false); scrollToProducts(); }}
                  className="text-[11px] font-semibold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full cursor-pointer"
                >
                  in {c.name}
                </button>
              ))}
            </div>
          )}
          {suggestions.map(p => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setSearchOpen(false); openProduct(p); }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left cursor-pointer"
            >
              <img src={p.image_url || PLACEHOLDER_IMG} alt="" className="w-10 h-10 object-cover rounded bg-slate-100 shrink-0" />
              <span className="flex-1 min-w-0 text-sm truncate">{p.name}</span>
              <span className="text-xs font-bold text-amber-600 shrink-0">{money(p.discounted_price || p.price)}</span>
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setSearchOpen(false); scrollToProducts(); }}
            className="w-full text-xs font-semibold text-slate-600 px-3 py-2.5 border-t bg-slate-50 text-left cursor-pointer"
          >
            See all results for "{q}"
          </button>
        </div>
      )}
    </form>
  );

  // Products on discount for the "Flash Sale" row (biggest discount first)
  const saleProducts = products
    .filter(p => discountPct(p) > 0 && p.stock_quantity > 0)
    .sort((a, b) => discountPct(b) - discountPct(a))
    .slice(0, 12);

  // Picture for a category tile: the first product of that category that has a picture
  const categoryImage = (name: string) => (products.find(p => p.category_name === name && p.image_url) || ({} as any)).image_url || '';


  // First visit only: a short loading screen instead of the built-in default look
  if (!booted && currentView === 'store') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${pageBg} font-sans text-slate-800`}>
      <style>{accentCss(settings.accent)}</style>
      {dbError && (
        <div className="bg-red-600 text-white text-xs font-bold px-4 py-2 text-center">
          Database problem: {dbError} — run supabase_setup.sql in Supabase SQL Editor.
          <button onClick={() => setDbError(null)} className="ml-3 underline cursor-pointer">dismiss</button>
        </div>
      )}
      {/* Toast Notification in English Only */}
      {toastMessage && (
        <div className="fixed top-20 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-semibold text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Thin top bar */}
      {currentView === 'store' && settings.show_announcement && settings.announcement && (
        <div className="bg-slate-50 border-b text-[11px] text-slate-600">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 flex items-center justify-between gap-3">
            <span className="truncate">{settings.announcement}</span>
            <div className="flex items-center gap-4 shrink-0 font-semibold">
              <button onClick={() => setCurrentView('track')} className="hover:text-amber-600 cursor-pointer flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" /> Track Order
              </button>
              <span className="hidden md:contents">
              {settings.whatsapp && (
                <a href={waLink(settings.whatsapp, 'Hello, I would like some information about your products.')} target="_blank" rel="noreferrer" className="hover:text-amber-600">
                  WhatsApp Help
                </a>
              )}
              {settings.phone && <span>Call: {settings.phone}</span>}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main header: logo, search, cart */}
      <header className={`${H.bar} sticky top-0 z-40 shadow-md`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex items-center gap-3 md:gap-8">
            <button
              type="button"
              onClick={() => { setCurrentView('store'); setSearchQuery(''); setSelectedCategory('All'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex items-center gap-2 cursor-pointer min-w-0 shrink text-left"
            >
              {settings.logo_url ? (
                <img src={settings.logo_url} alt={settings.store_name} className="h-9 w-9 sm:h-11 sm:w-11 object-contain rounded bg-white p-0.5 shrink-0" />
              ) : (
                <Package className={`w-8 h-8 ${H.icon} shrink-0`} />
              )}
              <span className="min-w-0">
                <span className={`text-base sm:text-xl md:text-2xl font-black tracking-wide ${H.name} block whitespace-nowrap truncate leading-tight`}>{settings.store_name}</span>
                {settings.header_subtitle && (
                  <span className={`text-[9px] sm:text-[11px] ${H.sub} font-medium tracking-wide block truncate leading-tight`}>{settings.header_subtitle}</span>
                )}
              </span>
            </button>

            {currentView === 'store' && searchBox(false)}

            <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
              {/* Admin: a lock icon only */}
              <button
                onClick={() => setCurrentView(isAdminLoggedIn ? (currentView === 'admin' ? 'store' : 'admin') : 'login')}
                className={`p-2 rounded-lg ${H.hover} transition cursor-pointer relative`}
                aria-label={isAdminLoggedIn ? (currentView === 'admin' ? 'Back to store' : 'Admin panel') : 'Admin login'}
                title={isAdminLoggedIn ? (currentView === 'admin' ? 'Back to store' : 'Admin panel') : 'Admin login'}
              >
                {isAdminLoggedIn && currentView === 'admin'
                  ? <ShoppingCart className={`w-5 h-5 sm:w-6 sm:h-6 ${H.icon}`} />
                  : <Lock className={`w-5 h-5 sm:w-6 sm:h-6 ${H.icon}`} />}
                {isAdminLoggedIn && currentView !== 'admin' && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400" />}
              </button>

              {currentView !== 'admin' && (
                <button
                  onClick={() => { if (authUser) setCurrentView('account'); else { setAuthMode('login'); setCurrentView('auth'); } }}
                  className={`flex items-center gap-1.5 p-2 rounded-lg ${H.hover} transition cursor-pointer`}
                  aria-label={authUser ? 'My account' : 'Login or sign up'}
                >
                  <User className={`w-5 h-5 sm:w-6 sm:h-6 ${H.icon}`} />
                  <span className={`hidden md:inline text-xs font-semibold ${H.name} max-w-[7rem] truncate`}>
                    {authUser ? `Hi, ${String((authUser.user_metadata && authUser.user_metadata.name) || 'Account').split(' ')[0]}` : 'Login / Sign up'}
                  </span>
                </button>
              )}

              {currentView === 'store' && (
                <button
                  onClick={() => setIsCartOpen(true)}
                  className={`relative p-2 rounded-lg ${H.hover} transition cursor-pointer`}
                  aria-label="Open cart"
                >
                  <ShoppingCart className={`w-6 h-6 sm:w-7 sm:h-7 ${H.icon}`} />
                  {cart.length > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 ${H.badge} text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow`}>
                      {cart.reduce((a, b) => a + b.quantity, 0)}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {currentView === 'store' && searchBox(true)}
        </div>
      </header>

      {/* VIEW 1: CUSTOMER STORE VIEW */}
      {currentView === 'store' && (
        <div className={pageBg}>
          {/* Category list + banner */}
          <section className="max-w-7xl mx-auto sm:px-4 sm:pt-4">
            <div className="flex gap-4">
              {categories.length > 0 && (
                <aside className="hidden lg:block w-56 shrink-0 bg-white rounded-lg shadow-sm py-2 h-[340px] overflow-y-auto">
                  <button
                    onClick={() => { setSelectedCategory('All'); scrollToProducts(); }}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 cursor-pointer"
                  >
                    All Products <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => { setSelectedCategory(cat.name); scrollToProducts(); }}
                      className="w-full flex items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 text-left cursor-pointer"
                    >
                      <span className="truncate">{cat.name}</span> <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </button>
                  ))}
                </aside>
              )}

              <div className="flex-1 min-w-0 relative overflow-hidden sm:rounded-lg shadow-sm bg-slate-800 aspect-[2/1] sm:aspect-[5/2] lg:aspect-auto lg:h-[340px]">
                <div className="flex h-full transition-transform duration-700" style={{ transform: `translateX(-${hi * 100}%)` }}>
                  {displaySlides.map((sl, i) => {
                    const hasText = !!((sl.title || '').trim() || (sl.text || '').trim());
                    return (
                      <div
                        key={sl.id || i}
                        className={`min-w-full h-full bg-gradient-to-r ${BG_PRESETS[sl.bg] || BG_PRESETS.gold} flex items-center justify-center text-center px-6 relative`}
                        style={sl.image_url ? { backgroundImage: `url("${sl.image_url}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                      >
                        {sl.image_url && hasText && <div className="absolute inset-0 bg-black/40" />}
                        {hasText && (
                          <div className="max-w-2xl relative">
                            {sl.title && <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white mb-2 sm:mb-3">{sl.title}</h2>}
                            {sl.text && <p className="text-slate-100 text-xs sm:text-base md:text-lg mb-3 sm:mb-5">{sl.text}</p>}
                            {sl.cta && (
                              <button
                                onClick={scrollToProducts}
                                className="bg-amber-500 hover:bg-amber-600 text-white font-black text-xs sm:text-sm px-6 sm:px-8 py-2 sm:py-3 rounded-full transition cursor-pointer"
                              >
                                {sl.cta}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {displaySlides.length > 1 && (
                  <>
                    <button
                      onClick={() => setHeroIndex(i => (i % displaySlides.length - 1 + displaySlides.length) % displaySlides.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/25 hover:bg-black/45 text-white p-1.5 sm:p-2 rounded-full cursor-pointer"
                      aria-label="Previous slide"
                    >
                      <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={() => setHeroIndex(i => i + 1)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/25 hover:bg-black/45 text-white p-1.5 sm:p-2 rounded-full cursor-pointer"
                      aria-label="Next slide"
                    >
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <div className="absolute bottom-2 sm:bottom-3 left-0 right-0 flex justify-center gap-1.5">
                      {displaySlides.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setHeroIndex(i)}
                          className={`h-1.5 sm:h-2 rounded-full transition-all cursor-pointer ${i === hi ? 'w-5 sm:w-6 bg-white' : 'w-1.5 sm:w-2 bg-white/50'}`}
                          aria-label={`Slide ${i + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Category circles (phones and tablets) */}
          {categories.length > 0 && (
            <section className="lg:hidden bg-white sm:mx-4 sm:mt-3 sm:rounded-lg shadow-sm">
              <div className="flex gap-4 overflow-x-auto px-3 py-3">
                {categories.map((cat) => {
                  const img = categoryImage(cat.name);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { setSelectedCategory(cat.name); scrollToProducts(); }}
                      className="flex flex-col items-center gap-1 w-16 shrink-0 cursor-pointer"
                    >
                      <span className="w-14 h-14 rounded-full bg-amber-50 border border-amber-100 overflow-hidden flex items-center justify-center">
                        {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-amber-600" />}
                      </span>
                      <span className="text-[10px] text-slate-700 text-center leading-tight line-clamp-2">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Scrolling strip (Settings > Website Look) */}
          {settings.show_marquee && settings.marquee_items.length > 0 && (
            <div className="max-w-7xl mx-auto sm:px-4 mt-2 sm:mt-3">
              <div className="bg-amber-600 text-white overflow-hidden whitespace-nowrap py-2 sm:rounded-lg">
                <div className="marquee-track inline-flex text-xs md:text-sm font-bold" style={{ animationDuration: `${settings.marquee_speed}s` }}>
                  {[0, 1, 2, 3].map((k) => (
                    <span key={k} className="inline-flex">
                      {settings.marquee_items.map((m, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 mx-5 md:mx-8">
                          <ShopIcon name={m.icon} className="w-4 h-4" />
                          {m.text}
                        </span>
                      ))}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Flash sale: discounted products */}
          {saleProducts.length > 0 && !searchQuery.trim() && (
            <section className="max-w-7xl mx-auto sm:px-4 mt-4 sm:mt-6">
              <h2 className="px-3 sm:px-0 text-lg sm:text-xl text-slate-800 mb-2">Flash Sale</h2>
              <div className="bg-white sm:rounded-lg shadow-sm">
                <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-3 border-b">
                  <span className="text-amber-600 font-bold text-sm flex items-center gap-1.5">
                    <Flame className="w-4 h-4" /> On Sale Now
                  </span>
                  <button
                    onClick={() => { setSelectedCategory('All'); scrollToProducts(); }}
                    className="border border-amber-600 text-amber-600 hover:bg-amber-50 text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded cursor-pointer whitespace-nowrap"
                  >
                    SHOP ALL PRODUCTS
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto p-3 sm:p-4">
                  {saleProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => openProduct(p)}
                      className="w-32 sm:w-40 shrink-0 text-left group cursor-pointer"
                    >
                      <div className="aspect-square bg-slate-50 rounded overflow-hidden mb-2">
                        <img src={p.image_url || PLACEHOLDER_IMG} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                      <p className="text-xs text-slate-700 line-clamp-2 min-h-[2rem]">{p.name}</p>
                      <p className="text-amber-600 font-bold text-sm sm:text-base mt-1">{money(p.discounted_price || p.price)}</p>
                      <p className="text-[11px]">
                        <span className="text-slate-400 line-through mr-1">{money(p.original_price)}</span>
                        <span className="text-slate-700">-{discountPct(p)}%</span>
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Category tiles */}
          {settings.show_categories && categories.length > 0 && !searchQuery.trim() && (
            <section className="hidden lg:block max-w-7xl mx-auto px-4 mt-6">
              <h2 className="text-xl text-slate-800 mb-2">Categories</h2>
              <div className="bg-white sm:rounded-lg shadow-sm grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 overflow-hidden">
                {categories.map((cat) => {
                  const img = categoryImage(cat.name);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { setSelectedCategory(cat.name); scrollToProducts(); }}
                      className="flex flex-col items-center gap-2 p-3 sm:p-4 border-r border-b border-slate-100 hover:shadow-lg hover:z-10 bg-white transition cursor-pointer"
                    >
                      <span className="w-16 h-16 sm:w-20 sm:h-20 rounded overflow-hidden bg-slate-50 flex items-center justify-center">
                        {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <Package className="w-8 h-8 text-amber-600" />}
                      </span>
                      <span className="text-[11px] sm:text-xs text-slate-700 text-center leading-tight line-clamp-2">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* All products ("Just For You") */}
          <main id="products" className="max-w-7xl mx-auto sm:px-4 mt-4 sm:mt-6 pb-10 scroll-mt-36">
            <h2 className="px-3 sm:px-0 text-lg sm:text-xl text-slate-800 mb-2">
              {searchQuery.trim()
                ? `Results for "${searchQuery.trim()}"`
                : selectedCategory === 'All' ? 'Just For You' : selectedCategory}
            </h2>

            <div className="flex items-center justify-between gap-3 px-3 sm:px-0 mb-2">
              <span className="text-xs text-slate-500">{visibleProducts.length} items</span>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                Sort by
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="border rounded px-2 py-1.5 bg-white text-xs">
                  <option value="best">Best Match</option>
                  <option value="popular">Best Selling</option>
                  <option value="new">Newest</option>
                  <option value="low">Price: Low to High</option>
                  <option value="high">Price: High to Low</option>
                </select>
              </label>
            </div>
            <div className="flex gap-2 overflow-x-auto px-3 sm:px-0 pb-3">
              {['All', ...categories.map(c => c.name)].map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedCategory(name)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition cursor-pointer ${selectedCategory === name ? 'bg-amber-600 border-amber-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-400'}`}
                >
                  {name === 'All' ? 'All Products' : name}
                </button>
              ))}
            </div>

            {visibleProducts.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-medium bg-white sm:rounded-lg">
                {fresh ? 'No products found.' : 'Loading products...'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 px-2 sm:px-0">
                {visibleProducts.map((product) => {
                  const soldOut = product.stock_quantity <= 0;
                  const pct = discountPct(product);
                  const r = ratingOf(product.id);
                  return (
                    <div key={product.id} className="bg-white rounded-md overflow-hidden hover:shadow-lg transition-shadow flex flex-col group">
                      <div className="aspect-square bg-slate-50 relative overflow-hidden">
                        <button onClick={() => openProduct(product)} className="block w-full h-full cursor-pointer" aria-label={`View ${product.name}`}>
                          <img
                            src={product.image_url || PLACEHOLDER_IMG}
                            alt={product.name}
                            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${soldOut ? 'opacity-50' : ''}`}
                            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                          />
                        </button>
                        {soldOut && (
                          <span className="absolute top-2 left-2 bg-slate-900/85 text-white text-[10px] font-bold px-2 py-0.5 rounded">Sold Out</span>
                        )}
                        <button
                          onClick={() => toggleWishlist(product.id)}
                          className="absolute top-2 right-2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow cursor-pointer"
                          aria-label="Add to wishlist"
                        >
                          <Heart className={`w-3.5 h-3.5 ${wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : 'text-slate-500'}`} />
                        </button>
                      </div>

                      <div className="p-2 sm:p-2.5 flex-1 flex flex-col">
                        <button onClick={() => openProduct(product)} className="text-left cursor-pointer">
                          <h3 className="text-xs sm:text-[13px] text-slate-800 line-clamp-2 min-h-[2rem] sm:min-h-[2.25rem] leading-snug">{product.name}</h3>
                        </button>
                        <p className="text-amber-600 font-bold text-base sm:text-lg mt-1 leading-tight">
                          {variantsOf(product).length > 0 && <span className="text-[10px] font-normal text-slate-500 mr-1">from</span>}
                          {money(product.discounted_price || product.price)}
                        </p>
                        <p className="text-[11px] min-h-[1rem]">
                          {pct > 0 && (
                            <>
                              <span className="text-slate-400 line-through mr-1">{money(product.original_price)}</span>
                              <span className="text-slate-700">-{pct}%</span>
                            </>
                          )}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500">
                          {r.count > 0 ? (
                            <>{renderStars(r.avg, 'w-3 h-3')}<span>({r.count})</span></>
                          ) : (
                            <span>{product.sold_quantity ? `${product.sold_quantity} sold` : 'New'}</span>
                          )}
                          {r.count > 0 && !!product.sold_quantity && <span className="ml-auto">{product.sold_quantity} sold</span>}
                        </div>
                        {!soldOut && product.stock_quantity <= 5 && (
                          <p className="text-[10px] text-red-600 font-semibold mt-0.5">Only {product.stock_quantity} left</p>
                        )}
                        <button
                          onClick={() => addToCart(product)}
                          disabled={soldOut}
                          className="mt-auto pt-0 w-full border border-amber-600 text-amber-600 hover:bg-amber-600 hover:text-white disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed font-semibold text-[11px] sm:text-xs py-1.5 rounded transition flex items-center justify-center cursor-pointer mt-2"
                        >
                          <ShoppingCart className="w-3.5 h-3.5 mr-1" /> {soldOut ? 'Sold Out' : variantsOf(product).length > 0 ? `Choose ${product.variant_label || 'Size'}` : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>

          {/* Trust badges */}
          {settings.show_trust && (
            <section className="max-w-7xl mx-auto sm:px-4 pb-8">
              <div className="bg-white sm:rounded-lg shadow-sm px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-5 text-center">
                {[
                  { icon: <BadgeCheck className="w-7 h-7 text-amber-600" />, t: '100% Original', d: 'Authentic salon-grade products.' },
                  { icon: <Truck className="w-7 h-7 text-amber-600" />, t: 'Fast Delivery', d: 'Delivered across Pakistan.' },
                  { icon: <ShieldCheck className="w-7 h-7 text-amber-600" />, t: 'Cash on Delivery', d: 'Pay when you receive your order.' },
                  { icon: <MessageCircle className="w-7 h-7 text-amber-600" />, t: 'WhatsApp Support', d: 'Ask us anything, anytime.' }
                ].map((b, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="bg-amber-50 p-3 rounded-full mb-2">{b.icon}</div>
                    <h4 className="font-bold text-sm text-slate-900">{b.t}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{b.d}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* WhatsApp contact strip */}
          {settings.show_whatsapp_strip && (
          <section className="bg-slate-900 text-white">
            <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
              <div>
                <h3 className="text-lg font-black text-amber-400">Need help choosing a product?</h3>
                <p className="text-sm text-slate-300">Message us on WhatsApp and we will help you.</p>
              </div>
              <a
                href={waLink(settings.whatsapp, 'Hello, I would like some information about your products.')}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm px-6 py-3 rounded-full flex items-center"
              >
                <MessageCircle className="w-4 h-4 mr-2" /> Chat on WhatsApp
              </a>
            </div>
          </section>
          )}

          {/* Footer */}
          <footer className="bg-slate-950 text-slate-400">
            <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  {settings.logo_url && <img src={settings.logo_url} alt="" className="h-8 w-8 object-contain rounded" />}
                  <h4 className="text-white font-black">{settings.store_name}</h4>
                </div>
                <p className="text-xs mb-2">{settings.tagline}</p>
                <div className="text-xs space-y-0.5">
                  {settings.address && <p className="whitespace-pre-line">{settings.address}</p>}
                  {settings.phone && <p>Phone: {settings.phone}</p>}
                  {settings.email && <p>Email: {settings.email}</p>}
                </div>
                {(settings.facebook || settings.instagram || settings.tiktok) && (
                  <div className="flex gap-3 mt-3 text-xs font-bold">
                    {settings.facebook && <a href={settings.facebook} target="_blank" rel="noreferrer" className="hover:text-amber-400">Facebook</a>}
                    {settings.instagram && <a href={settings.instagram} target="_blank" rel="noreferrer" className="hover:text-amber-400">Instagram</a>}
                    {settings.tiktok && <a href={settings.tiktok} target="_blank" rel="noreferrer" className="hover:text-amber-400">TikTok</a>}
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-white font-black mb-2">Quick Links</h4>
                <ul className="space-y-1 text-xs">
                  <li><button onClick={() => { setCurrentView('track'); window.scrollTo({ top: 0 }); }} className="hover:text-amber-400 cursor-pointer">Track your order</button></li>
                  <li><button onClick={() => { setSelectedCategory('All'); scrollToProducts(); }} className="hover:text-amber-400 cursor-pointer">Best Sellers</button></li>
                  {categories.map(c => (
                    <li key={c.id}><button onClick={() => { setSelectedCategory(c.name); scrollToProducts(); }} className="hover:text-amber-400 cursor-pointer">{c.name}</button></li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-white font-black mb-2">Payment Options</h4>
                <div className="flex flex-wrap gap-2">
                  {['Cash on Delivery', ...Array.from(new Set(paymentAccounts.map(a => a.type)))].map(t => (
                    <span key={t} className="bg-slate-800 text-slate-300 text-[11px] font-bold px-2.5 py-1 rounded">{t}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-slate-800 text-center text-[11px] py-4">
              {settings.footer_text && <p className="mb-1 whitespace-pre-line">{settings.footer_text}</p>}
              &copy; {new Date().getFullYear()} {settings.store_name}. All rights reserved. <span className="opacity-40">{BUILD}</span>
            </div>
          </footer>

          {/* Product page (opens over the shop; the phone's Back button closes it) */}
          {quickView && (() => {
            const vs = variantsOf(quickView);
            const chosenV = vs.find(v => v.name === qvVariant) || vs[0];
            // the chosen size decides price and stock
            const p: Product = chosenV
              ? { ...quickView, discounted_price: Number(chosenV.price), price: Number(chosenV.price), original_price: Number(chosenV.original_price || chosenV.price), stock_quantity: Number(chosenV.stock || 0) }
              : quickView;
            const pct = discountPct(p);
            const r = ratingOf(p.id);
            const soldOut = p.stock_quantity <= 0;
            const related = products.filter(x => x.id !== p.id && x.category_name === p.category_name).slice(0, 10);
            const productReviews = reviews.filter(rv => rv.product_id === p.id);
            const buyNow = () => { if (addToCart(quickView, qvQty, chosenV, true)) { closeProduct(); setIsCartOpen(true); } };
            const addOnly = () => { addToCart(quickView, qvQty, chosenV); };
            return (
              <div key={p.id} className="fixed inset-0 z-50 bg-black/60 md:flex md:items-start md:justify-center md:p-6 overflow-y-auto" onClick={closeProduct}>
                <div className="bg-slate-100 md:bg-white w-full min-h-full md:min-h-0 md:max-w-5xl md:rounded-lg relative pb-20 md:pb-0" onClick={(e) => e.stopPropagation()}>
                  {/* top bar */}
                  <div className="sticky top-0 z-10 bg-white border-b flex items-center gap-2 px-2 py-2 md:rounded-t-lg">
                    <button onClick={closeProduct} className="p-2 rounded-full hover:bg-slate-100 cursor-pointer" aria-label="Back">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-semibold text-slate-700 truncate flex-1">{p.category_name || 'Product details'}</span>
                    <button
                      onClick={() => setShareItem({ title: `${p.name} - ${money(p.discounted_price || p.price)}`, url: `${window.location.origin}/?product=${p.id}` })}
                      className="text-xs font-semibold text-slate-600 px-2 py-1.5 rounded hover:bg-slate-100 cursor-pointer"
                    >
                      Share
                    </button>
                    <button onClick={() => { closeProduct(); setIsCartOpen(true); }} className="relative p-2 rounded-full hover:bg-slate-100 cursor-pointer" aria-label="Open cart">
                      <ShoppingCart className="w-5 h-5" />
                      {cart.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-amber-600 text-white text-[9px] font-black min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                          {cart.reduce((a, b) => a + b.quantity, 0)}
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="md:grid md:grid-cols-2 md:gap-6 md:p-6">
                    <div className="bg-white aspect-square md:rounded-lg overflow-hidden relative">
                      <img src={p.image_url || PLACEHOLDER_IMG} alt={p.name} className={`w-full h-full object-contain ${soldOut ? 'opacity-60' : ''}`} />
                      {soldOut && <span className="absolute top-3 left-3 bg-slate-900/85 text-white text-xs font-bold px-2.5 py-1 rounded">Sold Out</span>}
                    </div>

                    <div className="space-y-2 md:space-y-4">
                      <div className="bg-white px-3 py-3 md:p-0">
                        <p className="text-amber-600 font-bold text-2xl md:text-3xl">{money(p.discounted_price || p.price)}</p>
                        {pct > 0 && (
                          <p className="text-sm mt-0.5">
                            <span className="text-slate-400 line-through mr-2">{money(p.original_price)}</span>
                            <span className="text-slate-700">-{pct}%</span>
                          </p>
                        )}
                        <h1 className="text-base md:text-xl text-slate-900 mt-2 leading-snug">{p.name}</h1>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                          {renderStars(r.avg, 'w-3.5 h-3.5')}
                          <span>{r.count > 0 ? `${r.avg.toFixed(1)} (${r.count} ratings)` : 'No ratings yet'}</span>
                          <span className="text-slate-300">|</span>
                          <span>{p.sold_quantity ?? 0} sold</span>
                          <button onClick={() => toggleWishlist(p.id)} className="ml-auto p-1 cursor-pointer" aria-label="Add to wishlist">
                            <Heart className={`w-5 h-5 ${wishlist.includes(p.id) ? 'fill-red-500 text-red-500' : 'text-slate-400'}`} />
                          </button>
                        </div>
                      </div>

                      <div className="bg-white px-3 py-3 md:p-4 md:border md:rounded-lg text-xs text-slate-600 space-y-2">
                        <p className="flex items-center gap-2"><Truck className="w-4 h-4 text-amber-600 shrink-0" /> Delivery across Pakistan</p>
                        <p className="flex items-center gap-2"><Wallet className="w-4 h-4 text-amber-600 shrink-0" /> Cash on Delivery available</p>
                        <p className="flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-amber-600 shrink-0" /> 100% original product</p>
                        <p className={`font-semibold ${soldOut ? 'text-red-600' : p.stock_quantity <= 5 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {soldOut ? 'Out of stock' : p.stock_quantity <= 5 ? `Only ${p.stock_quantity} left - order soon` : 'In stock'}
                        </p>
                      </div>

                      {vs.length > 0 && (() => {
                        const label = (quickView.variant_label || 'Size').trim();
                        const anyColor = vs.some(v => v.color);
                        return (
                          <div className="bg-white px-3 py-3 md:p-0">
                            <p className="text-sm text-slate-600 mb-2 flex items-center gap-2">
                              {label}: <b className="text-slate-900">{chosenV ? chosenV.name : ''}</b>
                              {chosenV && chosenV.color && <span className="w-4 h-4 rounded-full border" style={{ background: chosenV.color }} />}
                            </p>
                            {vs.length > 8 ? (
                              // many options (e.g. hair colour shades): a dropdown
                              <div className="flex items-center gap-2">
                                {anyColor && <span className="w-9 h-9 rounded-full border shrink-0" style={{ background: (chosenV && chosenV.color) || '#fff' }} />}
                                <select
                                  value={chosenV ? chosenV.name : ''}
                                  onChange={(e) => { setQvVariant(e.target.value); setQvQty(1); }}
                                  className="flex-1 min-w-0 px-4 py-3 border-2 border-slate-800 rounded-lg text-sm bg-white cursor-pointer"
                                >
                                  {vs.map(v => (
                                    <option key={v.name} value={v.name}>
                                      {v.name}{Number(v.stock) <= 0 ? ' (sold out)' : ''}{vs.some(x => Number(x.price) !== Number(vs[0].price)) ? ` - Rs. ${Number(v.price).toLocaleString('en-PK')}` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {vs.map(v => {
                                  const out = Number(v.stock) <= 0;
                                  const on = chosenV && v.name === chosenV.name;
                                  return (
                                    <button
                                      key={v.name}
                                      type="button"
                                      onClick={() => { setQvVariant(v.name); setQvQty(1); }}
                                      className={`px-3 py-1.5 rounded border text-sm flex items-center gap-1.5 cursor-pointer ${on ? 'border-amber-600 text-amber-700 bg-amber-50 font-semibold' : 'border-slate-300 text-slate-700 hover:border-amber-400'} ${out ? 'opacity-50 line-through' : ''}`}
                                    >
                                      {v.color && <span className="w-4 h-4 rounded-full border" style={{ background: v.color }} />}
                                      {v.name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {!soldOut && (
                        <div className="bg-white px-3 py-3 md:p-0 flex items-center gap-3">
                          <span className="text-xs text-slate-500">Quantity</span>
                          <div className="flex items-center border rounded-lg overflow-hidden">
                            <button type="button" onClick={() => setQvQty(q => Math.max(1, q - 1))} className="px-3 py-2 hover:bg-slate-100 cursor-pointer" aria-label="Decrease quantity">
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="px-4 text-sm font-bold">{qvQty}</span>
                            <button type="button" onClick={() => setQvQty(q => Math.min(p.stock_quantity, q + 1))} className="px-3 py-2 hover:bg-slate-100 cursor-pointer" aria-label="Increase quantity">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Buttons (computer); phones get the bar at the bottom */}
                      <div className="hidden md:grid grid-cols-2 gap-3">
                        <button onClick={buyNow} disabled={soldOut} className="bg-amber-800 hover:bg-amber-900 disabled:bg-slate-300 text-white font-bold py-3 rounded-lg cursor-pointer disabled:cursor-not-allowed">Buy Now</button>
                        <button onClick={addOnly} disabled={soldOut} className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-lg cursor-pointer disabled:cursor-not-allowed">Add to Cart</button>
                      </div>
                    </div>
                  </div>

                  {p.description && (
                    <div className="bg-white mt-2 md:mt-0 px-3 py-4 md:px-6 md:border-t">
                      <h3 className="text-sm font-bold text-slate-900 mb-2">Product details</h3>
                      <p className="text-sm text-slate-600 whitespace-pre-line">{p.description}</p>
                    </div>
                  )}

                  {/* Reviews */}
                  <div className="bg-white mt-2 md:mt-0 px-3 py-4 md:px-6 md:border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-bold text-slate-900">Ratings & Reviews</h3>
                      {renderStars(r.avg)}
                      <span className="text-xs text-slate-500">({r.count})</span>
                    </div>
                    <div className="space-y-2">
                      {productReviews.length === 0 && <p className="text-xs text-slate-400">No reviews yet. Be the first to review this product!</p>}
                      {productReviews.slice(0, 20).map(rv => (
                        <div key={rv.id} className="border-b last:border-b-0 pb-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{rv.customer_name}</span>
                            {renderStars(rv.rating, 'w-3 h-3')}
                          </div>
                          {rv.remark && <p className="text-slate-600 mt-1">{rv.remark}</p>}
                          <p className="text-[10px] text-slate-400 mt-0.5">{fmtDateTime(rv.created_at)}</p>
                        </div>
                      ))}
                    </div>

                    <details className="mt-3 bg-slate-50 border rounded-lg">
                      <summary className="px-3 py-2 text-xs font-bold text-slate-800 cursor-pointer">Write a review</summary>
                      <div className="p-3 pt-0 space-y-2">
                        <input type="text" placeholder="Your name *" value={rvName} onChange={(e) => setRvName(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs bg-white" />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="email" placeholder="Email (optional)" value={rvEmail} onChange={(e) => setRvEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs bg-white" />
                          <input type="tel" placeholder="Mobile (optional)" value={rvPhone} onChange={(e) => setRvPhone(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs bg-white" />
                        </div>
                        {starPicker(rvRating, setRvRating)}
                        <textarea rows={2} placeholder="Remarks (optional)" value={rvRemark} onChange={(e) => setRvRemark(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs bg-white" />
                        <button onClick={() => handleSubmitReview(p)} className="w-full bg-amber-600 text-white font-bold text-xs py-2 rounded-lg cursor-pointer">Submit Review</button>
                      </div>
                    </details>
                  </div>

                  {/* Related products */}
                  {related.length > 0 && (
                    <div className="bg-white mt-2 md:mt-0 px-3 py-4 md:px-6 md:border-t md:rounded-b-lg">
                      <h3 className="text-sm font-bold text-slate-900 mb-3">You may also like</h3>
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {related.map(x => (
                          <button key={x.id} onClick={() => openProduct(x, true)} className="w-28 sm:w-36 shrink-0 text-left cursor-pointer">
                            <div className="aspect-square bg-slate-50 rounded overflow-hidden mb-1.5">
                              <img src={x.image_url || PLACEHOLDER_IMG} alt={x.name} className="w-full h-full object-cover" />
                            </div>
                            <p className="text-[11px] text-slate-700 line-clamp-2 min-h-[1.75rem]">{x.name}</p>
                            <p className="text-amber-600 font-bold text-sm">{money(x.discounted_price || x.price)}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Phone: fixed bottom bar */}
                  <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t grid grid-cols-[auto_1fr_1fr] gap-2 p-2">
                    <a
                      href={waLink(settings.whatsapp, `Hello, I want to ask about: ${p.name}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 flex flex-col items-center justify-center text-[10px] text-slate-600"
                    >
                      <MessageCircle className="w-5 h-5 text-emerald-600" /> Chat
                    </a>
                    <button onClick={buyNow} disabled={soldOut} className="bg-amber-800 disabled:bg-slate-300 text-white font-bold text-sm py-3 rounded-lg cursor-pointer">Buy Now</button>
                    <button onClick={addOnly} disabled={soldOut} className="bg-amber-600 disabled:bg-slate-300 text-white font-bold text-sm py-3 rounded-lg cursor-pointer">{soldOut ? 'Sold Out' : 'Add to Cart'}</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* AI chat button for shoppers (Settings > Customer Messages) */}
      {settings.ai_chat_enabled && currentView === 'store' && !isCartOpen && (
        <AiChatBubble storeName={settings.store_name} raised={!!quickView} />
      )}

      {/* Share window */}
      {shareItem && (() => {
        const u = encodeURIComponent(shareItem.url);
        const t = encodeURIComponent(`${shareItem.title} | ${settings.store_name}`);
        const options: { name: string; color: string; letter: string; href: string }[] = [
          { name: 'WhatsApp', color: '#25D366', letter: 'W', href: `https://wa.me/?text=${t}%20${u}` },
          { name: 'Facebook', color: '#1877F2', letter: 'f', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
          { name: 'Messenger', color: '#0084FF', letter: 'M', href: `fb-messenger://share/?link=${u}` },
          { name: 'X (Twitter)', color: '#0f172a', letter: 'X', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
          { name: 'Telegram', color: '#229ED9', letter: 'T', href: `https://t.me/share/url?url=${u}&text=${t}` },
          { name: 'Pinterest', color: '#E60023', letter: 'P', href: `https://pinterest.com/pin/create/button/?url=${u}&description=${t}` },
          { name: 'LinkedIn', color: '#0A66C2', letter: 'in', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
          { name: 'Email', color: '#64748b', letter: '@', href: `mailto:?subject=${t}&body=${t}%0A${u}` }
        ];
        return (
          <div className="fixed inset-0 z-[90] bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setShareItem(null)}>
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900">Share</h3>
                <button onClick={() => setShareItem(null)} className="p-1 rounded-full hover:bg-slate-100 cursor-pointer" aria-label="Close"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {options.map(op => (
                  <a key={op.name} href={op.href} target="_blank" rel="noreferrer" onClick={() => setShareItem(null)} className="flex flex-col items-center gap-1.5 text-[11px] text-slate-700">
                    <span className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg" style={{ background: op.color }}>{op.letter}</span>
                    {op.name}
                  </a>
                ))}
              </div>
              <div className="flex mt-5">
                <input readOnly value={shareItem.url} className="flex-1 min-w-0 px-3 py-2 border rounded-l-lg text-xs bg-slate-50" onFocus={(e) => e.target.select()} />
                <button
                  onClick={() => { navigator.clipboard?.writeText(shareItem.url); setToastMessage('Link copied!'); setTimeout(() => setToastMessage(null), 2000); }}
                  className="bg-amber-600 text-white text-xs font-bold px-4 rounded-r-lg cursor-pointer"
                >
                  Copy
                </button>
              </div>
              {typeof navigator !== 'undefined' && (navigator as any).share && (
                <button
                  onClick={() => { (navigator as any).share({ title: shareItem.title, url: shareItem.url }).catch(() => {}); setShareItem(null); }}
                  className="w-full mt-3 border border-slate-300 text-slate-700 text-sm font-semibold py-2.5 rounded-lg cursor-pointer"
                >
                  More apps...
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {proofView && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" onClick={() => setProofView(null)}>
          <img src={proofView} alt="Payment screenshot" className="max-h-[90vh] max-w-full rounded-lg shadow-2xl bg-white" />
        </div>
      )}

      {/* INVOICE MODAL */}
      {invoiceView && (
        <div className="fixed inset-0 z-[70] bg-black/60 overflow-y-auto p-4" onClick={() => setInvoiceView(null)}>
          <div className="max-w-3xl mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap justify-end gap-2 mb-2 no-print">
              <button onClick={() => invoiceView && printInvoice(invoiceView.order)} className="bg-slate-900 text-amber-400 font-bold text-xs px-4 py-2 rounded-xl flex items-center cursor-pointer">
                <Printer className="w-4 h-4 mr-1.5" /> Print / Save as PDF
              </button>
              {isAdminLoggedIn && currentView === 'admin' && (
                <>
                  <a
                    href={waLink(invoiceView.order.customer_phone, `Hello ${invoiceView.order.customer_name}, here is your invoice ${invoiceView.order.invoice_no || ''} from ${settings.store_name}: ${window.location.origin}/?invoice=${invoiceView.order.id}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center"
                  >
                    <MessageCircle className="w-4 h-4 mr-1.5" /> Send on WhatsApp
                  </a>
                  <button onClick={() => handleEmailInvoice(invoiceView.order)} className="bg-blue-600 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center cursor-pointer">
                    <Mail className="w-4 h-4 mr-1.5" /> Email Invoice
                  </button>
                </>
              )}
              <button onClick={() => setInvoiceView(null)} className="bg-white text-slate-700 font-bold text-xs px-4 py-2 rounded-xl cursor-pointer">Close</button>
            </div>
            <div id="invoice-print" className="shadow-xl">
              <InvoiceDocument order={invoiceView.order} items={invoiceView.items} settings={settings} accounts={paymentAccounts} />
            </div>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {payModal && (() => {
        const info = payInfo(payModal);
        return (
          <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setPayModal(null)}>
            <form onSubmit={handleSavePaymentEntry} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-3 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-900">Record Payment</h3>
                <button type="button" onClick={() => setPayModal(null)} className="cursor-pointer" aria-label="Close"><X className="w-5 h-5" /></button>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1">
                <div><span className="text-slate-500">Invoice:</span> <b>{payModal.invoice_no || '-'}</b> | <b>{payModal.customer_name}</b></div>
                <div>Total: <b>PKR {info.total}</b> | Received: <b className="text-emerald-700">PKR {info.paid}</b> | Balance: <b className="text-red-600">PKR {info.balance}</b></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount received (PKR) *</label>
                <input type="number" min="1" step="any" required value={pmAmount} onChange={(e) => setPmAmount(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm font-bold" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Received in / via *</label>
                <select value={pmMethod} onChange={(e) => setPmMethod(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm bg-white">
                  <option value="cash">Cash</option>
                  {paymentAccounts.map(a => (
                    <option key={a.id} value={`acc:${a.id}`}>{a.type} - {a.account_title} ({a.account_number})</option>
                  ))}
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date & time received</label>
                <input type="datetime-local" value={pmDate} onChange={(e) => setPmDate(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transaction / reference ID (optional)</label>
                <input type="text" value={pmRef} onChange={(e) => setPmRef(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Note (optional)</label>
                <input type="text" value={pmNote} onChange={(e) => setPmNote(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>

              <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-sm py-3 rounded-xl cursor-pointer">
                Save Payment
              </button>
            </form>
          </div>
        );
      })()}

      {/* EDIT ORDER MODAL */}
      {editOrder && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setEditOrder(null)}>
          <form onSubmit={handleSaveEditOrder} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900">Edit Order {editOrder.invoice_no || ''}</h3>
              <button type="button" onClick={() => setEditOrder(null)} className="cursor-pointer" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Customer name *</label>
              <input type="text" required value={eoName} onChange={(e) => setEoName(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone (with country code, e.g. +923001234567) *</label>
              <input type="tel" required value={eoPhone} onChange={(e) => setEoPhone(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
              <input type="email" value={eoEmail} onChange={(e) => setEoEmail(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Delivery address</label>
              <textarea rows={3} value={eoAddress} onChange={(e) => setEoAddress(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
            </div>
            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-sm py-3 rounded-xl cursor-pointer">
              Save Changes
            </button>
          </form>
        </div>
      )}

      {/* CART & CHECKOUT SLIDE-OVER WINDOW */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-lg h-full flex flex-col shadow-2xl p-6 overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-xl font-extrabold text-slate-800 flex items-center">
                <ShoppingCart className="mr-2 w-6 h-6 text-amber-500" /> Shopping Cart
              </h3>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-2xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            {orderSuccess ? (
              <div className="my-auto text-center py-8 px-4">
                <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-4" />
                <h4 className="text-2xl font-black text-slate-900 mb-1">Order Confirmed!</h4>
                <p className="text-sm text-slate-500 mb-4">Your order has been saved successfully.</p>
                <button
                  onClick={() => { setIsCartOpen(false); setOrderSuccess(false); setCurrentView('track'); try { window.history.replaceState(null, '', `${window.location.pathname}?track=${encodeURIComponent(confirmedInvoice)}`); } catch { /* ignore */ } }}
                  className="mb-4 text-sm font-semibold text-amber-700 underline cursor-pointer"
                >
                  Track this order any time
                </button>
                <div className="bg-slate-100 p-4 rounded-xl mb-6 inline-block text-left w-full">
                  <div className="flex justify-between py-1 text-sm border-b mb-2">
                    <span className="text-slate-500">Invoice Number:</span>
                    <span className="font-bold text-slate-900">{confirmedInvoice}</span>
                  </div>
                  <div className="flex justify-between py-1 text-sm">
                    <span className="text-slate-500">Payment Status:</span>
                    <span className="font-bold text-amber-600">Awaiting payment confirmation</span>
                  </div>
                </div>
                {placedInvoice && (
                  <div className="mb-4 space-y-2 text-left">
                    {invoiceStatus && <p className="text-xs text-slate-600">{invoiceStatus}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setInvoiceView(placedInvoice)}
                        className="bg-slate-900 text-amber-400 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center cursor-pointer"
                      >
                        <Printer className="w-4 h-4 mr-1.5" /> View / Print Invoice
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`My invoice ${placedInvoice.order.invoice_no || ''} from ${settings.store_name}: ${window.location.origin}/?invoice=${placedInvoice.order.id}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-emerald-600 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center"
                      >
                        <MessageCircle className="w-4 h-4 mr-1.5" /> Share on WhatsApp
                      </a>
                    </div>
                  </div>
                )}
                {purchased && (
                  <div className="text-left bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 space-y-4">
                    <p className="text-sm font-black text-slate-900">Rate your products</p>
                    {purchased.items.map(it => {
                      const d = rateDrafts[it.id] || { rating: 5, remark: '' };
                      return (
                        <div key={it.id} className="border-b last:border-b-0 pb-3 last:pb-0">
                          <p className="text-xs font-bold text-slate-800 mb-1">{it.name}</p>
                          {d.done ? (
                            <p className="text-xs text-emerald-700 font-bold">Review submitted. Thank you!</p>
                          ) : (
                            <>
                              {starPicker(d.rating, (n) => setRateDrafts(prev => ({ ...prev, [it.id]: { ...d, rating: n } })))}
                              <textarea
                                rows={2}
                                placeholder="Remarks (optional)"
                                value={d.remark}
                                onChange={(e) => setRateDrafts(prev => ({ ...prev, [it.id]: { ...d, remark: e.target.value } }))}
                                className="w-full mt-1 px-3 py-2 border rounded-lg text-xs"
                              />
                              <button
                                onClick={async () => {
                                  const ok = await submitReview(it.id, purchased.order_id, purchased.customer_name, d.rating, d.remark);
                                  if (ok) setRateDrafts(prev => ({ ...prev, [it.id]: { ...d, done: true } }));
                                }}
                                className="mt-1 bg-slate-900 text-amber-400 font-bold text-xs px-4 py-2 rounded-lg cursor-pointer"
                              >
                                Submit Review
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <button
                  onClick={() => {
                    setPurchased(null);
                    setOrderSuccess(false);
                    setIsCartOpen(false);
                  }}
                  className="w-full bg-slate-900 text-amber-400 font-bold py-3 rounded-xl hover:bg-slate-800 transition cursor-pointer"
                >
                  Back to Store
                </button>
              </div>
            ) : cart.length === 0 ? (
              <div className="my-auto text-center py-16 text-slate-400">
                <ShoppingCart className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">Your cart is empty.</p>
              </div>
            ) : (
              <>
                <div className="shrink-0 py-4 space-y-3">
                  {cart.map((item) => (
                    <div key={item.cartKey} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                        {item.variant && <p className="text-[11px] text-slate-500">{item.variantLabel || 'Size'}: {item.variant}</p>}
                        <div className="flex items-center space-x-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => changeCartQty(item.cartKey, -1)}
                            className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => changeCartQty(item.cartKey, 1)}
                            className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <span className="text-xs text-slate-500">x PKR {item.discounted_price || item.price}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-black text-slate-900 text-sm">
                          PKR {(item.discounted_price || item.price) * item.quantity}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.cartKey)}
                          className="text-red-500 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="pt-3 border-t space-y-1 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal ({cart.reduce((a, b) => a + b.quantity, 0)} items)</span>
                      <span>{money(subtotalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Delivery {shipAddr.city ? `(${shipAddr.city})` : ''}</span>
                      <span>{!shipAddr.city ? 'Select your city below' : deliveryCharge > 0 ? money(deliveryCharge) : 'FREE'}</span>
                    </div>
                    {gst.amount > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>GST {gst.rate}%{gst.inclusive ? ' (included in prices)' : ''}</span>
                        <span>{money(gst.amount)}</span>
                      </div>
                    )}
                    {settings.free_delivery_over > 0 && deliveryCharge > 0 && (
                      <p className="text-[11px] text-emerald-700">Add {money(settings.free_delivery_over - subtotalAmount)} more for FREE delivery.</p>
                    )}
                    <div className="flex justify-between text-xl font-black text-slate-900 pt-1">
                      <span>Total:</span>
                      <span className="text-amber-600">{money(totalAmount)}</span>
                    </div>
                  </div>
                </div>

                {!authUser && (
                  <div className="border-t pt-3 text-xs text-slate-600 flex items-center justify-between gap-2">
                    <span>Have an account? Log in for faster checkout and to track your orders.</span>
                    <button
                      type="button"
                      onClick={() => { setIsCartOpen(false); setAuthMode('login'); setCurrentView('auth'); }}
                      className="shrink-0 border border-amber-600 text-amber-700 font-semibold px-3 py-1.5 rounded cursor-pointer"
                    >
                      Login
                    </button>
                  </div>
                )}
                <form onSubmit={handleCheckout} className="border-t pt-4 space-y-4">
                  <h4 className="font-extrabold text-slate-800 text-base">Customer & Shipping Details</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Customer Name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="name@email.com"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <PkAddressFields
                    value={shipAddr}
                    onChange={setShipAddr}
                    note={shipAddr.city ? (
                      <p className={`text-xs font-semibold rounded-lg px-3 py-2 ${deliveryCharge > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                        Delivery to {shipAddr.city}: {deliveryCharge > 0 ? money(deliveryCharge) : 'FREE'}
                      </p>
                    ) : null}
                  />

                  <label className="flex items-start space-x-2 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} className="mt-0.5" />
                    <span>Email me about new products and deals (you can unsubscribe any time).</span>
                  </label>

                  {/* ---- Payment ---- */}
                  {(() => {
                    const accounts = paymentAccounts.filter(acc => acc.is_active !== false);
                    const chosen = accounts.find(acc => acc.id === payAccountId);
                    const field = 'w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500';
                    return (
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-slate-600">Select Payment Method</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={!codAllowed}
                            onClick={() => setPaymentMethod('cod')}
                            className={`p-3 rounded-xl border-2 text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${paymentMethod === 'cod' && codAllowed ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600'}`}
                          >
                            <Wallet className="w-5 h-5" /> Cash on Delivery
                            <span className="text-[10px] font-medium text-slate-500">{codAllowed ? (settings.cod_karachi_only ? 'Karachi only' : 'Pay when you receive') : 'Only for Karachi'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={accounts.length === 0}
                            onClick={() => {
                              setPaymentMethod('online');
                              if (!payAccountId && accounts[0]) setPayAccountId(accounts[0].id);
                              if (!payerAmount) setPayerAmount(String(totalAmount));
                              if (!payerPaidAt) {
                                const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                                setPayerPaidAt(d.toISOString().slice(0, 16));
                              }
                            }}
                            className={`p-3 rounded-xl border-2 text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${paymentMethod !== 'cod' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600'}`}
                          >
                            <CreditCard className="w-5 h-5" /> Online Payment
                            <span className="text-[10px] font-medium text-slate-500">EasyPaisa / JazzCash / Bank</span>
                          </button>
                        </div>

                        {paymentMethod !== 'cod' && (
                          <div className="border rounded-xl overflow-hidden">
                            <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 border-b">Step 1: Choose an account and send the payment</div>
                            <div className="p-3 space-y-2">
                              {accounts.map(acc => (
                                <label key={acc.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer ${payAccountId === acc.id ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}>
                                  <input type="radio" name="pay-account" checked={payAccountId === acc.id} onChange={() => setPayAccountId(acc.id)} />
                                  <span className="flex-1 min-w-0">
                                    <span className="block text-sm font-bold text-slate-900">{acc.type}</span>
                                    <span className="block text-[11px] text-slate-500 truncate">{acc.account_title}</span>
                                  </span>
                                  <span className="text-xs font-mono font-bold text-slate-800">{acc.account_number}</span>
                                </label>
                              ))}
                              {chosen && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
                                  <p>Send exactly <b className="text-amber-700 text-sm">{money(totalAmount)}</b> to:</p>
                                  <p className="font-bold text-slate-900">{chosen.type} · {chosen.account_title}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-black text-base text-slate-900">{chosen.account_number}</span>
                                    <button
                                      type="button"
                                      onClick={() => { navigator.clipboard?.writeText(chosen.account_number); setToastMessage('Account number copied'); setTimeout(() => setToastMessage(null), 2000); }}
                                      className="text-[11px] font-bold border border-amber-600 text-amber-700 px-2 py-0.5 rounded cursor-pointer"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 border-y">Step 2: Enter your payment details</div>
                            <div className="p-3 grid grid-cols-2 gap-3">
                              <div className="col-span-2 sm:col-span-1">
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Account holder name (sender) *</label>
                                <input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Name on your account" className={field} />
                              </div>
                              <div className="col-span-2 sm:col-span-1">
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sent from (mobile / account no.) *</label>
                                <input value={payerAccount} onChange={(e) => setPayerAccount(e.target.value)} placeholder="e.g. 0300-1234567" inputMode="tel" className={field} />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Transaction ID (TID) *</label>
                                <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="From your payment SMS / app receipt" className={field + ' font-mono'} />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Amount paid (Rs.) *</label>
                                <input value={payerAmount} onChange={(e) => setPayerAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className={field} />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date & time of payment</label>
                                <input type="datetime-local" value={payerPaidAt} onChange={(e) => setPayerPaidAt(e.target.value)} className={field} />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Screenshot of payment (recommended)</label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files && e.target.files[0];
                                    if (!file) return;
                                    try { setPaymentProof(await resizeImage(file, 1000)); } catch (err: any) { alert(err.message || String(err)); }
                                  }}
                                  className="w-full text-xs"
                                />
                                {paymentProof && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <img src={paymentProof} alt="Payment screenshot" className="h-16 rounded border" />
                                    <button type="button" onClick={() => setPaymentProof('')} className="text-[11px] text-red-600 font-bold cursor-pointer">Remove</button>
                                  </div>
                                )}
                              </div>
                              {Number(payerAmount) > 0 && Number(payerAmount) < totalAmount && (
                                <p className="col-span-2 text-[11px] text-red-600 font-semibold">The amount is less than the order total ({money(totalAmount)}).</p>
                              )}
                              <p className="col-span-2 text-[11px] text-slate-500">We check your payment and then confirm the order. You will get the invoice by email.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold py-3.5 rounded-xl transition shadow-lg text-center text-base cursor-pointer"
                  >
                    {isSubmitting ? 'Processing Order...' : 'Confirm Order Now'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: ADMIN LOGIN PAGE */}
      {currentView === 'login' && (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Lock className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Admin Portal Login</h2>
              <p className="text-xs text-slate-500 mt-1">{settings.store_name} Management Portal</p>
              <p className="text-[10px] text-slate-400 mt-1">Build: {BUILD}</p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">User ID / Username</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="User ID"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="Password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold py-3.5 rounded-xl transition shadow-xl text-sm mt-2 cursor-pointer"
              >
                Login to Control Center
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Public "Track Order" page */}
      {currentView === 'track' && (
        <TrackOrderPage onBack={() => { setCurrentView('store'); try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ } }} />
      )}

      {/* Admin: courier & tracking window */}
      {courierEdit && (
        <div className="fixed inset-0 z-[85] bg-black/60 flex items-center justify-center p-4" onClick={() => setCourierEdit(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900">Courier & tracking - {courierEdit.order.invoice_no}</h3>
            <p className="text-xs text-slate-500">{courierEdit.order.customer_name} · {cityOfOrder(courierEdit.order)}</p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Courier</label>
              <select value={courierEdit.courier} onChange={(e) => setCourierEdit({ ...courierEdit, courier: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                {COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {/own delivery/i.test(courierEdit.courier) ? 'Rider name / phone (optional)' : 'Tracking / CN number'}
              </label>
              <input value={courierEdit.tracking_no} onChange={(e) => setCourierEdit({ ...courierEdit, tracking_no: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tracking link from the courier (optional)</label>
              <input value={courierEdit.tracking_url} onChange={(e) => setCourierEdit({ ...courierEdit, tracking_url: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 border rounded-lg text-sm" />
              <p className="text-[11px] text-slate-400 mt-1">Empty = the customer gets a "Track with courier" button that searches the number.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={courierEdit.ship} onChange={(e) => setCourierEdit({ ...courierEdit, ship: e.target.checked })} />
              Mark the order as Shipped
            </label>
            <div className="flex gap-2 pt-1">
              <button onClick={saveCourier} className="flex-1 bg-slate-900 text-amber-400 font-bold text-sm py-2.5 rounded-xl cursor-pointer">Save</button>
              <button onClick={() => setCourierEdit(null)} className="px-4 bg-slate-100 text-slate-700 font-bold text-sm rounded-xl cursor-pointer">Cancel</button>
            </div>
            <p className="text-[11px] text-slate-500">After saving, use "Send tracking on WhatsApp" under the order to tell the customer.</p>
          </div>
        </div>
      )}

      {/* Customer login / register */}
      {currentView === 'auth' && (
        <AuthPage
          storeName={settings.store_name}
          mode={authMode}
          setMode={setAuthMode}
          notice={pendingCart ? `Please login or register to add "${pendingCart.product.name}${pendingCart.variant ? ` (${pendingCart.variant.name})` : ''}" to your cart.` : ''}
          onDone={() => { if (!pendingCart) setCurrentView('store'); }}
          onBack={() => { setPendingCart(null); setCurrentView('store'); }}
        />
      )}

      {/* Customer "My Account" */}
      {currentView === 'account' && authUser && (
        <AccountPage
          user={authUser}
          onShop={() => setCurrentView('store')}
          onLogout={async () => { await supabase.auth.signOut(); setCurrentView('store'); }}
        />
      )}

      {/* VIEW 3: ADMIN (seller-centre style: side menu + pages) */}
      {currentView === 'admin' && isAdminLoggedIn && (() => {
        const goAdmin = (id: string) => {
          const item = ADMIN_MENU.flatMap(g => g.items).find(i => i.id === id);
          if (id.startsWith('settings:')) { setAdminTab('settings'); setSettingsTab(id.split(':')[1] as SettingsTab); }
          else setAdminTab(id as any);
          if (item && item.open) item.open();
          setAdminMenuOpen(false);
          window.scrollTo({ top: 0 });
        };
        const activeId = adminTab === 'settings' ? `settings:${settingsTab}` : adminTab;
        const activeItem = ADMIN_MENU.flatMap(g => g.items).find(i => i.id === activeId);
        return (
          <div className="flex items-start">
            <aside className={`${adminMenuOpen ? 'fixed inset-0 z-50 flex' : 'hidden'} md:flex md:sticky md:top-[68px] md:z-auto md:h-[calc(100vh-68px)] md:w-60 shrink-0`}>
              <div className="bg-slate-900 text-slate-300 w-64 md:w-60 h-full overflow-y-auto flex flex-col">
                <div className="px-4 py-4 border-b border-slate-800">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Admin</p>
                  <p className="text-sm font-bold text-white truncate">{loggedInUserName}</p>
                  <p className="text-[11px] text-amber-400">{loggedInUserRole}</p>
                </div>
                <nav className="flex-1 py-2">
                  {ADMIN_MENU.map(g => (
                    <div key={g.title} className="mb-1">
                      <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{g.title}</p>
                      {g.items.map(it => {
                        const Icon = it.icon;
                        const on = it.id === activeId;
                        const badge = it.badge ? it.badge() : 0;
                        return (
                          <button
                            key={it.id}
                            onClick={() => goAdmin(it.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left cursor-pointer border-l-4 ${on ? 'bg-slate-800 text-white border-amber-500' : 'border-transparent hover:bg-slate-800/60 hover:text-white'}`}
                          >
                            <Icon className={`w-4 h-4 shrink-0 ${on ? 'text-amber-400' : ''}`} />
                            <span className="flex-1 truncate">{it.label}</span>
                            {badge > 0 && <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </nav>
                <div className="p-3 border-t border-slate-800 space-y-2">
                  <button onClick={() => { setCurrentView('store'); setAdminMenuOpen(false); }} className="w-full text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white py-2 rounded cursor-pointer">
                    View my shop
                  </button>
                  <button onClick={adminLogout} className="w-full text-xs font-semibold bg-red-600 hover:bg-red-700 text-white py-2 rounded flex items-center justify-center gap-1.5 cursor-pointer">
                    <LogOut className="w-3.5 h-3.5" /> Logout
                  </button>
                  <p className="text-[10px] text-slate-500 text-center">Build: {BUILD}</p>
                </div>
              </div>
              <div className="flex-1 bg-black/50 md:hidden" onClick={() => setAdminMenuOpen(false)} />
            </aside>

            <div className="flex-1 min-w-0 px-3 sm:px-6 py-4 sm:py-6">
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => setAdminMenuOpen(true)} className="md:hidden bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer">☰ Menu</button>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">{activeItem ? activeItem.label : 'Admin'}</h2>
              </div>

              {adminTab === 'ai' && (
                <div className="max-w-3xl">
                  <ChatPanel mode="admin" storeName={settings.store_name} tall />
                  <p className="text-[11px] text-slate-500 mt-2">
                    Without an AI key the free built-in assistant answers: "aaj ki sale", "pending orders", "kam stock", "payments to check".
                    With a free GEMINI_API_KEY it understands any question and, on your request, changes an order status, marks an order paid,
                    or changes stock / price. It cannot delete anything or change settings.
                  </p>
                </div>
              )}

              {adminTab === 'dashboard' && (() => {
                const now = new Date();
                const sameDay = (iso?: string) => !!iso && new Date(iso).toDateString() === now.toDateString();
                const sameMonth = (iso?: string) => { if (!iso) return false; const d = new Date(iso); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); };
                const live = adminOrders.filter(o => o.status !== 'Cancelled');
                const todays = live.filter(o => sameDay((o as any).created_at));
                const pending = live.filter(o => (o.status || 'Pending') === 'Pending');
                const toVerify = live.filter(o => o.payment_method && o.payment_method !== 'cod' && o.payment_status !== 'Paid');
                const monthSales = live.filter(o => sameMonth((o as any).created_at)).reduce((t, o) => t + Number(o.total_amount || 0), 0);
                const lowStock = products.filter(p => p.stock_quantity <= 5).sort((a, b) => a.stock_quantity - b.stock_quantity).slice(0, 8);
                const card = (title: string, value: string | number, note: string, go: string, tone: string) => (
                  <button onClick={() => goAdmin(go)} className="bg-white rounded-xl border p-4 text-left hover:shadow-md transition cursor-pointer">
                    <p className="text-xs text-slate-500">{title}</p>
                    <p className={`text-2xl font-black mt-1 ${tone}`}>{value}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{note}</p>
                  </button>
                );
                return (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {card("Today's orders", todays.length, money(todays.reduce((t, o) => t + Number(o.total_amount || 0), 0)), 'orders', 'text-slate-900')}
                      {card('Pending orders', pending.length, 'Waiting to be confirmed', 'orders', 'text-amber-600')}
                      {card('Payments to verify', toVerify.length, 'Online payments not yet checked', 'orders', 'text-red-600')}
                      {card('Sales this month', money(monthSales), `${live.filter(o => sameMonth((o as any).created_at)).length} orders`, 'payments', 'text-emerald-700')}
                    </div>

                    <div className="grid lg:grid-cols-3 gap-5">
                      <div className="lg:col-span-2 bg-white rounded-xl border">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                          <h3 className="text-sm font-bold text-slate-900">Latest orders</h3>
                          <button onClick={() => goAdmin('orders')} className="text-xs text-amber-700 font-semibold cursor-pointer">See all</button>
                        </div>
                        {adminOrders.length === 0 ? (
                          <p className="px-4 py-8 text-sm text-slate-400 text-center">No orders yet.</p>
                        ) : (
                          <div className="divide-y">
                            {adminOrders.slice(0, 6).map(o => (
                              <div key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                                <span className="font-bold text-slate-900 w-20 shrink-0">{o.invoice_no || '-'}</span>
                                <span className="flex-1 min-w-0 truncate text-slate-700">{o.customer_name}</span>
                                <span className="hidden sm:inline text-slate-500 uppercase">{o.payment_method || 'cod'}</span>
                                <span className="font-bold text-slate-900">{money(o.total_amount)}</span>
                                <span className={`px-2 py-0.5 rounded-full font-semibold ${o.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' : o.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{o.status || 'Pending'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-white rounded-xl border">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                          <h3 className="text-sm font-bold text-slate-900">Low stock</h3>
                          <button onClick={() => goAdmin('products')} className="text-xs text-amber-700 font-semibold cursor-pointer">Products</button>
                        </div>
                        {lowStock.length === 0 ? (
                          <p className="px-4 py-8 text-sm text-slate-400 text-center">All products have enough stock.</p>
                        ) : (
                          <div className="divide-y">
                            {lowStock.map(p => (
                              <div key={p.id} className="flex items-center gap-2 px-4 py-2 text-xs">
                                <span className="flex-1 min-w-0 truncate text-slate-700">{p.name}</span>
                                <span className={`font-bold ${p.stock_quantity <= 0 ? 'text-red-600' : 'text-amber-600'}`}>{p.stock_quantity <= 0 ? 'Sold out' : `${p.stock_quantity} left`}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border p-4">
                      <h3 className="text-sm font-bold text-slate-900 mb-3">Quick actions</h3>
                      <div className="flex flex-wrap gap-2">
                        {[
                          ['products', '+ Add product'],
                          ['slides', 'Banner pictures'],
                          ['settings:look', 'Change theme'],
                          ['accounts', 'Payment accounts'],
                          ['settings:profile', 'Logo & contact']
                        ].map(([id, text]) => (
                          <button key={id} onClick={() => goAdmin(id)} className="text-xs font-semibold border border-slate-300 hover:border-amber-500 hover:text-amber-700 px-3 py-2 rounded-lg cursor-pointer">{text}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

          {/* TAB 1: PRODUCTS MANAGER */}
          {adminTab === 'products' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border shadow-sm">
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                  <h3 className="text-lg font-extrabold text-slate-900 flex items-center">
                    <Plus className="w-5 h-5 text-amber-500 mr-2" /> 
                    {editingProductId ? 'Edit Product Item' : 'Upload New Product'}
                  </h3>
                  {editingProductId && (
                    <button onClick={resetProductForm} className="text-xs bg-slate-200 px-3 py-1 rounded-lg font-bold flex items-center cursor-pointer">
                      <X className="w-3.5 h-3.5 mr-1" /> Cancel Edit
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveProduct} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Product Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Freecia Hair Mask Sweet Almond"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Select Category *</label>
                      <select
                        value={productCategory}
                        onChange={(e) => setProductCategory(e.target.value)}
                        className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-amber-500 bg-white"
                      >
                        <option value="">-- Choose Category --</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Product Description</label>
                    <textarea
                      rows={3}
                      placeholder="Product details & usage"
                      value={productDesc}
                      onChange={(e) => setProductDesc(e.target.value)}
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Original Price (PKR)</label>
                      <input
                        type="number"
                        placeholder="2800"
                        value={originalPrice}
                        onChange={(e) => setOriginalPrice(e.target.value)}
                        className="w-full px-3.5 py-2 border rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-emerald-700 mb-1">After Discount Price (PKR) *</label>
                      <input
                        type="number"
                        required={pVariants.length === 0}
                        placeholder="1850"
                        value={discountedPrice}
                        onChange={(e) => setDiscountedPrice(e.target.value)}
                        className="w-full px-3.5 py-2 border rounded-xl text-sm font-bold text-emerald-800"
                      />
                    </div>
                  </div>

                  {/* Options: sizes, shades, colours ... */}
                  <div className="border rounded-xl p-3 bg-slate-50 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-700">Options (optional) - sizes like 250 ML / 500 ML, or hair colour shades</p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPVariants(v => [...v, { name: '', price: v.length ? v[v.length - 1].price : discountedPrice, original_price: v.length ? v[v.length - 1].original_price : originalPrice, stock: '', color: '' }])}
                          className="text-[11px] font-bold bg-slate-900 text-amber-400 px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          + Add one
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkShades(bulkShades === null ? '' : null)}
                          className="text-[11px] font-bold border border-slate-400 text-slate-700 px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          + Add many
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-[11px] font-semibold text-slate-600">Option name shown to customers:</label>
                      <input value={pVariantLabel} onChange={(e) => setPVariantLabel(e.target.value)} className="px-2 py-1 border rounded-lg text-xs bg-white w-28" />
                      {['Size', 'Shade', 'Color', 'Pack', 'Weight'].map(l => (
                        <button key={l} type="button" onClick={() => setPVariantLabel(l)} className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer ${pVariantLabel === l ? 'bg-slate-900 text-amber-400 border-slate-900' : 'bg-white text-slate-600'}`}>{l}</button>
                      ))}
                    </div>

                    {bulkShades !== null && (
                      <div className="bg-white border rounded-lg p-2 space-y-1.5">
                        <p className="text-[11px] text-slate-600">One name per line (e.g. 0/00 Lift Cream, 1.0 Black, 4.0 Medium Brown). They get the sale price, old price and stock below the list; you can change each one afterwards.</p>
                        <textarea rows={5} value={bulkShades} onChange={(e) => setBulkShades(e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs font-mono" placeholder={'0/00 Lift Cream\n1.0 Black\n3.0 Dark Brown\n4.0 Medium Brown'} />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-slate-500">Price {discountedPrice || '-'} · Old {originalPrice || '-'} · Stock {productStock || '0'} (from the fields above)</span>
                          <button
                            type="button"
                            onClick={() => {
                              const names = (bulkShades || '').split('\n').map(x => x.trim()).filter(Boolean);
                              if (!names.length) return;
                              setPVariants(v => [
                                ...v,
                                ...names.filter(n => !v.some(x => x.name.toLowerCase() === n.toLowerCase()))
                                  .map(n => ({ name: n, price: discountedPrice, original_price: originalPrice, stock: productStock || '0', color: '' }))
                              ]);
                              setBulkShades(null);
                            }}
                            className="ml-auto text-[11px] font-bold bg-amber-600 text-white px-3 py-1 rounded-lg cursor-pointer"
                          >
                            Add these
                          </button>
                        </div>
                      </div>
                    )}

                    {pVariants.length === 0 && bulkShades === null && (
                      <p className="text-[11px] text-slate-500">No options: the product is sold at one price. Add options if it comes in different sizes or shades; the customer then picks one.</p>
                    )}
                    {pVariants.length > 0 && (
                      <div className="grid grid-cols-[auto_1.4fr_1fr_1fr_0.8fr_auto] gap-1.5 text-[10px] font-bold text-slate-500 px-0.5">
                        <span>Colour</span><span>{pVariantLabel || 'Option'} name</span><span>Sale price</span><span>Old price</span><span>Stock</span><span></span>
                      </div>
                    )}
                    <div className="space-y-1.5 max-h-80 overflow-y-auto">
                      {pVariants.map((v, i) => {
                        const upd = (k: 'name' | 'price' | 'original_price' | 'stock' | 'color', val: string) =>
                          setPVariants(list => list.map((x, idx) => idx === i ? { ...x, [k]: val } : x));
                        return (
                          <div key={i} className="grid grid-cols-[auto_1.4fr_1fr_1fr_0.8fr_auto] gap-1.5 items-center">
                            <span className="relative w-7 h-7">
                              <input
                                type="color"
                                value={v.color || '#ffffff'}
                                onChange={(e) => upd('color', e.target.value)}
                                title="Swatch colour (optional)"
                                className="w-7 h-7 p-0 border rounded cursor-pointer"
                              />
                              {v.color && (
                                <button type="button" onClick={() => upd('color', '')} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border text-[9px] leading-none cursor-pointer" aria-label="Remove colour">×</button>
                              )}
                            </span>
                            <input value={v.name} onChange={(e) => upd('name', e.target.value)} placeholder={pVariantLabel === 'Shade' ? '4.0 Medium Brown' : '500 ML'} className="px-2 py-1.5 border rounded-lg text-xs bg-white min-w-0" />
                            <input value={v.price} onChange={(e) => upd('price', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Rs." inputMode="decimal" className="px-2 py-1.5 border rounded-lg text-xs bg-white min-w-0" />
                            <input value={v.original_price} onChange={(e) => upd('original_price', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="(optional)" inputMode="decimal" className="px-2 py-1.5 border rounded-lg text-xs bg-white min-w-0" />
                            <input value={v.stock} onChange={(e) => upd('stock', e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" inputMode="numeric" className="px-2 py-1.5 border rounded-lg text-xs bg-white min-w-0" />
                            <button type="button" onClick={() => setPVariants(list => list.filter((_, idx) => idx !== i))} className="px-2 text-red-600 cursor-pointer" aria-label="Remove option">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {pVariants.length > 0 && (
                      <p className="text-[11px] text-slate-500">{pVariants.length} options. With options, the price and stock above are not used: the shop shows the cheapest option and the total stock. The colour box is optional (a small coloured dot next to the shade name).</p>
                    )}
                  </div>

                  <div className={pVariants.length > 0 ? 'hidden' : ''}>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Stock Quantity (items available) *</label>
                    <input
                      type="number"
                      min="0"
                      required={pVariants.length === 0}
                      placeholder="e.g. 100"
                      value={productStock}
                      onChange={(e) => setProductStock(e.target.value)}
                      className="w-full px-3.5 py-2 border rounded-xl text-sm font-bold"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">When editing, enter the stock that is left now. The sold count updates automatically.</p>
                  </div>

                  {!editingProductId && (
                    <label className="flex items-start space-x-2 text-xs font-bold text-slate-700 cursor-pointer bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <input type="checkbox" checked={notifyCustomers} onChange={(e) => setNotifyCustomers(e.target.checked)} className="mt-0.5" />
                      <span>Email customers about this new product after saving (only customers who agreed to receive offers)</span>
                    </label>
                  )}

                  <div className="bg-slate-50 p-4 rounded-2xl border space-y-3">
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Option A: Browse File Image Upload (PNG, JPG, WEBP, GIF, SVG Support)
                    </label>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center bg-white hover:bg-slate-100 transition relative cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                      <p className="text-xs font-bold text-slate-700">Click to Browse File from Computer / Mobile</p>
                      <p className="text-[10px] text-slate-400 mt-1">Supports PNG, JPG, JPEG, WEBP, SVG</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Option B: Direct Image Link / URL
                      </label>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={imageUrl}
                        onChange={(e) => {
                          setImageUrl(e.target.value);
                          setImagePreview(e.target.value);
                        }}
                        className="w-full px-3.5 py-2 border rounded-xl text-xs bg-white"
                      />
                    </div>

                    {imagePreview && (
                      <div className="mt-2 flex items-center space-x-3 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                        <img src={imagePreview} alt="Preview" className="w-12 h-12 object-cover rounded-lg border" />
                        <span className="text-xs text-emerald-800 font-bold">Image Preview Ready!</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isUploading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl transition shadow-lg text-sm cursor-pointer"
                  >
                    {isUploading ? 'Saving...' : editingProductId ? 'Update Product Details' : 'Save & Publish Product to Store'}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-3xl p-6 border shadow-sm h-fit">
                <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b">
                  Manage Active Products ({products.length})
                </h3>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {products.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border text-xs">
                      <div className="flex items-center space-x-3">
                        <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded-lg border" />
                        <div className="max-w-[130px]">
                          <h4 className="font-bold text-slate-800 truncate">{p.name}</h4>
                          <span className="text-emerald-700 font-bold">PKR {p.discounted_price || p.price}</span>
                          <div className="text-[10px] font-bold text-slate-500">
                            Stock: <span className={p.stock_quantity <= 0 ? 'text-red-600' : 'text-slate-800'}>{p.stock_quantity ?? 0}</span> | Sold: <span className="text-emerald-700">{p.sold_quantity ?? 0}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleEditProduct(p)}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 p-2 rounded-lg font-bold cursor-pointer"
                          title="Edit Product"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg font-bold cursor-pointer"
                          title="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANAGE CATEGORIES */}
          {adminTab === 'categories' && (
            <div className="max-w-xl bg-white rounded-3xl p-6 border shadow-sm">
              <h3 className="text-lg font-extrabold text-slate-900 mb-4 pb-2 border-b flex items-center">
                <Tag className="w-5 h-5 text-amber-500 mr-2" /> Add New Category
              </h3>

              <form onSubmit={handleAddCategory} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hair Care / Bleach Series"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-amber-400 font-bold py-3 rounded-xl text-sm cursor-pointer"
                >
                  Create Category
                </button>
              </form>

              <div className="mt-8 border-t pt-4">
                <h4 className="font-bold text-xs uppercase text-slate-400 mb-3">Categories List</h4>
                <div className="space-y-2">
                  {categories.map((c) => (
                    <div key={c.id} className="bg-slate-50 px-4 py-2.5 rounded-xl border text-sm font-semibold text-slate-800 flex justify-between items-center">
                      <span>{c.name}</span>
                      <button onClick={() => handleDeleteCategory(c.id)} className="text-red-500 hover:text-red-700 cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMER ORDERS */}
          {adminTab === 'orders' && (
            <div className="bg-white rounded-3xl p-6 border shadow-sm overflow-x-auto">
              <h3 className="text-lg font-extrabold text-slate-900 mb-4 pb-2 border-b flex items-center">
                <FileText className="w-5 h-5 text-amber-500 mr-2" /> Customer Orders & Invoices
              </h3>
              {adminOrders.length > 0 && (
                <>
                  {cityBar(countBy(adminOrders.map(cityOfOrder)), adminOrders.length, orderCity, setOrderCity)}
                  <div className="flex items-center gap-2 mb-3 text-xs text-slate-600">
                    Sort by
                    <select value={orderSort} onChange={(e) => setOrderSort(e.target.value as any)} className="border rounded-lg px-2 py-1.5 bg-white">
                      <option value="new">Newest first</option>
                      <option value="old">Oldest first</option>
                      <option value="city">City (A-Z)</option>
                      <option value="amount">Amount (high to low)</option>
                    </select>
                  </div>
                </>
              )}

              {adminOrders.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-medium">
                  No orders received yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-amber-400 uppercase font-bold border-b">
                    <tr>
                      <th className="p-3.5">Invoice No</th>
                      <th className="p-3.5">Ordered On</th>
                      <th className="p-3.5">Customer Name</th>
                      <th className="p-3.5">Phone / WhatsApp</th>
                      <th className="p-3.5">Shipping Address</th>
                      <th className="p-3.5">Items</th>
                      <th className="p-3.5">Total Amount</th>
                      <th className="p-3.5">Payment Method</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Delivered On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {adminOrders
                      .filter(o => orderCity === 'All' || cityOfOrder(o) === orderCity)
                      .slice()
                      .sort((a, b) => {
                        if (orderSort === 'old') return String((a as any).created_at).localeCompare(String((b as any).created_at));
                        if (orderSort === 'city') return cityOfOrder(a).localeCompare(cityOfOrder(b)) || String((b as any).created_at).localeCompare(String((a as any).created_at));
                        if (orderSort === 'amount') return Number(b.total_amount || 0) - Number(a.total_amount || 0);
                        return String((b as any).created_at).localeCompare(String((a as any).created_at));
                      })
                      .map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 font-black text-slate-900">{order.invoice_no || '-'}</td>
                        <td className="p-3.5 text-slate-600 whitespace-nowrap">{fmtDateTime(order.created_at)}</td>
                        <td className="p-3.5 font-bold text-slate-800">
                          {order.customer_name}
                          {order.customer_email && <div className="text-[11px] font-normal text-slate-500">{order.customer_email}</div>}
                          <button
                            onClick={() => openEditOrder(order)}
                            className="mt-1 flex items-center text-[10px] font-bold text-blue-700 hover:underline cursor-pointer"
                          >
                            <Edit className="w-3 h-3 mr-1" /> Edit order
                          </button>
                          <button
                            onClick={() => openInvoice(order)}
                            className="mt-1 flex items-center text-[10px] font-bold text-slate-700 hover:underline cursor-pointer"
                          >
                            <Printer className="w-3 h-3 mr-1" /> Invoice
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order)}
                            className="mt-1 flex items-center text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Delete order
                          </button>
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {order.customer_phone}
                          <a
                            href={waLink(order.customer_phone, `Hello ${order.customer_name}, we have received your order ${order.invoice_no || ''}. Thank you!`)}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-emerald-700 font-bold underline"
                          >
                            WhatsApp customer
                          </a>
                        </td>
                        <td className="p-3.5 text-slate-600 max-w-xs">
                          <span className="inline-block mb-1 bg-slate-900 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded">{cityOfOrder(order)}</span>
                          <div>{order.shipping_address}</div>
                          {Number(order.delivery_charge || 0) > 0 && <div className="text-[11px] text-slate-500 mt-0.5">Delivery: PKR {order.delivery_charge}</div>}
                        </td>
                        <td className="p-3.5 text-slate-700">
                          {(order.order_items || []).map((it, i) => (
                            <div key={it.id || i}>{it.quantity} x {it.product_name}</div>
                          ))}
                        </td>
                        <td className="p-3.5 font-black text-emerald-700">PKR {order.total_amount}</td>
                        <td className="p-3.5 text-slate-700 min-w-[11rem]">
                          <div className="font-semibold uppercase">{order.payment_method || 'COD'}</div>
                          {order.payment_method && order.payment_method !== 'cod' && (
                            <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                              {order.payment_account_label && <div>To: {order.payment_account_label}</div>}
                              {order.payer_name && <div>From: <b>{order.payer_name}</b> ({order.payer_account})</div>}
                              {order.transaction_id && <div>TID: <span className="font-mono font-bold">{order.transaction_id}</span></div>}
                              {order.payer_amount != null && (
                                <div className={Number(order.payer_amount) < Number(order.total_amount) ? 'text-red-600 font-bold' : ''}>
                                  Paid: PKR {order.payer_amount}{order.payer_paid_at ? ` · ${fmtDateTime(order.payer_paid_at)}` : ''}
                                </div>
                              )}
                              {order.has_payment_proof && (
                                <button onClick={() => showPaymentProof(order.id)} className="text-blue-700 font-bold underline cursor-pointer">View screenshot</button>
                              )}
                              <div className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${order.payment_status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {order.payment_status === 'Paid' ? 'Verified' : 'To verify'}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-3.5">
                          <select
                            value={order.status || 'Pending'}
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                            className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded-full text-[10px] cursor-pointer"
                          >
                            {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                          <div className="mt-1.5 text-[10px] text-slate-600 space-y-0.5">
                            {order.courier && <div>Courier: <b>{order.courier}</b></div>}
                            {order.tracking_no && <div>Tracking: <span className="font-mono font-bold">{order.tracking_no}</span></div>}
                            <button
                              onClick={() => setCourierEdit({ order, courier: order.courier || (cityOfOrder(order) === 'Karachi' ? 'Own delivery (rider)' : 'TCS'), tracking_no: order.tracking_no || '', tracking_url: order.tracking_url || '', ship: order.status !== 'Shipped' && order.status !== 'Delivered' })}
                              className="text-blue-700 font-bold underline cursor-pointer"
                            >
                              {order.tracking_no || order.courier ? 'Edit courier / tracking' : 'Add courier / tracking'}
                            </button>
                            {(order.tracking_no || order.courier) && (
                              <a href={waLink(order.customer_phone, trackingMessage(order))} target="_blank" rel="noreferrer" className="block text-emerald-700 font-bold underline">
                                Send tracking on WhatsApp
                              </a>
                            )}
                          </div>
                          {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'Delivered')}
                              className="block mt-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg text-[10px] cursor-pointer"
                            >
                              Mark Delivered
                            </button>
                          )}
                          {(() => {
                            const pi = payInfo(order);
                            return (
                              <div className="mt-2">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${pi.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : pi.status === 'Partial' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>
                                  {pi.status === 'Paid' ? 'Payment Received' : pi.status === 'Partial' ? `Partial: PKR ${pi.paid}` : 'Payment Pending'}
                                </span>
                                {pi.status !== 'Paid' && (
                                  <button
                                    onClick={() => openPayModal(order)}
                                    className="block mt-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-2.5 py-1 rounded-lg text-[10px] cursor-pointer"
                                  >
                                    Payment Received
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-3.5 text-emerald-700 font-bold whitespace-nowrap">{fmtDateTime(order.delivered_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 4: ADMIN USERS */}
          {adminTab === 'users' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-3xl p-6 border shadow-sm">
                <h3 className="text-lg font-extrabold text-slate-900 mb-4 pb-2 border-b flex items-center">
                  <UserPlus className="w-5 h-5 text-amber-500 mr-2" /> 
                  {editingUserId ? 'Edit Admin User & Password' : 'Create New Admin User'}
                </h3>

                <form onSubmit={handleSaveUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">User ID / Username *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. manager1"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {editingUserId ? 'New Password (leave empty to keep the current one)' : 'Password * (at least 6 characters)'}
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      required={!editingUserId}
                      minLength={6}
                      placeholder={editingUserId ? 'Leave empty to keep' : 'Enter New Password'}
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Role Level</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm bg-white"
                    >
                      <option value="Super Admin">Super Admin (Full Access)</option>
                      <option value="Store Manager">Store Manager</option>
                      <option value="Staff Admin">Staff Admin</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-slate-900 text-amber-400 font-bold py-3.5 rounded-xl text-sm shadow-lg cursor-pointer"
                  >
                    {editingUserId ? 'Update User Details' : 'Create Admin User'}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-3xl p-6 border shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b">Active Admin Users ({adminUsers.length})</h3>
                <div className="space-y-3">
                  {adminUsers.map((u) => (
                    <div key={u.id} className="flex justify-between items-center bg-slate-50 p-3.5 rounded-2xl border">
                      <div className="flex items-center space-x-3">
                        <Shield className="w-5 h-5 text-amber-500" />
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{u.username}</h4>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">Role: {u.role}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditUser(u)}
                          className="bg-amber-100 text-amber-900 p-2 rounded-lg font-bold cursor-pointer"
                          title="Edit Password"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="bg-red-100 text-red-700 p-2 rounded-lg font-bold cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: SETTINGS */}
          {adminTab === 'settings' && (
            <SettingsPanel
              tab={settingsTab}
              settings={settings}
              accounts={paymentAccounts}
              onSaved={setSettings}
              onOpenAccounts={() => setAdminTab('accounts')}
            />
          )}

          {/* TAB 7: PAYMENTS */}
          {adminTab === 'payments' && (() => {
            const rows = adminOrders
              .filter(o => o.status !== 'Cancelled')
              .map(o => ({ o, ...payInfo(o) }));
            const totalSales = rows.reduce((a, r) => a + r.total, 0);
            const received = rows.reduce((a, r) => a + Math.min(r.paid, r.total), 0);
            const pending = totalSales - received;
            const unpaidCount = rows.filter(r => r.status !== 'Paid').length;
            const shown = rows.filter(r => paymentFilter === 'All' || r.status === paymentFilter);

            const byCategory: Record<string, number> = {};
            const byAccount: Record<string, number> = {};
            payments.forEach(pm => {
              byCategory[pm.category] = (byCategory[pm.category] || 0) + Number(pm.amount);
              const key = pm.account_label || pm.method;
              byAccount[key] = (byAccount[key] || 0) + Number(pm.amount);
            });
            const orderById = (id: string) => adminOrders.find(x => x.id === id);

            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl border p-4"><p className="text-[11px] font-bold text-slate-500 uppercase">Total Sales</p><p className="text-xl font-black text-slate-900">PKR {totalSales}</p></div>
                  <div className="bg-white rounded-2xl border p-4"><p className="text-[11px] font-bold text-slate-500 uppercase">Payment Received</p><p className="text-xl font-black text-emerald-700">PKR {received}</p></div>
                  <div className="bg-white rounded-2xl border p-4"><p className="text-[11px] font-bold text-slate-500 uppercase">Pending Balance</p><p className="text-xl font-black text-red-600">PKR {pending}</p></div>
                  <div className="bg-white rounded-2xl border p-4"><p className="text-[11px] font-bold text-slate-500 uppercase">Orders Not Fully Paid</p><p className="text-xl font-black text-amber-600">{unpaidCount}</p></div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl border p-4">
                    <h4 className="text-sm font-black text-slate-900 mb-2">Received by Category</h4>
                    {Object.keys(byCategory).length === 0 ? <p className="text-xs text-slate-400">No payments recorded yet.</p> : (
                      <table className="w-full text-xs"><tbody>
                        {Object.entries(byCategory).map(([k, v]) => (
                          <tr key={k} className="border-b last:border-b-0"><td className="py-1.5 font-bold">{k}</td><td className="py-1.5 text-right font-black text-emerald-700">PKR {v}</td></tr>
                        ))}
                      </tbody></table>
                    )}
                  </div>
                  <div className="bg-white rounded-2xl border p-4">
                    <h4 className="text-sm font-black text-slate-900 mb-2">Received by Account</h4>
                    {Object.keys(byAccount).length === 0 ? <p className="text-xs text-slate-400">No payments recorded yet.</p> : (
                      <table className="w-full text-xs"><tbody>
                        {Object.entries(byAccount).map(([k, v]) => (
                          <tr key={k} className="border-b last:border-b-0"><td className="py-1.5">{k}</td><td className="py-1.5 text-right font-black text-emerald-700">PKR {v}</td></tr>
                        ))}
                      </tbody></table>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border shadow-sm overflow-x-auto">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4 pb-2 border-b">
                    <h3 className="text-lg font-extrabold text-slate-900 flex items-center">
                      <Wallet className="w-5 h-5 text-amber-500 mr-2" /> Order Payments
                    </h3>
                    <div className="flex space-x-2">
                      {(['All', 'Unpaid', 'Partial', 'Paid'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setPaymentFilter(f)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer ${paymentFilter === f ? 'bg-slate-900 text-amber-400' : 'bg-slate-100 text-slate-600'}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {shown.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 font-medium">No orders found.</div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-amber-400 uppercase font-bold">
                        <tr>
                          <th className="p-3">Invoice</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Customer</th>
                          <th className="p-3">Method / Txn ID</th>
                          <th className="p-3">Total</th>
                          <th className="p-3">Received</th>
                          <th className="p-3">Balance</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {shown.map(({ o, total, paid, balance, status }) => (
                          <tr key={o.id} className="hover:bg-slate-50">
                            <td className="p-3 font-black">{o.invoice_no || '-'}</td>
                            <td className="p-3 whitespace-nowrap text-slate-600">{fmtDateTime(o.created_at)}</td>
                            <td className="p-3"><div className="font-bold">{o.customer_name}</div><div className="text-slate-500">{o.customer_phone}</div></td>
                            <td className="p-3 uppercase">{o.payment_method}{o.transaction_id ? <div className="normal-case text-slate-500">Txn: {o.transaction_id}</div> : null}</td>
                            <td className="p-3 font-bold">PKR {total}</td>
                            <td className="p-3 font-bold text-emerald-700">PKR {paid}</td>
                            <td className="p-3 font-bold text-red-600">PKR {balance}</td>
                            <td className="p-3">
                              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : status === 'Partial' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>{status}</span>
                            </td>
                            <td className="p-3 space-y-1">
                              {status !== 'Paid' && (
                                <button onClick={() => openPayModal(o)} className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg text-[10px] cursor-pointer">Record Payment</button>
                              )}
                              {paid > 0 && (
                                <button onClick={() => handleResetOrderPayments(o)} className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-2.5 py-1 rounded-lg text-[10px] cursor-pointer">Reset to Unpaid</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="bg-white rounded-3xl p-6 border shadow-sm overflow-x-auto">
                  <h3 className="text-lg font-extrabold text-slate-900 mb-4 pb-2 border-b flex items-center">
                    <FileText className="w-5 h-5 text-amber-500 mr-2" /> Payment Ledger (every payment received)
                  </h3>
                  {payments.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 font-medium">No payments recorded yet.</div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-amber-400 uppercase font-bold">
                        <tr>
                          <th className="p-3">Received On</th>
                          <th className="p-3">Invoice</th>
                          <th className="p-3">Customer</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Account</th>
                          <th className="p-3">Reference / Note</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {payments.map(pm => {
                          const od = orderById(pm.order_id);
                          return (
                            <tr key={pm.id}>
                              <td className="p-3 whitespace-nowrap">{fmtDateTime(pm.received_at)}</td>
                              <td className="p-3 font-black">{od?.invoice_no || '-'}</td>
                              <td className="p-3">{od?.customer_name || '-'}</td>
                              <td className="p-3 font-bold">{pm.category}</td>
                              <td className="p-3">{pm.account_label || pm.method}</td>
                              <td className="p-3 text-slate-500">{pm.reference || ''}{pm.reference && pm.note ? ' | ' : ''}{pm.note || ''}{!pm.reference && !pm.note ? '-' : ''}</td>
                              <td className="p-3 font-black text-emerald-700">PKR {pm.amount}</td>
                              <td className="p-3">
                                <button onClick={() => handleDeletePaymentEntry(pm)} className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg cursor-pointer" title="Delete payment entry">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}

          {/* TAB 9: CUSTOMERS */}
          {adminTab === 'customers' && (
            <div className="space-y-6">
              <form onSubmit={handleSendCampaign} className="bg-white rounded-3xl p-6 border shadow-sm space-y-3">
                <h3 className="text-lg font-extrabold text-slate-900 pb-2 border-b flex items-center">
                  <Mail className="w-5 h-5 text-amber-500 mr-2" /> Send a deal / announcement email
                </h3>
                <p className="text-xs text-slate-500">
                  Goes to all customers who have an email and agreed to receive offers ({customers.filter(c => c.email && c.marketing_opt_in !== false).length} customers).
                </p>
                <input
                  type="text"
                  placeholder="Subject (e.g. 20% off all hair masks this week)"
                  value={campSubject}
                  onChange={(e) => setCampSubject(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                />
                <textarea
                  rows={3}
                  placeholder="Message"
                  value={campMessage}
                  onChange={(e) => setCampMessage(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                />
                <button
                  type="submit"
                  disabled={campBusy}
                  className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-sm px-6 py-2.5 rounded-xl cursor-pointer disabled:opacity-60"
                >
                  {campBusy ? 'Sending...' : 'Send to All Customers'}
                </button>
              </form>

              <div className="grid lg:grid-cols-3 gap-6">
              <form onSubmit={handleSaveCustomer} className="bg-white rounded-3xl p-6 border shadow-sm space-y-3 h-fit">
                <h3 className="text-lg font-extrabold text-slate-900 pb-2 border-b flex items-center">
                  <Users className="w-5 h-5 text-amber-500 mr-2" /> {editingCustomerId ? 'Edit Customer' : 'Add Customer'}
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name *</label>
                  <input type="text" required value={cName} onChange={(e) => setCName(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
                  <input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <GeoFields value={cGeo} onChange={setCGeo} />
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Street Address</label>
                  <input type="text" value={cAddress} onChange={(e) => setCAddress(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={cOptIn} onChange={(e) => setCOptIn(e.target.checked)} />
                  <span>Customer agreed to receive offers by email</span>
                </label>
                <div className="flex space-x-2">
                  <button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-sm py-3 rounded-xl cursor-pointer">
                    {editingCustomerId ? 'Update Customer' : 'Save Customer'}
                  </button>
                  {editingCustomerId && (
                    <button type="button" onClick={resetCustomerForm} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer">Cancel</button>
                  )}
                </div>
              </form>

              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border shadow-sm overflow-x-auto">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4 pb-2 border-b">
                  <h3 className="text-lg font-extrabold text-slate-900">Customer Details ({customers.length})</h3>
                  <input
                    type="text"
                    placeholder="Search name, phone, email, city"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="px-3 py-2 border rounded-full text-xs w-64"
                  />
                </div>
                {customers.length > 0 && (
                  <>
                    {cityBar(countBy(customers.map(cityOfCustomer)), customers.length, custCity, setCustCity)}
                    <div className="flex items-center gap-2 mb-3 text-xs text-slate-600">
                      Sort by
                      <select value={custSort} onChange={(e) => setCustSort(e.target.value as any)} className="border rounded-lg px-2 py-1.5 bg-white">
                        <option value="new">Newest first</option>
                        <option value="name">Name (A-Z)</option>
                        <option value="city">City (A-Z)</option>
                        <option value="spent">Total spent (high to low)</option>
                      </select>
                    </div>
                  </>
                )}
                {(() => {
                  const q = customerSearch.trim().toLowerCase();
                  const spentOf = (c: Customer) => {
                    const full = `${c.phone_code || ''}${c.phone || ''}`;
                    return adminOrders
                      .filter(o => o.status !== 'Cancelled' && (o.customer_id === c.id || (c.phone && last10(o.customer_phone) === last10(full))))
                      .reduce((a, o) => a + Number(o.total_amount || 0), 0);
                  };
                  const list = customers
                    .filter(c => !q || [c.name, c.email, c.phone, c.phone_code, c.city, c.area, c.province, c.country].join(' ').toLowerCase().includes(q))
                    .filter(c => custCity === 'All' || cityOfCustomer(c) === custCity)
                    .slice()
                    .sort((a, b) => {
                      if (custSort === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
                      if (custSort === 'city') return cityOfCustomer(a).localeCompare(cityOfCustomer(b)) || String(a.name || '').localeCompare(String(b.name || ''));
                      if (custSort === 'spent') return spentOf(b) - spentOf(a);
                      return String(b.created_at).localeCompare(String(a.created_at));
                    });
                  if (list.length === 0) return <div className="text-center py-10 text-slate-400 font-medium">No customers found.</div>;
                  return (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-amber-400 uppercase font-bold">
                        <tr>
                          <th className="p-3">Name</th>
                          <th className="p-3">Contact</th>
                          <th className="p-3">Location</th>
                          <th className="p-3">Orders</th>
                          <th className="p-3">Total Spent</th>
                          <th className="p-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {list.map(c => {
                          const full = `${c.phone_code || ''}${c.phone || ''}`;
                          const mine = adminOrders.filter(o =>
                            o.status !== 'Cancelled' && (o.customer_id === c.id || (c.phone && last10(o.customer_phone) === last10(full)))
                          );
                          const spent = mine.reduce((a, o) => a + Number(o.total_amount || 0), 0);
                          return (
                            <tr key={c.id} className="hover:bg-slate-50">
                              <td className="p-3 font-bold">{c.name}<div className="text-[10px] font-normal text-slate-400">Since {fmtDateTime(c.created_at)}</div></td>
                              <td className="p-3">
                                <div>{full || '-'}</div>
                                <div className="text-slate-500">{c.email || ''}</div>
                                {full && (
                                  <a href={waLink(full, `Hello ${c.name},`)} target="_blank" rel="noreferrer" className="text-emerald-700 font-bold underline">WhatsApp</a>
                                )}
                              </td>
                              <td className="p-3 text-slate-600">{[c.area, c.city, c.province].filter(Boolean).join(', ') || '-'}<div className="text-slate-400">{c.address}</div></td>
                              <td className="p-3 font-bold">{mine.length}</td>
                              <td className="p-3 font-bold text-emerald-700">PKR {spent}</td>
                              <td className="p-3 space-x-1 whitespace-nowrap">
                                <button onClick={() => handleEditCustomer(c)} className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-2 rounded-lg cursor-pointer" title="Edit customer"><Edit className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleDeleteCustomer(c)} className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg cursor-pointer" title="Delete customer"><Trash2 className="w-3.5 h-3.5" /></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
              </div>
            </div>
          )}

          {/* TAB 10: HOME SLIDES */}
          {adminTab === 'slides' && (
            <div className="grid lg:grid-cols-3 gap-6">
              <form onSubmit={handleSaveSlide} className="bg-white rounded-3xl p-6 border shadow-sm space-y-3 h-fit">
                <h3 className="text-lg font-extrabold text-slate-900 pb-2 border-b flex items-center">
                  <ImageIcon className="w-5 h-5 text-amber-500 mr-2" /> {editingSlideId ? 'Edit Slide' : 'Add Slide'}
                </h3>
                {!editingSlideId && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                    <p className="text-xs font-bold text-slate-800">Quick: add many banner pictures at once</p>
                    <p className="text-[11px] text-slate-600">Select 5-6 pictures together. Each picture becomes one slide and the banner changes every 5 seconds. Best size: wide pictures, about 1600 x 600.</p>
                    <label className="inline-block bg-slate-900 text-amber-400 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer">
                      Choose pictures
                      <input type="file" accept="image/*" multiple onChange={handleAddManySlides} className="hidden" disabled={!!slideBusy} />
                    </label>
                    {slideBusy && <p className="text-xs font-bold text-amber-700">{slideBusy}</p>}
                  </div>
                )}
                <p className="text-[11px] text-slate-500">Or make one slide yourself. Leave Title and Text empty to show only the picture.</p>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Title (optional)</label>
                  <input type="text" value={slTitle} onChange={(e) => setSlTitle(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Text</label>
                  <textarea rows={2} value={slText} onChange={(e) => setSlText(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Button text (optional)</label>
                  <input type="text" value={slCta} onChange={(e) => setSlCta(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Background color</label>
                  <select value={slBg} onChange={(e) => setSlBg(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm bg-white">
                    <option value="gold">Dark Gold</option>
                    <option value="amber">Amber</option>
                    <option value="green">Dark Green</option>
                    <option value="blue">Dark Blue</option>
                    <option value="rose">Dark Rose</option>
                  </select>
                  <div className={`h-6 rounded-lg mt-2 bg-gradient-to-r ${BG_PRESETS[slBg] || BG_PRESETS.gold}`} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Picture</label>
                  <input type="file" accept="image/*" onChange={handleSlideImage} className="w-full text-xs" />
                  {slImage && (
                    <div className="mt-2">
                      <img src={slImage} alt="Slide preview" className="w-full h-24 object-cover rounded-lg" />
                      <button type="button" onClick={() => setSlImage('')} className="text-[11px] text-red-600 font-bold mt-1 cursor-pointer">Remove image</button>
                    </div>
                  )}
                </div>
                <label className="flex items-center space-x-2 text-sm font-bold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={slActive} onChange={(e) => setSlActive(e.target.checked)} />
                  <span>Show this slide on the home page</span>
                </label>
                <div className="flex space-x-2">
                  <button type="submit" disabled={!!slideBusy} className="flex-1 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-sm py-3 rounded-xl cursor-pointer disabled:opacity-50">
                    {editingSlideId ? 'Update Slide' : 'Save Slide'}
                  </button>
                  {editingSlideId && (
                    <button type="button" onClick={resetSlideForm} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer">Cancel</button>
                  )}
                </div>
              </form>

              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border shadow-sm space-y-3">
                <h3 className="text-lg font-extrabold text-slate-900 pb-2 border-b">Home Page Slides ({slides.length})</h3>
                {slides.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No custom slides yet, so the store is showing the 3 default slides. Add your first slide here and the defaults will be replaced.
                  </p>
                )}
                {slides.map((sl, idx) => (
                  <div key={sl.id} className="flex items-center gap-3 border rounded-2xl p-3">
                    <div
                      className={`w-28 h-16 rounded-lg shrink-0 bg-gradient-to-r ${BG_PRESETS[sl.bg] || BG_PRESETS.gold}`}
                      style={sl.image_url ? { backgroundImage: `url("${sl.image_url}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{sl.title || 'Picture only'}</p>
                      <p className="text-xs text-slate-500 truncate">{sl.text}</p>
                      <p className={`text-[10px] font-black mt-0.5 ${sl.active !== false ? 'text-emerald-700' : 'text-slate-400'}`}>{sl.active !== false ? 'VISIBLE' : 'HIDDEN'}</p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button onClick={() => handleMoveSlide(idx, -1)} disabled={idx === 0} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-30 cursor-pointer" title="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleMoveSlide(idx, 1)} disabled={idx === slides.length - 1} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-30 cursor-pointer" title="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleToggleSlide(sl)} className="px-2 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold rounded-lg cursor-pointer">{sl.active !== false ? 'Hide' : 'Show'}</button>
                      <button onClick={() => handleEditSlide(sl)} className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg cursor-pointer" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => sl.id && handleDeleteSlide(sl.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg cursor-pointer" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: REVIEWS */}
          {adminTab === 'reviews' && (
            <div className="bg-white rounded-3xl p-6 border shadow-sm overflow-x-auto">
              <h3 className="text-lg font-extrabold text-slate-900 mb-4 pb-2 border-b flex items-center">
                <Star className="w-5 h-5 text-amber-500 mr-2" /> Customer Ratings & Remarks
              </h3>
              {reviews.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-medium">No reviews yet.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-amber-400 uppercase font-bold">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">Rating</th>
                      <th className="p-3">Remarks</th>
                      <th className="p-3">Date</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reviews.map(r => (
                      <tr key={r.id}>
                        <td className="p-3 font-bold">{products.find(p => p.id === r.product_id)?.name || 'Deleted product'}</td>
                        <td className="p-3">{r.customer_name}</td>
                        <td className="p-3 text-slate-500">{r.customer_email || ''}{r.customer_email && r.customer_phone ? <br /> : null}{r.customer_phone || ''}{!r.customer_email && !r.customer_phone ? '-' : ''}</td>
                        <td className="p-3">{renderStars(r.rating)}</td>
                        <td className="p-3 max-w-xs text-slate-600">{r.remark || '-'}</td>
                        <td className="p-3 whitespace-nowrap text-slate-500">{fmtDateTime(r.created_at)}</td>
                        <td className="p-3">
                          <button onClick={() => handleDeleteReview(r.id)} className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg cursor-pointer" title="Delete review">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 6: ORDER ALERTS */}
          {adminTab === 'notifications' && (
            <div className="bg-white rounded-3xl p-6 border shadow-sm max-w-2xl">
              <h3 className="text-lg font-extrabold text-slate-900 mb-1 pb-2 border-b flex items-center">
                <Settings className="w-5 h-5 text-amber-500 mr-2" /> New Order Alerts
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                While the admin panel is open, a new order shows an on-screen alert, a sound and a browser notification (always ON).
                To also get alerts when the panel is closed, turn on Email / WhatsApp below (setup steps are in the README).
              </p>

              <form onSubmit={saveNotifSettings} className="space-y-5">
                <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
                  <label className="flex items-center space-x-2 text-sm font-bold text-slate-800 cursor-pointer">
                    <input type="checkbox" checked={notif.email_enabled} onChange={(e) => setNotif({ ...notif, email_enabled: e.target.checked })} />
                    <span>Email alert ON</span>
                  </label>
                  <input
                    type="email"
                    placeholder="Email address for alerts"
                    value={notif.email_to}
                    onChange={(e) => setNotif({ ...notif, email_to: e.target.value })}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm"
                  />
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
                  <label className="flex items-center space-x-2 text-sm font-bold text-slate-800 cursor-pointer">
                    <input type="checkbox" checked={notif.whatsapp_enabled} onChange={(e) => setNotif({ ...notif, whatsapp_enabled: e.target.checked })} />
                    <span>WhatsApp alert ON</span>
                  </label>
                  <input
                    type="text"
                    placeholder="WhatsApp number with country code, e.g. 923001234567"
                    value={notif.whatsapp_phone}
                    onChange={(e) => setNotif({ ...notif, whatsapp_phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm"
                  />
                </div>

                <div className="flex space-x-3">
                  <button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-sm py-3 rounded-xl cursor-pointer">
                    Save Alert Settings
                  </button>
                  <button
                    type="button"
                    onClick={sendTestAlert}
                    disabled={notifBusy}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm py-3 rounded-xl cursor-pointer disabled:opacity-60"
                  >
                    {notifBusy ? 'Sending...' : 'Send Test Alert'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 5: BANK ACCOUNTS (WITH CUSTOM BANK ADDITION & DELETE SUPPORTS LIKE UBL, ETC.) */}
          {adminTab === 'accounts' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-3xl p-6 border shadow-sm">
                <h3 className="text-lg font-extrabold text-slate-900 mb-4 pb-2 border-b flex items-center">
                  <Wallet className="w-5 h-5 text-amber-500 mr-2" /> 
                  {editingAccountId ? 'Edit Bank Account' : 'Add New Bank Account (e.g. UBL)'}
                </h3>

                <form onSubmit={handleSaveAccount} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Bank / Account Type Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. UBL Bank, Alfalah, EasyPaisa, JazzCash"
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value)}
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Account Number / IBAN</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PK12-UBL-0000-1234-5678"
                      value={accNumber}
                      onChange={(e) => setAccNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Account Title (Name)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Zorima Professional UBL Account"
                      value={accTitle}
                      onChange={(e) => setAccTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg cursor-pointer"
                  >
                    {editingAccountId ? 'Update Account Details' : 'Save Payment Account'}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-3xl p-6 border shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b">Manage Active Accounts ({paymentAccounts.length})</h3>
                <div className="space-y-3 max-h-[450px] overflow-y-auto">
                  {paymentAccounts.map((acc) => (
                    <div key={acc.id} className="bg-slate-50 p-4 rounded-2xl border flex justify-between items-center">
                      <div>
                        <span className="font-bold text-amber-600 text-xs uppercase">{acc.type}</span>
                        <div className="text-sm font-black text-slate-900">{acc.account_number}</div>
                        <div className="text-xs text-slate-500">{acc.account_title}</div>
                      </div>
                      <div className="flex space-x-2">
                        <button onClick={() => handleEditAccount(acc)} className="bg-amber-100 text-amber-900 p-2 rounded-lg font-bold cursor-pointer" title="Edit Account">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteAccount(acc.id)} className="bg-red-100 text-red-700 p-2 rounded-lg font-bold cursor-pointer" title="Delete Account">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
            </div>
          </div>
        );
      })()}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 text-center border-t border-slate-800 text-sm mt-12">
        &copy; {new Date().getFullYear()} {settings.store_name} - Management System. All Rights Reserved.
      </footer>
    </div>
  );
}
