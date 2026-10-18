import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { 
  ShoppingCart, Package, CheckCircle2, Phone, MapPin, User, Trash2, Edit, Building, 
  Hash, CreditCard, Plus, Settings, Lock, Upload, Tag, ListFilter, DollarSign, 
  FileText, Users, Eye, LogOut, LayoutDashboard, Search, Image as ImageIcon,
  UserPlus, Shield, Wallet, Save, RefreshCw, X
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
  created_at: string;
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

export default function App() {
  const [currentView, setCurrentView] = useState<'store' | 'login' | 'admin'>('store');
  
  // Store States
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Admin Portal States
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [loggedInUserRole, setLoggedInUserRole] = useState('Super Admin');
  const [adminTab, setAdminTab] = useState<'products' | 'categories' | 'orders' | 'users' | 'accounts'>('products');

  // Product Form State (Add / Edit)
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [discountedPrice, setDiscountedPrice] = useState('');
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
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
    if (error) { reportError('orders fetch', error); return; }
    setAdminOrders(data || []);
  }

  const handleUpdateOrderStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (reportError('order status update', error)) return;
    setAdminOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', adminUsername.trim())
      .eq('password', adminPassword)
      .maybeSingle();
    if (error) { reportError('login', error); return; }
    if (!data) {
      alert('Invalid User ID or Password!');
      return;
    }
    setIsAdminLoggedIn(true);
    setLoggedInUserRole(data.role);
    setCurrentView('admin');
    fetchOrders();
    fetchUsers();
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
      stock_quantity: 50
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
      alert('New product saved to database!');
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
    if (!newUsername.trim() || !newUserPassword) return;

    const row = { username: newUsername.trim(), password: newUserPassword, role: newUserRole };

    if (editingUserId) {
      const { data, error } = await supabase.from('profiles').update(row).eq('id', editingUserId).select();
      if (reportError('user update', error)) return;
      setAdminUsers(prev => prev.map(u => u.id === editingUserId ? (data && data[0] ? data[0] : { ...u, ...row }) : u));
      alert('Admin user updated successfully!');
    } else {
      const { data, error } = await supabase.from('profiles').insert([row]).select();
      if (reportError('user insert', error)) return;
      if (data && data[0]) setAdminUsers(prev => [...prev, data[0]]);
      alert(`New admin user (${row.username}) created successfully!`);
    }
    setEditingUserId(null);
    setNewUsername('');
    setNewUserPassword('');
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

  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });

    setToastMessage(`${product.name} added to cart successfully!`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.discounted_price || item.price) * item.quantity, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !shippingAddress || !city) {
      alert('Please fill in all required customer details.');
      return;
    }

    setIsSubmitting(true);
    const fullAddress = `${shippingAddress}, City: ${city}, Zip: ${zipCode}`;

    try {
      const { data: orderData, error: orderError } = await supabase.from('orders').insert([
        {
          customer_name: customerName,
          customer_phone: customerPhone,
          shipping_address: fullAddress,
          total_amount: totalAmount,
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'cod' ? 'Pending COD' : 'Paid Online',
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

  const activePaymentAccount = paymentAccounts.find(a => a.type.toLowerCase().includes(paymentMethod.toLowerCase())) || paymentAccounts[0];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
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

      {/* Main Top Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex justify-between items-center">
          <div 
            onClick={() => setCurrentView('store')}
            className="flex items-center space-x-3 cursor-pointer"
          >
            <Package className="w-8 h-8 text-amber-400" />
            <div>
              <span className="text-xl md:text-2xl font-black tracking-wider text-white block">ZORIMA PROFESSIONAL</span>
              <span className="text-xs text-amber-300 font-medium tracking-widest block -mt-1">PREMIUM BEAUTY & CARE</span>
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
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 text-white py-12 px-4 text-center border-b border-amber-500/20">
            <h1 className="text-3xl md:text-5xl font-black mb-2 text-amber-400">ZORIMA PROFESSIONAL STORE</h1>
            <p className="text-slate-300 text-sm md:text-base max-w-2xl mx-auto">Original Hair Care, Baobab Oils & Skin Bleach Masks at Discounted Prices.</p>
          </div>

          <main className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center space-x-2 overflow-x-auto pb-4 mb-6 border-b">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 flex items-center">
                <ListFilter className="w-4 h-4 mr-1" /> Category:
              </span>
              <button
                onClick={() => setSelectedCategory('All')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedCategory === 'All' ? 'bg-slate-900 text-amber-400 shadow-md' : 'bg-white text-slate-600 border'
                }`}
              >
                All Products
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    selectedCategory === cat.name ? 'bg-slate-900 text-amber-400 shadow-md' : 'bg-white text-slate-600 border'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group">
                  <div className="overflow-hidden bg-slate-100 h-52 relative flex items-center justify-center">
                    <img
                      src={product.image_url || 'https://via.placeholder.com/300'}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=500&auto=format&fit=crop&q=60';
                      }}
                    />
                    {product.original_price > (product.discounted_price || product.price) && (
                      <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase shadow">
                        SAVE PKR {product.original_price - (product.discounted_price || product.price)}
                      </span>
                    )}
                    <span className="absolute top-3 right-3 bg-slate-900/80 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {product.category_name || 'Hair Care'}
                    </span>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-base text-slate-800 mb-1 group-hover:text-amber-600 transition">{product.name}</h3>
                      <p className="text-slate-500 text-xs mb-3 line-clamp-2">{product.description}</p>
                    </div>

                    <div className="border-t pt-3 mt-auto">
                      <div className="flex items-baseline space-x-2 mb-3">
                        <span className="text-lg font-black text-slate-900">PKR {product.discounted_price || product.price}</span>
                        {product.original_price > (product.discounted_price || product.price) && (
                          <span className="text-xs text-slate-400 line-through">PKR {product.original_price}</span>
                        )}
                      </div>

                      <button
                        onClick={() => addToCart(product)}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center shadow cursor-pointer"
                      >
                        <ShoppingCart className="w-4 h-4 mr-1.5" /> Add to Cart
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>
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
                    <span className="font-bold text-emerald-600">Processing / Verified</span>
                  </div>
                </div>
                <button
                  onClick={() => {
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
                        <span className="text-xs text-slate-500">
                          {item.quantity} x PKR {item.discounted_price || item.price}
                        </span>
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
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
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
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Phone / WhatsApp</label>
                      <input
                        type="tel"
                        required
                        placeholder="03001234567"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Delivery Address</label>
                    <input
                      type="text"
                      required
                      placeholder="Shop/House address"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">City</label>
                      <input
                        type="text"
                        required
                        placeholder="City Name"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">ZIP / Postal Code</label>
                      <input
                        type="text"
                        placeholder="e.g. 54000"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

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
              <p className="text-xs text-slate-500 mt-1">Zorima Enterprise Management Portal</p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">User ID / Username</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="User ID (e.g. zorima / admin)"
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
                    placeholder="Password (e.g. 123)"
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
                <LayoutDashboard className="w-6 h-6 mr-2" /> Zorima Admin Control Center
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Role: <span className="text-amber-300 font-bold">{loggedInUserRole}</span> | Manage Products, Categories, Orders, Users & Accounts.
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
                fetchOrders();
              }}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition cursor-pointer ${
                adminTab === 'orders' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <FileText className="w-4 h-4 mr-1.5 text-amber-500" /> Orders ({adminOrders.length})
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
                      <th className="p-3.5">Customer Name</th>
                      <th className="p-3.5">Phone / WhatsApp</th>
                      <th className="p-3.5">Shipping Address</th>
                      <th className="p-3.5">Items</th>
                      <th className="p-3.5">Total Amount</th>
                      <th className="p-3.5">Payment Method</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {adminOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 font-black text-slate-900">{order.invoice_no || 'ZP-1001'}</td>
                        <td className="p-3.5 font-bold text-slate-800">{order.customer_name}</td>
                        <td className="p-3.5 text-slate-600">{order.customer_phone}</td>
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
                        </td>
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
        © 2026 ZORIMA PROFESSIONAL - Premium Enterprise Management System. All Rights Reserved.
      </footer>
    </div>
  );
}
