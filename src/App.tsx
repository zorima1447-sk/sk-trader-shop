import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { GeoFields, GeoValue, emptyGeo, resolveGeo, localNumber } from './GeoFields';
import SettingsPanel from './SettingsPanel';
import { InvoiceDocument, InvoiceItem } from './Invoice';
import { StoreSettings, defaultSettings, fetchStoreSettings, accentCss } from './storeSettings';
import { 
  ShoppingCart, Package, CheckCircle2, Phone, MapPin, User, Trash2, Edit, Building, 
  Hash, CreditCard, Plus, Settings, Lock, Upload, Tag, ListFilter, DollarSign, 
  FileText, Users, Eye, LogOut, LayoutDashboard, Search, Image as ImageIcon,
  UserPlus, Shield, Wallet, Save, RefreshCw, X,
  Heart, ChevronLeft, ChevronRight, Truck, ShieldCheck, BadgeCheck, MessageCircle, Star, Minus, ArrowUp, ArrowDown, Printer, Mail
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
}

interface CartItem extends Product {
  quantity: number;
}

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
  delivered_at?: string | null;
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
const BUILD = 'v6 (18-Oct-2026)';

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

export default function App() {
  const [currentView, setCurrentView] = useState<'store' | 'login' | 'admin'>('store');
  
  // Store States
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [quickView, setQuickView] = useState<Product | null>(null);
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
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
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
  const [slides, setSlides] = useState<Slide[]>([]);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [slTitle, setSlTitle] = useState('');
  const [slText, setSlText] = useState('');
  const [slCta, setSlCta] = useState('Shop Now');
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
  const [adminTab, setAdminTab] = useState<'products' | 'categories' | 'orders' | 'users' | 'accounts' | 'notifications' | 'payments' | 'reviews' | 'customers' | 'slides' | 'settings'>('products');

  // Product Form State (Add / Edit)
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [discountedPrice, setDiscountedPrice] = useState('');
  const [productStock, setProductStock] = useState('');
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
    fetchProducts();
    fetchCategories();
    fetchPaymentAccounts();
    fetchReviews();
    fetchSlides();
    fetchStoreSettings(supabase).then(setSettings);
  }, []);

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
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
    if (error) { reportError('profiles fetch', error); return; }
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
    const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
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
    const { data, error } = await supabase
      .from('reviews')
      .insert([{
        product_id,
        order_id,
        customer_name,
        rating,
        remark: remark.trim(),
        customer_email: email.trim() || null,
        customer_phone: phone.trim() || null
      }])
      .select();
    if (reportError('review insert', error)) return false;
    if (data && data[0]) setReviews(prev => [data[0], ...prev]);
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
    setSlTitle(''); setSlText(''); setSlCta('Shop Now'); setSlBg('gold'); setSlImage(''); setSlActive(true);
  };

  const handleSlideImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setSlImage(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slTitle.trim()) { alert('Slide title is required.'); return; }
    const row = { title: slTitle.trim(), text: slText.trim(), cta: slCta.trim() || 'Shop Now', bg: slBg, image_url: slImage || null, active: slActive };
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
    setSlTitle(sl.title); setSlText(sl.text || ''); setSlCta(sl.cta || 'Shop Now');
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

  const adminCreds = () => ({ admin_username: adminUsername.trim(), admin_password: adminPassword });

  const callCustomersFunction = async (payload: any): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('notify-customers', {
      body: { ...payload, ...adminCreds(), site_url: window.location.origin }
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
      body: { order_id: o.id, resend_invoice: true, site_url: window.location.origin, ...adminCreds() }
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
    const { data, error } = await supabase.functions.invoke('notify-order', { body: { test: true, ...adminCreds() } });
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

  // Live alert for new orders while the admin is logged in (Supabase Realtime)
  useEffect(() => {
    if (!isAdminLoggedIn) return;
    const channel = supabase
      .channel('orders-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: any) => {
        const o = payload.new || {};
        setNewOrderCount(c => c + 1);
        setToastMessage(`NEW ORDER ${o.invoice_no || ''} - ${o.customer_name || ''} - PKR ${o.total_amount || ''}`);
        setTimeout(() => setToastMessage(null), 9000);
        beep();
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Order Received', { body: `${o.customer_name || ''} - PKR ${o.total_amount || ''}` });
          }
        } catch (e) { /* ignore */ }
        // order items are saved a moment after the order, so refresh the list after a short delay
        setTimeout(fetchOrders, 2500);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdminLoggedIn]);

  const handleUpdateOrderStatus = async (id: string, status: string) => {
    const delivered_at = status === 'Delivered' ? new Date().toISOString() : null;
    const { error } = await supabase.from('orders').update({ status, delivered_at }).eq('id', id);
    if (reportError('order status update', error)) return;
    setAdminOrders(prev => prev.map(o => o.id === id ? { ...o, status, delivered_at } : o));
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
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', adminUsername.trim().replace(/[%_\\]/g, '\\$&'))
      .eq('password', adminPassword)
      .limit(1);
    if (error) { reportError('login', error); return; }
    const user = data && data[0];
    if (!user) {
      alert('Invalid User ID or Password!');
      return;
    }
    setIsAdminLoggedIn(true);
    setLoggedInUserRole(user.role);
    setLoggedInUserName(user.username);
    setCurrentView('admin');
    setNewOrderCount(0);
    fetchOrders();
    fetchUsers();
    fetchNotifSettings();
    fetchCustomers();
    fetchPayments();
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
    if (!productName || !discountedPrice) {
      alert('Product Name and Discounted Price are required!');
      return;
    }

    setIsUploading(true);
    let finalImageUrl = imageUrl || imagePreview || 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=500&auto=format&fit=crop&q=60';

    const prodData = {
      name: productName,
      description: productDesc,
      original_price: parseFloat(originalPrice) || parseFloat(discountedPrice),
      discounted_price: parseFloat(discountedPrice),
      price: parseFloat(discountedPrice),
      category_name: productCategory || 'Hair Care',
      image_url: finalImageUrl,
      stock_quantity: parseInt(productStock) || 0
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
    if (!uname || !newUserPassword) { alert('Please enter both User ID and Password.'); return; }

    // duplicate check (from the database)
    const { data: same, error: sameErr } = await supabase
      .from('profiles').select('id').ilike('username', uname.replace(/[%_\\]/g, '\\$&'));
    if (reportError('user check', sameErr)) return;
    if ((same || []).some((r: any) => r.id !== editingUserId)) {
      alert('This User ID already exists. Please choose another one.');
      return;
    }

    const row = { username: uname, password: newUserPassword, role: newUserRole };

    if (editingUserId) {
      const { error } = await supabase.from('profiles').update(row).eq('id', editingUserId);
      if (reportError('user update', error)) return;
      alert('Admin user updated and saved in database!');
    } else {
      const { error } = await supabase.from('profiles').insert([row]);
      if (reportError('user insert', error)) return;
      alert(`New admin user (${uname}) saved in database!\nYou can now log in with this User ID and password.`);
    }
    setEditingUserId(null);
    setNewUsername('');
    setNewUserPassword('');
    await fetchUsers(); // reload the list from the database
  };

  const handleEditUser = (u: AdminUser) => {
    setEditingUserId(u.id);
    setNewUsername(u.username);
    setNewUserPassword(u.password || '');
    setNewUserRole(u.role);
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('Delete this admin user?')) {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (reportError('user delete', error)) return;
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

  const addToCart = (product: Product, qty = 1) => {
    const inCart = cart.find(i => i.id === product.id)?.quantity || 0;
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
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + qty } : item
        );
      }
      return [...prevCart, { ...product, quantity: qty }];
    });

    setToastMessage(`${qty} x ${product.name} added to cart!`);
    setTimeout(() => setToastMessage(null), 2500);
    return true;
  };

  const changeCartQty = (id: string, delta: number) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    const next = item.quantity + delta;
    if (next <= 0) { removeFromCart(id); return; }
    if (typeof item.stock_quantity === 'number' && next > item.stock_quantity) {
      setToastMessage(`Only ${item.stock_quantity} in stock.`);
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: next } : i));
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.discounted_price || item.price) * item.quantity, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !localNumber(geo.phoneNumber) || !shippingAddress.trim() || !geo.countryIso || !geo.city) {
      alert('Please fill in all required customer details (name, country, city, mobile number and address).');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(customerEmail.trim())) {
      alert('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      const info = await resolveGeo(geo);
      const local = localNumber(geo.phoneNumber);
      const fullPhone = `${info.phoneCode}${local}`;
      const fullAddress = [shippingAddress.trim(), geo.city, info.stateName, info.countryName, zipCode ? `Zip: ${zipCode}` : '']
        .filter(Boolean).join(', ');

      // Save / update the customer record (does not block the order if it fails)
      let customerId: string | null = null;
      try {
        const crow = {
          name: customerName.trim(),
          email: customerEmail.trim() || null,
          phone_iso: geo.phoneIso,
          phone_code: info.phoneCode,
          phone: local,
          country_iso: geo.countryIso,
          country: info.countryName,
          province_iso: geo.stateIso,
          province: info.stateName,
          city: geo.city,
          address: shippingAddress.trim(),
          marketing_opt_in: marketingOptIn
        };
        const { data: found } = await supabase
          .from('customers').select('id').eq('phone_code', info.phoneCode).eq('phone', local).limit(1);
        if (found && found[0]) {
          customerId = found[0].id;
          await supabase.from('customers').update(crow).eq('id', found[0].id);
        } else {
          const { data: ins, error: insErr } = await supabase.from('customers').insert([crow]).select();
          if (insErr) console.warn('customer insert', insErr.message);
          customerId = ins && ins[0] ? ins[0].id : null;
        }
      } catch (err) {
        console.warn('customer save failed', err);
      }

      const { data: orderData, error: orderError } = await supabase.from('orders').insert([
        {
          customer_name: customerName.trim(),
          customer_phone: fullPhone,
          customer_email: customerEmail.trim() || null,
          customer_id: customerId,
          shipping_address: fullAddress,
          total_amount: totalAmount,
          payment_method: paymentMethod,
          payment_status: 'Unpaid',
          paid_amount: 0,
          transaction_id: paymentMethod === 'cod' ? null : (transactionId || null),
          status: 'Pending'
        }
      ]).select();

      if (orderError || !orderData || !orderData[0]) {
        reportError('order insert', orderError || { message: 'Order was not saved.' });
        return;
      }

      const order = orderData[0];

      const { error: itemsError } = await supabase.from('order_items').insert(
        cart.map(item => ({
          order_id: order.id,
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.discounted_price || item.price
        }))
      );
      if (itemsError) {
        reportError('order items insert', itemsError);
        return;
      }

      // Decrease stock and increase sold count
      for (const item of cart) {
        const { error: stockErr } = await supabase.rpc('decrement_stock', { p_id: item.id, p_qty: item.quantity });
        if (stockErr) { console.error('decrement_stock', stockErr); setDbError(`stock update: ${stockErr.message}`); }
      }
      fetchProducts();

      // Invoice for the customer + order alert to the owner (Edge Function).
      // A failure here does not affect the order.
      setPlacedInvoice({
        order: { ...order },
        items: cart.map(i => ({ product_name: i.name, quantity: i.quantity, unit_price: i.discounted_price || i.price }))
      });
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
      setCart([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = selectedCategory === 'All' 
    ? products 
    : products.filter(p => p.category_name === selectedCategory);

  const displaySlides: Slide[] = slides.filter(x => x.active !== false).length > 0
    ? slides.filter(x => x.active !== false)
    : HERO_SLIDES;
  const hi = displaySlides.length ? heroIndex % displaySlides.length : 0;

  const visibleProducts = filteredProducts.filter(p =>
    !searchQuery.trim() || (p.name + ' ' + (p.description || '')).toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const toggleWishlist = (id: string) =>
    setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const scrollToProducts = () =>
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });

  const discountPct = (p: Product) => {
    const now = p.discounted_price || p.price;
    return p.original_price > now ? Math.round((1 - now / p.original_price) * 100) : 0;
  };

  const activePaymentAccount = paymentAccounts.find(a => a.type.toLowerCase().includes(paymentMethod.toLowerCase())) || paymentAccounts[0];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
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

      {currentView === 'store' && settings.show_announcement && settings.announcement && (
        <div className="bg-slate-950 text-amber-300 text-[11px] md:text-xs font-bold text-center py-2 px-3 tracking-wide">
          {settings.announcement}
        </div>
      )}

      {/* Main Top Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex justify-between items-center">
          <div 
            onClick={() => setCurrentView('store')}
            className="flex items-center space-x-3 cursor-pointer"
          >
            {settings.logo_url ? (
              <img src={settings.logo_url} alt={settings.store_name} className="h-10 w-10 object-contain rounded" />
            ) : (
              <Package className="w-8 h-8 text-amber-400" />
            )}
            <div>
              <span className="text-xl md:text-2xl font-black tracking-wider text-white block">{settings.store_name}</span>
              {settings.header_subtitle && (
                <span className="text-xs text-amber-300 font-medium tracking-widest block -mt-1">{settings.header_subtitle}</span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isAdminLoggedIn ? (
              <button
                onClick={() => setCurrentView(currentView === 'admin' ? 'store' : 'admin')}
                className="bg-amber-500 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center shadow"
              >
                <LayoutDashboard className="w-4 h-4 mr-1.5" /> 
                {currentView === 'admin' ? 'Back to Store' : 'Admin Portal'}
              </button>
            ) : (
              <button
                onClick={() => setCurrentView('login')}
                className="text-slate-300 hover:text-white bg-slate-800 px-3.5 py-2 rounded-xl text-xs flex items-center transition border border-slate-700"
              >
                <Lock className="w-3.5 h-3.5 mr-1.5 text-amber-400" /> Admin Login
              </button>
            )}

            {currentView === 'store' && (
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative flex items-center bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl transition shadow-lg cursor-pointer"
              >
                <ShoppingCart className="w-5 h-5 mr-1.5" />
                <span className="text-sm">Cart</span>
                {cart.length > 0 && (
                  <span className="ml-2 bg-slate-950 text-amber-400 text-xs font-black px-2 py-0.5 rounded-full border border-amber-400">
                    {cart.reduce((a, b) => a + b.quantity, 0)}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* VIEW 1: CUSTOMER STORE VIEW */}
      {currentView === 'store' && (
        <div>
          {/* Category nav + search */}
          <nav className="bg-white border-b sticky top-[68px] z-30">
            <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center space-x-1 overflow-x-auto">
                <button
                  onClick={() => { setSelectedCategory('All'); scrollToProducts(); }}
                  className={`px-3.5 py-2 text-xs font-bold whitespace-nowrap rounded-lg cursor-pointer ${selectedCategory === 'All' ? 'text-amber-600' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Best Sellers
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(cat.name); scrollToProducts(); }}
                    className={`px-3.5 py-2 text-xs font-bold whitespace-nowrap rounded-lg cursor-pointer ${selectedCategory === cat.name ? 'text-amber-600' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="relative hidden sm:block">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search our store"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-2 border rounded-full text-xs w-56 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </nav>

          {/* Hero slider */}
          <section className="relative overflow-hidden">
            <div className="flex transition-transform duration-700" style={{ transform: `translateX(-${hi * 100}%)` }}>
              {displaySlides.map((sl, i) => (
                <div
                  key={sl.id || i}
                  className={`min-w-full h-64 md:h-96 bg-gradient-to-r ${BG_PRESETS[sl.bg] || BG_PRESETS.gold} flex items-center justify-center text-center px-6 relative`}
                  style={sl.image_url ? { backgroundImage: `url(${sl.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                >
                  {sl.image_url && <div className="absolute inset-0 bg-black/45" />}
                  <div className="max-w-2xl relative">
                    <p className="text-amber-400 text-xs font-bold tracking-[0.3em] mb-3">{settings.store_name}</p>
                    <h2 className="text-3xl md:text-6xl font-black text-white mb-3">{sl.title}</h2>
                    <p className="text-slate-200 text-sm md:text-lg mb-6">{sl.text}</p>
                    <button
                      onClick={scrollToProducts}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm px-8 py-3 rounded-full transition cursor-pointer"
                    >
                      {sl.cta}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setHeroIndex(i => (i % displaySlides.length - 1 + displaySlides.length) % displaySlides.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full cursor-pointer"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setHeroIndex(i => i + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full cursor-pointer"
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2">
              {displaySlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${i === hi ? 'w-6 bg-amber-400' : 'w-2 bg-white/50'}`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </section>

          {/* Scrolling strip */}
          <div className="bg-amber-500 text-slate-950 overflow-hidden whitespace-nowrap py-2.5">
            <div className="marquee-track inline-block font-black text-xs md:text-sm tracking-widest uppercase">
              {[0, 1, 2, 3].map(k => (
                <span key={k} className="mx-6">Summer Sale Is Live Now &nbsp;&#10022;&nbsp; Trusted by Professionals &nbsp;&#10022;&nbsp; 100% Original Products &nbsp;&#10022;&nbsp; Cash on Delivery &nbsp;&#10022;</span>
              ))}
            </div>
          </div>

          {/* Products */}
          <main id="products" className="max-w-7xl mx-auto px-4 py-10 scroll-mt-32">
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900">
                {selectedCategory === 'All' ? 'Best Sellers' : selectedCategory}
              </h2>
              <div className="w-16 h-1 bg-amber-500 mx-auto mt-2 rounded-full" />
            </div>

            <div className="flex items-center justify-center flex-wrap gap-2 mb-6">
              <button
                onClick={() => setSelectedCategory('All')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${selectedCategory === 'All' ? 'bg-slate-900 text-amber-400' : 'bg-white text-slate-600 border'}`}
              >
                All Products
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${selectedCategory === cat.name ? 'bg-slate-900 text-amber-400' : 'bg-white text-slate-600 border'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="sm:hidden mb-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search our store"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border rounded-full text-sm bg-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {visibleProducts.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-medium">No products found.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                {visibleProducts.map((product) => {
                  const soldOut = product.stock_quantity <= 0;
                  const pct = discountPct(product);
                  return (
                    <div key={product.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group">
                      <div className="overflow-hidden bg-slate-100 aspect-square relative">
                        <img
                          src={product.image_url || 'https://via.placeholder.com/300'}
                          alt={product.name}
                          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${soldOut ? 'opacity-50' : ''}`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=No+Image';
                          }}
                        />
                        {pct > 0 && !soldOut && (
                          <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-full">-{pct}%</span>
                        )}
                        {soldOut && (
                          <span className="absolute top-2 left-2 bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded-full">Sold Out</span>
                        )}
                        <button
                          onClick={() => toggleWishlist(product.id)}
                          className="absolute top-2 right-2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow cursor-pointer"
                          aria-label="Add to wishlist"
                        >
                          <Heart className={`w-4 h-4 ${wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : 'text-slate-500'}`} />
                        </button>
                        <button
                          onClick={() => { setQuickView(product); setQvQty(1); }}
                          className="absolute bottom-0 left-0 right-0 bg-slate-900/90 text-white text-xs font-bold py-2 flex items-center justify-center md:translate-y-full md:group-hover:translate-y-0 transition-transform cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" /> Quick view
                        </button>
                      </div>

                      <div className="p-3 md:p-4 flex-1 flex flex-col">
                        <h3 className="font-bold text-xs md:text-sm text-slate-800 mb-1.5 line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
                        <div className="flex items-baseline flex-wrap gap-x-2 mb-2">
                          <span className="text-sm md:text-base font-black text-slate-900">PKR {product.discounted_price || product.price}</span>
                          {pct > 0 && (
                            <span className="text-[11px] text-slate-400 line-through">PKR {product.original_price}</span>
                          )}
                        </div>
                        {(() => {
                          const r = ratingOf(product.id);
                          return (
                            <div className="flex items-center space-x-1 mb-1.5">
                              {renderStars(r.avg)}
                              <span className="text-[11px] text-slate-500">{r.count > 0 ? `${r.avg.toFixed(1)} (${r.count})` : 'No reviews yet'}</span>
                            </div>
                          );
                        })()}
                        <p className="text-[11px] font-semibold mb-2">
                          {soldOut ? (
                            <span className="text-red-600">Out of stock</span>
                          ) : (
                            <span className={product.stock_quantity <= 5 ? 'text-red-600' : 'text-emerald-700'}>
                              In stock: {product.stock_quantity}{product.stock_quantity <= 5 ? ' (almost gone!)' : ''}
                            </span>
                          )}
                          <span className="text-slate-400"> | {product.sold_quantity ?? 0} sold</span>
                        </p>
                        <button
                          onClick={() => addToCart(product)}
                          disabled={soldOut}
                          className="mt-auto w-full bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed font-bold text-xs py-2.5 rounded-lg transition flex items-center justify-center cursor-pointer"
                        >
                          <ShoppingCart className="w-4 h-4 mr-1.5" /> {soldOut ? 'Sold Out' : 'Add to Cart'}
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
          <section className="bg-white border-y">
            <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { icon: <BadgeCheck className="w-8 h-8 text-amber-500" />, t: '100% Original', d: 'Authentic salon-grade products.' },
                { icon: <Truck className="w-8 h-8 text-amber-500" />, t: 'Fast Delivery', d: 'Delivered across Pakistan.' },
                { icon: <ShieldCheck className="w-8 h-8 text-amber-500" />, t: 'Cash on Delivery', d: 'Pay when you receive your order.' },
                { icon: <MessageCircle className="w-8 h-8 text-amber-500" />, t: 'WhatsApp Support', d: 'Ask us anything, anytime.' }
              ].map((b, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="bg-amber-50 p-4 rounded-full mb-3">{b.icon}</div>
                  <h4 className="font-black text-sm text-slate-900">{b.t}</h4>
                  <p className="text-xs text-slate-500 mt-1">{b.d}</p>
                </div>
              ))}
            </div>
          </section>
          )}

          {/* Shop by category */}
          {settings.show_categories && categories.length > 0 && (
            <section className="max-w-7xl mx-auto px-4 py-10">
              <h2 className="text-xl md:text-2xl font-black text-center text-slate-900 mb-6">Shop by Category</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(cat.name); scrollToProducts(); }}
                    className="bg-gradient-to-br from-slate-900 to-slate-800 hover:from-amber-600 hover:to-amber-500 text-white rounded-2xl py-10 px-4 font-black text-sm md:text-base transition cursor-pointer"
                  >
                    {cat.name}
                    <span className="block text-[11px] font-medium text-amber-300 mt-1">
                      {products.filter(p => p.category_name === cat.name).length} products
                    </span>
                  </button>
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

          {/* Quick view modal */}
          {quickView && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setQuickView(null)}>
              <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] grid md:grid-cols-2 overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setQuickView(null)} className="absolute top-3 right-3 bg-white/90 p-1.5 rounded-full shadow z-10 cursor-pointer" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
                <img src={quickView.image_url} alt={quickView.name} className="w-full h-56 md:h-full object-cover bg-slate-100" />
                <div className="p-6 flex flex-col overflow-y-auto max-h-[90vh]">
                  <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">{quickView.category_name}</span>
                  <h3 className="text-xl font-black text-slate-900 mt-1 mb-2">{quickView.name}</h3>
                  <div className="flex items-baseline space-x-2 mb-2">
                    <span className="text-2xl font-black text-slate-900">PKR {quickView.discounted_price || quickView.price}</span>
                    {discountPct(quickView) > 0 && (
                      <>
                        <span className="text-sm text-slate-400 line-through">PKR {quickView.original_price}</span>
                        <span className="text-xs font-black text-red-600">-{discountPct(quickView)}%</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs font-bold mb-3">
                    {quickView.stock_quantity <= 0
                      ? <span className="text-red-600">Out of stock</span>
                      : <span className="text-emerald-700">In stock: {quickView.stock_quantity}</span>}
                    <span className="text-slate-400"> | {quickView.sold_quantity ?? 0} sold</span>
                  </p>

                  {quickView.stock_quantity > 0 ? (
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center border rounded-xl overflow-hidden">
                        <button type="button" onClick={() => setQvQty(q => Math.max(1, q - 1))} className="px-3 py-2 hover:bg-slate-100 cursor-pointer" aria-label="Decrease quantity">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-4 text-sm font-black">{qvQty}</span>
                        <button type="button" onClick={() => setQvQty(q => Math.min(quickView.stock_quantity, q + 1))} className="px-3 py-2 hover:bg-slate-100 cursor-pointer" aria-label="Increase quantity">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => { if (addToCart(quickView, qvQty)) setQuickView(null); }}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm py-3 rounded-xl flex items-center justify-center cursor-pointer"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                      </button>
                    </div>
                  ) : (
                    <button disabled className="mb-4 bg-slate-200 text-slate-500 font-black text-sm py-3 rounded-xl">Sold Out</button>
                  )}

                  <p className="text-sm text-slate-600 mb-3">{quickView.description}</p>

                  <div className="border-t pt-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="text-sm font-black text-slate-900">Customer Reviews</h4>
                      {renderStars(ratingOf(quickView.id).avg)}
                      <span className="text-xs text-slate-500">({ratingOf(quickView.id).count})</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {reviews.filter(r => r.product_id === quickView.id).length === 0 && (
                        <p className="text-xs text-slate-400">No reviews yet. Be the first to review this product!</p>
                      )}
                      {reviews.filter(r => r.product_id === quickView.id).map(r => (
                        <div key={r.id} className="bg-slate-50 rounded-lg p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">{r.customer_name}</span>
                            {renderStars(r.rating, 'w-3 h-3')}
                          </div>
                          {r.remark && <p className="text-slate-600 mt-1">{r.remark}</p>}
                          <p className="text-[10px] text-slate-400 mt-1">{fmtDateTime(r.created_at)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3 space-y-2">
                      <p className="text-xs font-bold text-slate-800">Write a review</p>
                      <input
                        type="text"
                        placeholder="Your name *"
                        value={rvName}
                        onChange={(e) => setRvName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="email"
                          placeholder="Email (optional)"
                          value={rvEmail}
                          onChange={(e) => setRvEmail(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-xs"
                        />
                        <input
                          type="tel"
                          placeholder="Mobile (optional)"
                          value={rvPhone}
                          onChange={(e) => setRvPhone(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-xs"
                        />
                      </div>
                      {starPicker(rvRating, setRvRating)}
                      <textarea
                        rows={2}
                        placeholder="Remarks (optional)"
                        value={rvRemark}
                        onChange={(e) => setRvRemark(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-xs"
                      />
                      <button
                        onClick={() => handleSubmitReview(quickView)}
                        className="w-full bg-slate-900 text-amber-400 font-bold text-xs py-2 rounded-lg cursor-pointer"
                      >
                        Submit Review
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* INVOICE MODAL */}
      {invoiceView && (
        <div className="fixed inset-0 z-[70] bg-black/60 overflow-y-auto p-4" onClick={() => setInvoiceView(null)}>
          <div className="max-w-3xl mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap justify-end gap-2 mb-2 no-print">
              <button onClick={() => window.print()} className="bg-slate-900 text-amber-400 font-bold text-xs px-4 py-2 rounded-xl flex items-center cursor-pointer">
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
                <div className="flex-1 overflow-y-auto py-4 space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                        <div className="flex items-center space-x-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => changeCartQty(item.id, -1)}
                            className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => changeCartQty(item.id, 1)}
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
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-500 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="pt-3 flex justify-between text-xl font-black text-slate-900 border-t">
                    <span>Total Amount:</span>
                    <span className="text-amber-600">PKR {totalAmount}</span>
                  </div>
                </div>

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

                  <GeoFields value={geo} onChange={setGeo} />

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Delivery Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="Shop / house address"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ZIP / Postal Code (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 54000"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <label className="flex items-start space-x-2 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} className="mt-0.5" />
                    <span>Email me about new products and deals (you can unsubscribe any time).</span>
                  </label>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2">Select Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cod')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer ${
                          paymentMethod === 'cod' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        <Building className="w-4 h-4 mb-1" /> Cash on Delivery
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('easypaisa')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer ${
                          paymentMethod === 'easypaisa' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        <Hash className="w-4 h-4 mb-1" /> EasyPaisa
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('ubl')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer ${
                          paymentMethod === 'ubl' ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 mb-1" /> Bank / UBL
                      </button>
                    </div>
                  </div>

                  {paymentMethod !== 'cod' && (
                    <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs space-y-2">
                      <div className="font-bold text-emerald-900 border-b pb-1">Payment Account Details:</div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Account Number:</span>
                        <span className="font-extrabold text-emerald-800 text-sm">{activePaymentAccount ? activePaymentAccount.account_number : '0300-1234567'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Account Title:</span>
                        <span className="font-bold text-slate-800">{activePaymentAccount ? activePaymentAccount.account_title : 'Zorima Official'}</span>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mt-2 mb-1">Enter Transaction / Reference ID:</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. TR-123456789"
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white"
                        />
                      </div>
                    </div>
                  )}

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

      {/* VIEW 3: FULL ENTERPRISE ADMIN CONTROL DASHBOARD */}
      {currentView === 'admin' && isAdminLoggedIn && (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-amber-400 flex items-center">
                <LayoutDashboard className="w-6 h-6 mr-2" /> {settings.store_name} Admin Control Center
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                User: <span className="text-amber-300 font-bold">{loggedInUserName}</span> | Role: <span className="text-amber-300 font-bold">{loggedInUserRole}</span> | Build: {BUILD}
              </p>
            </div>
            <button
              onClick={() => {
                setIsAdminLoggedIn(false);
                setCurrentView('store');
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-1.5" /> Logout
            </button>
          </div>

          <div className="flex border-b mb-8 space-x-2 overflow-x-auto pb-2">
            <button
              onClick={() => setAdminTab('products')}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition cursor-pointer ${
                adminTab === 'products' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Plus className="w-4 h-4 mr-1.5 text-amber-500" /> Products (Edit/Delete)
            </button>
            <button
              onClick={() => setAdminTab('categories')}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition cursor-pointer ${
                adminTab === 'categories' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Tag className="w-4 h-4 mr-1.5 text-amber-500" /> Categories
            </button>
            <button
              onClick={() => {
                setAdminTab('orders');
                setNewOrderCount(0);
                fetchOrders();
              }}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition cursor-pointer ${
                adminTab === 'orders' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <FileText className="w-4 h-4 mr-1.5 text-amber-500" /> Orders ({adminOrders.length})
              {newOrderCount > 0 && (
                <span className="ml-2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{newOrderCount} new</span>
              )}
            </button>
            <button
              onClick={() => setAdminTab('users')}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition cursor-pointer ${
                adminTab === 'users' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <UserPlus className="w-4 h-4 mr-1.5 text-amber-500" /> Admin Users & Passwords
            </button>
            <button
              onClick={() => setAdminTab('accounts')}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition cursor-pointer ${
                adminTab === 'accounts' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Wallet className="w-4 h-4 mr-1.5 text-amber-500" /> Bank & UBL Accounts (Add/Delete)
            </button>
            <button
              onClick={() => setAdminTab('notifications')}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition cursor-pointer ${
                adminTab === 'notifications' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Settings className="w-4 h-4 mr-1.5 text-amber-500" /> Order Alerts
            </button>
            <button
              onClick={() => { setAdminTab('payments'); fetchOrders(); }}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition cursor-pointer ${
                adminTab === 'payments' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Wallet className="w-4 h-4 mr-1.5 text-amber-500" /> Payments
            </button>
            <button
              onClick={() => { setAdminTab('reviews'); fetchReviews(); }}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition cursor-pointer ${
                adminTab === 'reviews' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Star className="w-4 h-4 mr-1.5 text-amber-500" /> Reviews ({reviews.length})
            </button>
            <button
              onClick={() => { setAdminTab('customers'); fetchCustomers(); }}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition cursor-pointer ${
                adminTab === 'customers' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Users className="w-4 h-4 mr-1.5 text-amber-500" /> Customers ({customers.length})
            </button>
            <button
              onClick={() => { setAdminTab('slides'); fetchSlides(); }}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition cursor-pointer ${
                adminTab === 'slides' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <ImageIcon className="w-4 h-4 mr-1.5 text-amber-500" /> Home Slides
            </button>
            <button
              onClick={() => setAdminTab('settings')}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition cursor-pointer ${
                adminTab === 'settings' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Settings className="w-4 h-4 mr-1.5 text-amber-500" /> Settings
            </button>
          </div>

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
                        required
                        placeholder="1850"
                        value={discountedPrice}
                        onChange={(e) => setDiscountedPrice(e.target.value)}
                        className="w-full px-3.5 py-2 border rounded-xl text-sm font-bold text-emerald-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Stock Quantity (items available) *</label>
                    <input
                      type="number"
                      min="0"
                      required
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
                    {adminOrders.map((order) => (
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
                        <td className="p-3.5 text-slate-600 max-w-xs">{order.shipping_address}</td>
                        <td className="p-3.5 text-slate-700">
                          {(order.order_items || []).map((it, i) => (
                            <div key={it.id || i}>{it.quantity} x {it.product_name}</div>
                          ))}
                        </td>
                        <td className="p-3.5 font-black text-emerald-700">PKR {order.total_amount}</td>
                        <td className="p-3.5 font-semibold text-slate-700 uppercase">{order.payment_method || 'COD'}</td>
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">Password *</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter New Password"
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
                {(() => {
                  const q = customerSearch.trim().toLowerCase();
                  const list = customers.filter(c =>
                    !q || [c.name, c.email, c.phone, c.phone_code, c.city, c.province, c.country].join(' ').toLowerCase().includes(q)
                  );
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
                              <td className="p-3 text-slate-600">{[c.city, c.province, c.country].filter(Boolean).join(', ') || '-'}<div className="text-slate-400">{c.address}</div></td>
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
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Title *</label>
                  <input type="text" required value={slTitle} onChange={(e) => setSlTitle(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Text</label>
                  <textarea rows={2} value={slText} onChange={(e) => setSlText(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Button text</label>
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Background image (optional)</label>
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
                  <button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-sm py-3 rounded-xl cursor-pointer">
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
                      style={sl.image_url ? { backgroundImage: `url(${sl.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{sl.title}</p>
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
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 text-center border-t border-slate-800 text-sm mt-12">
        &copy; {new Date().getFullYear()} {settings.store_name} - Management System. All Rights Reserved.
      </footer>
    </div>
  );
}
