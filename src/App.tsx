import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { 
  ShoppingCart, Package, CheckCircle2, Phone, MapPin, User, Trash2, Building, 
  Hash, CreditCard, Plus, Settings, Lock, Upload, Tag, ListFilter, DollarSign, 
  FileText, Users, Eye, LogOut, LayoutDashboard, Search, Image as ImageIcon
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

export default function App() {
  const [currentView, setCurrentView] = useState<'store' | 'login' | 'admin'>('store');
  
  // Store States
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [confirmedInvoice, setConfirmedInvoice] = useState('');
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Customer Checkout Form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'easypaisa' | 'card'>('cod');
  const [transactionId, setTransactionId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin Portal States
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminTab, setAdminTab] = useState<'products' | 'categories' | 'orders' | 'settings'>('products');

  // Admin New Product Form
  const [newProductName, setNewProductName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newOriginalPrice, setNewOriginalPrice] = useState('');
  const [newDiscountedPrice, setNewDiscountedPrice] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Admin New Category
  const [newCategoryName, setNewCategoryName] = useState('');

  // Admin Data lists
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  async function fetchCategories() {
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
  }

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*');
    if (error || !data || data.length === 0) {
      setProducts([
        {
          id: '1',
          name: 'Freecia Baobab Oil Hair Treatment',
          description: 'Nourishing oil for shiny, strong & healthy hair.',
          original_price: 2200,
          discounted_price: 1850,
          category_name: 'Hair Care',
          image_url: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=500&auto=format&fit=crop&q=60',
          stock_quantity: 20
        },
        {
          id: '2',
          name: 'Signature Hair Developer 20 Vol',
          description: 'Professional hair color developer for maximum shine.',
          original_price: 1200,
          discounted_price: 950,
          category_name: 'Bleach & Color',
          image_url: 'https://images.unsplash.com/photo-1608248597262-838d7211820b?w=500&auto=format&fit=crop&q=60',
          stock_quantity: 15
        },
        {
          id: '3',
          name: 'Skin Bleach Mask Care',
          description: 'Deep cleansing and bright mask for smooth skin.',
          original_price: 1500,
          discounted_price: 1200,
          category_name: 'Skin Care',
          image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=60',
          stock_quantity: 10
        }
      ]);
    } else {
      setProducts(data);
    }
    setLoading(false);
  }

  async function fetchOrders() {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setAdminOrders(data);
  }

  // Handle Admin Login
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if ((adminUsername === 'admin' || adminUsername === 'zorima') && (adminPassword === 'admin123' || adminPassword === 'zorima123')) {
      setIsAdminLoggedIn(true);
      setCurrentView('admin');
      fetchOrders();
    } else {
      alert('Galat User ID ya Password! Baraye meherbani sahih details darj karein.');
    }
  };

  // Image File Upload Handler
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Add Product with File Upload
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newDiscountedPrice) {
      alert('Product Name aur Discounted Price zaroori hai.');
      return;
    }

    setIsUploading(true);
    let uploadedImageUrl = 'https://via.placeholder.com/300';

    if (imageFile) {
      const fileName = `${Date.now()}_${imageFile.name}`;
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, imageFile);

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        uploadedImageUrl = publicUrlData.publicUrl;
      }
    }

    const { error } = await supabase.from('products').insert([
      {
        name: newProductName,
        description: newProductDesc,
        original_price: parseFloat(newOriginalPrice) || parseFloat(newDiscountedPrice),
        discounted_price: parseFloat(newDiscountedPrice),
        price: parseFloat(newDiscountedPrice),
        category_name: newProductCategory || 'Hair Care',
        image_url: uploadedImageUrl,
        stock_quantity: 50
      }
    ]);

    setIsUploading(false);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert('Product kamyaabi se upload ho gaya!');
      setNewProductName('');
      setNewProductDesc('');
      setNewOriginalPrice('');
      setNewDiscountedPrice('');
      setImageFile(null);
      setImagePreview(null);
      fetchProducts();
    }
  };

  // Add Category Handler
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;

    const { error } = await supabase.from('categories').insert([{ name: newCategoryName }]);
    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert('Nayi Category ban gayi!');
      setNewCategoryName('');
      fetchCategories();
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

    setToastMessage(`${product.name} cart mein add ho gaya!`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.discounted_price || item.price) * item.quantity, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !shippingAddress || !city) {
      alert('Sahi details enter karein.');
      return;
    }

    setIsSubmitting(true);
    const fullAddress = `${shippingAddress}, City: ${city}, Zip: ${zipCode}`;

    try {
      const { data: orderData } = await supabase.from('orders').insert([
        {
          customer_name: customerName,
          customer_phone: customerPhone,
          shipping_address: fullAddress,
          total_amount: totalAmount,
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'cod' ? 'Pending COD' : 'Paid Online',
          status: 'Pending'
        }
      ]).select();

      let inv = `ZP-${Math.floor(1000 + Math.random() * 9000)}`;
      if (orderData && orderData[0]) {
        inv = orderData[0].invoice_no || inv;
      }

      setConfirmedInvoice(inv);
      setOrderSuccess(true);
      setCart([]);
    } catch (err) {
      setConfirmedInvoice(`ZP-${Math.floor(1000 + Math.random() * 9000)}`);
      setOrderSuccess(true);
      setCart([]);
    } finally {
      setIsSubmitting(false);
    }
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
                {currentView === 'admin' ? 'Back to Store' : 'Admin Panel'}
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
          {/* Banner */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 text-white py-12 px-4 text-center border-b border-amber-500/20">
            <h1 className="text-3xl md:text-5xl font-black mb-2 text-amber-400">ZORIMA PROFESSIONAL STORE</h1>
            <p className="text-slate-300 text-sm md:text-base max-w-2xl mx-auto">Original Hair Care, Baobab Oils & Skin Bleach Masks at Discounted Prices.</p>
          </div>

          <main className="max-w-7xl mx-auto px-4 py-8">
            {/* Category Filter Tabs */}
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

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group">
                  <div className="overflow-hidden bg-slate-100 h-48 relative">
                    <img
                      src={product.image_url || 'https://via.placeholder.com/300'}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {product.original_price > product.discounted_price && (
                      <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                        SAVE PKR {product.original_price - product.discounted_price}
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
                        {product.original_price > product.discounted_price && (
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
              <p className="text-xs text-slate-500 mt-1">Sarf Zorima Management use ke liye</p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">User ID / Username</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Enter Admin User ID (e.g. zorima)"
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
                    placeholder="Enter Password (zorima123)"
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
                Login to Dashboard
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 3: FULL ADMIN CONTROL DASHBOARD */}
      {currentView === 'admin' && isAdminLoggedIn && (
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Admin Header Bar */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-amber-400 flex items-center">
                <LayoutDashboard className="w-6 h-6 mr-2" /> Zorima Admin Control Center
              </h2>
              <p className="text-xs text-slate-400 mt-1">Products upload, Categories, Orders & Invoice Details Manage Karein.</p>
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

          {/* Admin Tab Navigation */}
          <div className="flex border-b mb-8 space-x-2">
            <button
              onClick={() => setAdminTab('products')}
              className={`pb-3 px-5 text-sm font-bold flex items-center border-b-2 transition ${
                adminTab === 'products' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Plus className="w-4 h-4 mr-2 text-amber-500" /> Add & Manage Products
            </button>
            <button
              onClick={() => setAdminTab('categories')}
              className={`pb-3 px-5 text-sm font-bold flex items-center border-b-2 transition ${
                adminTab === 'categories' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Tag className="w-4 h-4 mr-2 text-amber-500" /> Manage Categories
            </button>
            <button
              onClick={() => {
                setAdminTab('orders');
                fetchOrders();
              }}
              className={`pb-3 px-5 text-sm font-bold flex items-center border-b-2 transition ${
                adminTab === 'orders' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <FileText className="w-4 h-4 mr-2 text-amber-500" /> Customer Orders & Invoices ({adminOrders.length})
            </button>
          </div>

          {/* TAB 1: ADD NEW PRODUCT PAGE WITH IMAGE BROWSE & DISCOUNT */}
          {adminTab === 'products' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Product Form */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border shadow-sm">
                <h3 className="text-lg font-extrabold text-slate-900 mb-4 pb-2 border-b flex items-center">
                  <Plus className="w-5 h-5 text-amber-500 mr-2" /> Upload New Zorima Product
                </h3>

                <form onSubmit={handleAddProduct} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Product Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Freecia Baobab Hair Treatment"
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Select Category *</label>
                      <select
                        value={newProductCategory}
                        onChange={(e) => setNewProductCategory(e.target.value)}
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
                      placeholder="Product specifications, usage & details"
                      value={newProductDesc}
                      onChange={(e) => setNewProductDesc(e.target.value)}
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Prices & Discounts */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Original Price (PKR)</label>
                      <input
                        type="number"
                        placeholder="2200"
                        value={newOriginalPrice}
                        onChange={(e) => setNewOriginalPrice(e.target.value)}
                        className="w-full px-3.5 py-2 border rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-emerald-700 mb-1">After Discount Price (PKR) *</label>
                      <input
                        type="number"
                        required
                        placeholder="1850"
                        value={newDiscountedPrice}
                        onChange={(e) => setNewDiscountedPrice(e.target.value)}
                        className="w-full px-3.5 py-2 border rounded-xl text-sm font-bold text-emerald-800"
                      />
                    </div>
                  </div>

                  {/* Browse File Image Upload Box */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Browse Product Image (Upload File)</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50 hover:bg-slate-100 transition relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">Click to Browse & Select Image File</p>
                      <p className="text-[10px] text-slate-400 mt-1">PNG, JPG or WEBP formats supported</p>
                    </div>

                    {imagePreview && (
                      <div className="mt-3 flex items-center space-x-3 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                        <img src={imagePreview} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />
                        <span className="text-xs text-emerald-800 font-bold">Image selected & ready to upload!</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isUploading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl transition shadow-lg text-sm"
                  >
                    {isUploading ? 'Uploading Image & Saving...' : 'Save & Publish Product to Store'}
                  </button>
                </form>
              </div>

              {/* Uploaded Products Summary */}
              <div className="bg-white rounded-3xl p-6 border shadow-sm h-fit">
                <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b">Live Products Count ({products.length})</h3>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {products.map((p) => (
                    <div key={p.id} className="flex items-center space-x-3 bg-slate-50 p-2.5 rounded-xl border text-xs">
                      <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded-lg" />
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800 line-clamp-1">{p.name}</h4>
                        <span className="text-emerald-700 font-bold">PKR {p.discounted_price || p.price}</span>
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
                    placeholder="e.g. Baobab Oil Series"
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
                <h4 className="font-bold text-xs uppercase text-slate-400 mb-3">Existing Categories</h4>
                <div className="space-y-2">
                  {categories.map((c) => (
                    <div key={c.id} className="bg-slate-50 px-4 py-2.5 rounded-xl border text-sm font-semibold text-slate-800 flex justify-between items-center">
                      <span>{c.name}</span>
                      <Tag className="w-4 h-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMER ORDERS & INVOICE DETAILS */}
          {adminTab === 'orders' && (
            <div className="bg-white rounded-3xl p-6 border shadow-sm overflow-x-auto">
              <h3 className="text-lg font-extrabold text-slate-900 mb-4 pb-2 border-b flex items-center">
                <FileText className="w-5 h-5 text-amber-500 mr-2" /> Customer Orders & Invoice Records
              </h3>

              {adminOrders.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-medium">
                  Abhi tak koi naya order nahi aaya.
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
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 text-center border-t border-slate-800 text-sm mt-12">
        © 2026 ZORIMA PROFESSIONAL - Premium Beauty & Care. All Rights Reserved.
      </footer>
    </div>
  );
}
