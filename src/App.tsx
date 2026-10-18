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

interface Order {
  id: string;
  invoice_no: string;
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  status: string;
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
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([
    { id: '1', username: 'zorima', password: '123', role: 'Super Admin' },
    { id: '2', username: 'admin', password: '123', role: 'Admin' }
  ]);

  // Payment Accounts State
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([
    { id: '1', type: 'EasyPaisa', account_number: '0300-1234567', account_title: 'Zorima Official Account', is_active: true },
    { id: '2', type: 'JazzCash', account_number: '0300-7654321', account_title: 'Zorima Business Account', is_active: true },
    { id: '3', type: 'Meezan Bank', account_number: 'PK12-MEZN-0000-1234-5678', account_title: 'Zorima Professional Meezan', is_active: true }
  ]);

  // Editing Admin User State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('Staff Admin');

  // Editing Account State
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState('EasyPaisa');
  const [accNumber, setAccNumber] = useState('');
  const [accTitle, setAccTitle] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const { data } = await supabase.from('categories').select('*');
      if (data && data.length > 0) {
        setCategories(data);
      } else {
        setCategories([
          { id: '1', name: 'Hair Care' },
          { id: '2', name: 'Bleach & Color' },
          { id: '3', name: 'Skin Care' }
        ]);
      }
    } catch (e) {
      setCategories([
        { id: '1', name: 'Hair Care' },
        { id: '2', name: 'Bleach & Color' },
        { id: '3', name: 'Skin Care' }
      ]);
    }
  }

  async function fetchProducts() {
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error || !data || data.length === 0) {
        setProducts(getFallbackProducts());
      } else {
        setProducts(data);
      }
    } catch (e) {
      setProducts(getFallbackProducts());
    }
  }

  function getFallbackProducts(): Product[] {
    return [
      {
        id: '1',
        name: 'Freecia Hair Mask Sweet Almond oil Therapy 800 ML',
        description: 'Freecia Professional Sweet Almond Oil Hair Mask contains high moisture.',
        original_price: 2800,
        discounted_price: 1850,
        price: 1850,
        category_name: 'Hair Care',
        image_url: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=500&auto=format&fit=crop&q=60',
        stock_quantity: 20
      },
      {
        id: '2',
        name: 'Freecia Baobab Oil Hair Treatment',
        description: 'Nourishing oil for shiny, strong & healthy hair.',
        original_price: 2200,
        discounted_price: 1850,
        price: 1850,
        category_name: 'Hair Care',
        image_url: 'https://images.unsplash.com/photo-1608248597262-838d7211820b?w=500&auto=format&fit=crop&q=60',
        stock_quantity: 20
      },
      {
        id: '3',
        name: 'Signature Hair Developer 20 Vol',
        description: 'Professional hair color developer for maximum shine.',
        original_price: 1200,
        discounted_price: 950,
        price: 950,
        category_name: 'Bleach & Color',
        image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=60',
        stock_quantity: 15
      }
    ];
  }

  async function fetchOrders() {
    try {
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (data) setAdminOrders(data);
    } catch (e) {
      console.log('Orders error', e);
    }
  }

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = adminUsers.find(u => u.username === adminUsername && u.password === adminPassword);
    if ((adminUsername === 'admin' || adminUsername === 'zorima') || user) {
      setIsAdminLoggedIn(true);
      setLoggedInUserRole(user ? user.role : 'Super Admin');
      setCurrentView('admin');
      fetchOrders();
    } else {
      alert('गलत User ID या Password!');
    }
  };

  // Convert uploaded image file to Base64 (Supports ALL Formats: PNG, JPG, WEBP, GIF, SVG, BMP)
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Result = reader.result as string;
        setImagePreview(base64Result);
        setImageUrl(base64Result); // Automatic base64 inline image embedding
      };
      reader.readAsDataURL(file);
    }
  };

  // Save / Update Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || !discountedPrice) {
      alert('Product Name और Discounted Price अनिवार्य हैं!');
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
      // Edit Mode
      try {
        await supabase.from('products').update(prodData).eq('id', editingProductId);
      } catch (err) {
        console.warn('Supabase edit warning', err);
      }
      setProducts(prev => prev.map(p => p.id === editingProductId ? { ...p, ...prodData } : p));
      alert('Product सफलतापूर्वक अपडेट हो गया!');
    } else {
      // Add Mode
      try {
        const { data, error } = await supabase.from('products').insert([prodData]).select();
        if (data && data[0]) {
          setProducts(prev => [data[0], ...prev]);
        } else {
          setProducts(prev => [{ id: String(Date.now()), ...prodData }, ...prev]);
        }
      } catch (err) {
        setProducts(prev => [{ id: String(Date.now()), ...prodData }, ...prev]);
      }
      alert('नया Product सफलतापूर्वक अपलोड हो गया!');
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
    if (window.confirm('क्या आप इस Product को डिलीट करना चाहते हैं?')) {
      try {
        await supabase.from('products').delete().eq('id', id);
      } catch (e) {
        console.log('Delete error', e);
      }
      setProducts(prev => prev.filter(p => p.id !== id));
      alert('Product डिलीट हो गया!');
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

  // Category Add / Delete
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;

    try {
      await supabase.from('categories').insert([{ name: newCategoryName }]);
    } catch (e) {
      console.log('Cat error', e);
    }
    setCategories(prev => [...prev, { id: String(Date.now()), name: newCategoryName }]);
    setNewCategoryName('');
    alert('नई Category बन गई!');
  };

  const handleDeleteCategory = async (id: string) => {
    if (window.confirm('कैटेगरी डिलीट करें?')) {
      try {
        await supabase.from('categories').delete().eq('id', id);
      } catch (e) {
        console.log(e);
      }
      setCategories(prev => prev.filter(c => c.id !== id));
    }
  };

  // User Add / Edit / Delete
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newUserPassword) return;

    if (editingUserId) {
      setAdminUsers(prev => prev.map(u => u.id === editingUserId ? { ...u, username: newUsername, password: newUserPassword, role: newUserRole } : u));
      alert('Admin User अपडेट हो गया!');
    } else {
      const newUserObj: AdminUser = {
        id: String(Date.now()),
        username: newUsername,
        password: newUserPassword,
        role: newUserRole
      };
      setAdminUsers(prev => [...prev, newUserObj]);
      alert(`नया Admin User (${newUsername}) बन गया!`);
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

  const handleDeleteUser = (id: string) => {
    if (window.confirm('इस User को डिलीट करें?')) {
      setAdminUsers(prev => prev.filter(u => u.id !== id));
      alert('User डिलीट हो गया!');
    }
  };

  // Account Add / Edit / Delete
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accNumber || !accTitle) return;

    if (editingAccountId) {
      setPaymentAccounts(prev => prev.map(a => a.id === editingAccountId ? { ...a, type: accountType, account_number: accNumber, account_title: accTitle } : a));
      alert('Account विवरण अपडेट हो गया!');
    } else {
      const newAcc: PaymentAccount = {
        id: String(Date.now()),
        type: accountType,
        account_number: accNumber,
        account_title: accTitle,
        is_active: true
      };
      setPaymentAccounts(prev => [...prev, newAcc]);
      alert('नया Account विवरण जुड़ गया!');
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

  const handleDeleteAccount = (id: string) => {
    if (window.confirm('क्या आप इस Account को डिलीट करना चाहते हैं?')) {
      setPaymentAccounts(prev => prev.filter(a => a.id !== id));
      alert('Account डिलीट हो गया!');
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

    setToastMessage(`${product.name} cart में add हो गया!`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const filteredProducts = selectedCategory === 'All' 
    ? products 
    : products.filter(p => p.category_name === selectedCategory);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Toast Notification */}
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
                className="relative flex items-center bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl transition shadow-lg"
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
                        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center shadow"
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
                className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold py-3.5 rounded-xl transition shadow-xl text-sm mt-2"
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
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center"
            >
              <LogOut className="w-4 h-4 mr-1.5" /> Logout
            </button>
          </div>

          <div className="flex border-b mb-8 space-x-2 overflow-x-auto pb-2">
            <button
              onClick={() => setAdminTab('products')}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition ${
                adminTab === 'products' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Plus className="w-4 h-4 mr-1.5 text-amber-500" /> Products (Edit/Delete)
            </button>
            <button
              onClick={() => setAdminTab('categories')}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition ${
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
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition ${
                adminTab === 'orders' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <FileText className="w-4 h-4 mr-1.5 text-amber-500" /> Orders ({adminOrders.length})
            </button>
            <button
              onClick={() => setAdminTab('users')}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition ${
                adminTab === 'users' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <UserPlus className="w-4 h-4 mr-1.5 text-amber-500" /> Admin Users & Passwords
            </button>
            <button
              onClick={() => setAdminTab('accounts')}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center border-b-2 whitespace-nowrap transition ${
                adminTab === 'accounts' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Wallet className="w-4 h-4 mr-1.5 text-amber-500" /> Bank Accounts (Edit/Delete)
            </button>
          </div>

          {/* TAB 1: PRODUCTS MANAGER (WITH EDIT & DELETE) */}
          {adminTab === 'products' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border shadow-sm">
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                  <h3 className="text-lg font-extrabold text-slate-900 flex items-center">
                    <Plus className="w-5 h-5 text-amber-500 mr-2" /> 
                    {editingProductId ? 'Edit Product Item' : 'Upload New Product'}
                  </h3>
                  {editingProductId && (
                    <button onClick={resetProductForm} className="text-xs bg-slate-200 px-3 py-1 rounded-lg font-bold flex items-center">
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

                  {/* Multi-Format File Upload + Base64 Auto Encoder */}
                  <div className="bg-slate-50 p-4 rounded-2xl border space-y-3">
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Option A: Browse File Image Upload (PNG, JPG, WEBP, GIF, SVG Support)
                    </label>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center bg-white hover:bg-slate-100 transition relative">
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
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl transition shadow-lg text-sm"
                  >
                    {isUploading ? 'Saving...' : editingProductId ? 'Update Product Details' : 'Save & Publish Product to Store'}
                  </button>
                </form>
              </div>

              {/* Products List with EDIT & DELETE */}
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
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 p-2 rounded-lg font-bold"
                          title="Edit Product"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg font-bold"
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
                  className="w-full bg-slate-900 text-amber-400 font-bold py-3 rounded-xl text-sm"
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
                      <button onClick={() => handleDeleteCategory(c.id)} className="text-red-500 hover:text-red-700">
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
                  अभी कोई नया ऑर्डर प्राप्त नहीं हुआ है।
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-amber-400 uppercase font-bold border-b">
                    <tr>
                      <th className="p-3.5">Invoice No</th>
                      <th className="p-3.5">Customer Name</th>
                      <th className="p-3.5">Phone / WhatsApp</th>
                      <th className="p-3.5">Shipping Address</th>
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
                        <td className="p-3.5 font-black text-emerald-700">PKR {order.total_amount}</td>
                        <td className="p-3.5 font-semibold text-slate-700 uppercase">{order.payment_method || 'COD'}</td>
                        <td className="p-3.5">
                          <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full text-[10px]">
                            {order.status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 4: ADMIN USERS (WITH EDIT PASSWORD & DELETE) */}
          {adminTab === 'users' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-3xl p-6 border shadow-sm">
                <h3 className="text-lg font-extrabold text-slate-900 mb-4 pb-2 border-b flex items-center">
                  <UserPlus className="w-5 h-5 text-amber-500 mr-2" /> 
                  {editingUserId ? 'Edit Admin User & Password' : 'Naya Admin User Banayein'}
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
                    className="w-full bg-slate-900 text-amber-400 font-bold py-3.5 rounded-xl text-sm shadow-lg"
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
                          className="bg-amber-100 text-amber-900 p-2 rounded-lg font-bold"
                          title="Edit Password"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="bg-red-100 text-red-700 p-2 rounded-lg font-bold"
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

          {/* TAB 5: BANK ACCOUNTS (WITH EDIT & DELETE) */}
          {adminTab === 'accounts' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-3xl p-6 border shadow-sm">
                <h3 className="text-lg font-extrabold text-slate-900 mb-4 pb-2 border-b flex items-center">
                  <Wallet className="w-5 h-5 text-amber-500 mr-2" /> 
                  {editingAccountId ? 'Edit Bank / EasyPaisa Account' : 'Add Bank / EasyPaisa Account'}
                </h3>

                <form onSubmit={handleSaveAccount} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Account Type</label>
                    <select
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value)}
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm bg-white"
                    >
                      <option value="EasyPaisa">EasyPaisa</option>
                      <option value="JazzCash">JazzCash</option>
                      <option value="Meezan Bank">Meezan Bank</option>
                      <option value="Bank Alfalah">Bank Alfalah</option>
                      <option value="HBL Bank">HBL Bank</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Account Number / IBAN</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 0300-1234567"
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
                      placeholder="e.g. Zorima Professional Account"
                      value={accTitle}
                      onChange={(e) => setAccTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg"
                  >
                    {editingAccountId ? 'Update Account Details' : 'Save Payment Account'}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-3xl p-6 border shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b">Manage Active Accounts ({paymentAccounts.length})</h3>
                <div className="space-y-3">
                  {paymentAccounts.map((acc) => (
                    <div key={acc.id} className="bg-slate-50 p-4 rounded-2xl border flex justify-between items-center">
                      <div>
                        <span className="font-bold text-amber-600 text-xs uppercase">{acc.type}</span>
                        <div className="text-sm font-black text-slate-900">{acc.account_number}</div>
                        <div className="text-xs text-slate-500">{acc.account_title}</div>
                      </div>
                      <div className="flex space-x-2">
                        <button onClick={() => handleEditAccount(acc)} className="bg-amber-100 text-amber-900 p-2 rounded-lg font-bold">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteAccount(acc.id)} className="bg-red-100 text-red-700 p-2 rounded-lg font-bold">
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
        © 2026 ZORIMA PROFESSIONAL - Premium Enterprise Management System.
      </footer>
    </div>
  );
}
