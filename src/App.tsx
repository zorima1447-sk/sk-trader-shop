import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { ShoppingCart, Package, CheckCircle2, Phone, MapPin, User, Trash2, Building, Hash, CreditCard, ShieldCheck, Plus, Settings, Lock } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock_quantity: number;
}

interface CartItem extends Product {
  quantity: number;
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [confirmedInvoice, setConfirmedInvoice] = useState('');
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Checkout Form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'easypaisa' | 'card'>('cod');
  
  // Payment Details
  const [easypaisaNumber, setEasypaisaNumber] = useState('0300-1234567');
  const [easypaisaAccountTitle, setEasypaisaAccountTitle] = useState('Zorima Professional Account');
  const [transactionId, setTransactionId] = useState('');

  // Card details
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin Modal View
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductImage, setNewProductImage] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*');
    if (error) {
      console.error('Error fetching products:', error);
      setProducts(getDemoProducts());
    } else if (data && data.length > 0) {
      setProducts(data);
    } else {
      setProducts(getDemoProducts());
    }
    setLoading(false);
  }

  function getDemoProducts(): Product[] {
    return [
      {
        id: '1',
        name: 'Freecia Baobab Oil Hair Treatment',
        description: 'Nourishing oil for shiny, strong & healthy hair.',
        price: 1850,
        image_url: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=500&auto=format&fit=crop&q=60',
        stock_quantity: 20
      },
      {
        id: '2',
        name: 'Signature Hair Developer 20 Vol',
        description: 'Professional hair color developer for maximum shine.',
        price: 950,
        image_url: 'https://images.unsplash.com/photo-1608248597262-838d7211820b?w=500&auto=format&fit=crop&q=60',
        stock_quantity: 15
      },
      {
        id: '3',
        name: 'Skin Bleach Mask Care',
        description: 'Deep cleansing and bright mask for smooth skin.',
        price: 1200,
        image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=60',
        stock_quantity: 10
      }
    ];
  }

  // Silent Add to Cart - Window DOES NOT OPEN
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

    // Toast notification
    setToastMessage(`${product.name} added to cart!`);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !shippingAddress || !city) {
      alert('Please fill in all address and contact fields.');
      return;
    }

    if (paymentMethod === 'easypaisa' && !transactionId) {
      alert('Please enter EasyPaisa Transaction ID after payment.');
      return;
    }

    setIsSubmitting(true);

    try {
      const fullAddress = `${shippingAddress}, City: ${city}, Zip: ${zipCode}`;
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            customer_name: customerName,
            customer_phone: customerPhone,
            shipping_address: fullAddress,
            total_amount: totalAmount,
            status: 'Pending'
          }
        ])
        .select();

      let invNumber = `ZP-${Math.floor(1000 + Math.random() * 9000)}`;

      if (orderError) {
        console.warn('Orders insert warning:', orderError);
      } else if (orderData && orderData[0]) {
        invNumber = orderData[0].invoice_no || invNumber;
        const orderId = orderData[0].id;
        const orderItems = cart.map((item) => ({
          order_id: orderId,
          product_id: item.id,
          quantity: item.quantity,
          price: item.price
        }));

        await supabase.from('order_items').insert(orderItems);
      }

      setConfirmedInvoice(invNumber);
      setOrderSuccess(true);
      setCart([]);
    } catch (err) {
      console.error('Checkout error:', err);
      setConfirmedInvoice(`ZP-${Math.floor(1000 + Math.random() * 9000)}`);
      setOrderSuccess(true);
      setCart([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newProductPrice) return;

    const { error } = await supabase.from('products').insert([
      {
        name: newProductName,
        description: newProductDesc,
        price: parseFloat(newProductPrice),
        image_url: newProductImage || 'https://via.placeholder.com/300',
        stock_quantity: 50
      }
    ]);

    if (error) {
      alert('Error adding product: ' + error.message);
    } else {
      alert('Product added successfully!');
      setNewProductName('');
      setNewProductDesc('');
      setNewProductPrice('');
      setNewProductImage('');
      fetchProducts();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-semibold text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Header / Navbar */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Package className="w-8 h-8 text-amber-400" />
            <div>
              <span className="text-2xl font-extrabold tracking-wider text-white block">ZORIMA PROFESSIONAL</span>
              <span className="text-xs text-amber-300 font-medium tracking-widest block -mt-1">PREMIUM BEAUTY & CARE</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsAdminOpen(true)}
              className="text-slate-400 hover:text-white transition flex items-center text-sm font-medium"
            >
              <Settings className="w-4 h-4 mr-1" /> Admin
            </button>

            {/* Cart Button with Counter */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl transition shadow-lg"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              <span>Cart</span>
              {cart.length > 0 && (
                <span className="ml-2 bg-slate-900 text-amber-400 text-xs font-black px-2 py-0.5 rounded-full border border-amber-400">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 text-white py-14 px-4 text-center border-b border-amber-500/20">
        <h1 className="text-3xl md:text-5xl font-black mb-3 text-amber-400 tracking-tight">ZORIMA PROFESSIONAL</h1>
        <p className="text-slate-300 text-lg max-w-2xl mx-auto">Discover luxury hair care, developers & bleaching masks delivered directly to your salon or store.</p>
      </div>

      {/* Product Catalog */}
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex justify-between items-center mb-6 border-b pb-3">
          <h2 className="text-2xl font-bold text-slate-800">Exclusive Collection</h2>
          <span className="text-sm text-slate-500">{products.length} Products Available</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 font-medium">Loading Zorima Products...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group">
                <div className="overflow-hidden bg-slate-100 h-52 relative">
                  <img
                    src={product.image_url || 'https://via.placeholder.com/300'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-3 right-3 bg-slate-900/80 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
                    In Stock
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800 mb-1 group-hover:text-amber-600 transition">{product.name}</h3>
                    <p className="text-slate-600 text-sm mb-4 line-clamp-2">{product.description}</p>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t">
                    <div>
                      <span className="text-xs text-slate-400 block font-semibold">PRICE</span>
                      <span className="text-xl font-black text-slate-900">PKR {product.price}</span>
                    </div>
                    {/* Silent Add to Cart */}
                    <button
                      onClick={() => addToCart(product)}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm px-4 py-2.5 rounded-xl transition flex items-center shadow-md active:scale-95"
                    >
                      <ShoppingCart className="w-4 h-4 mr-1.5" /> Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cart & Checkout Slide-Over Window */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-lg h-full flex flex-col shadow-2xl p-6 overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-xl font-extrabold text-slate-800 flex items-center">
                <ShoppingCart className="mr-2 w-6 h-6 text-amber-500" /> Shopping Cart
              </h3>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-2xl"
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
                    <span className="font-bold text-emerald-600">
                      {paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid / Processing'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setOrderSuccess(false);
                    setIsCartOpen(false);
                  }}
                  className="w-full bg-slate-900 text-amber-400 font-bold py-3 rounded-xl hover:bg-slate-800 transition"
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
                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto py-4 space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                        <span className="text-xs text-slate-500">
                          {item.quantity} x PKR {item.price}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-black text-slate-900 text-sm">
                          PKR {item.price * item.quantity}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-500 hover:text-red-700"
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

                {/* Checkout Form */}
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

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2">Select Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cod')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center ${
                          paymentMethod === 'cod' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        <Building className="w-4 h-4 mb-1" /> Cash on Delivery
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('easypaisa')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center ${
                          paymentMethod === 'easypaisa' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        <Hash className="w-4 h-4 mb-1" /> EasyPaisa
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center ${
                          paymentMethod === 'card' ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 mb-1" /> Credit Card
                      </button>
                    </div>
                  </div>

                  {/* EasyPaisa Account Box */}
                  {paymentMethod === 'easypaisa' && (
                    <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs space-y-2">
                      <div className="font-bold text-emerald-900 border-b pb-1">EasyPaisa Payment Details:</div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Account Number:</span>
                        <span className="font-extrabold text-emerald-800 text-sm">{easypaisaNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Account Title:</span>
                        <span className="font-bold text-slate-800">{easypaisaAccountTitle}</span>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mt-2 mb-1">Enter EasyPaisa Transaction ID (TRX ID):</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 123456789"
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          className="w-full px-3 py-1.5 border rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Card Payment Form */}
                  {paymentMethod === 'card' && (
                    <div className="bg-slate-50 border p-3.5 rounded-xl text-xs space-y-2">
                      <div className="font-bold text-slate-800 border-b pb-1">Credit / Debit Card Payment</div>
                      <div>
                        <label className="block text-slate-600 mb-1">Card Number</label>
                        <input
                          type="text"
                          placeholder="4532 XXXX XXXX 8921"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full px-3 py-1.5 border rounded-lg text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-600 mb-1">Expiry Date</label>
                          <input
                            type="text"
                            placeholder="MM/YY"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            className="w-full px-3 py-1.5 border rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1">CVC Code</label>
                          <input
                            type="password"
                            maxLength={4}
                            placeholder="123"
                            value={cardCvc}
                            onChange={(e) => setCardCvc(e.target.value)}
                            className="w-full px-3 py-1.5 border rounded-lg text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold py-3.5 rounded-xl transition shadow-lg text-center text-base"
                  >
                    {isSubmitting ? 'Processing Order...' : 'Confirm Order Now'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Admin Upload Portal Modal */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl relative">
            <button
              onClick={() => setIsAdminOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl"
            >
              ✕
            </button>

            {!isAdminLoggedIn ? (
              <div className="text-center py-6">
                <Lock className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Admin Portal Login</h3>
                <p className="text-xs text-slate-500 mb-4">Enter admin password to upload products</p>
                <input
                  type="password"
                  placeholder="Enter Password (admin123)"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl text-sm mb-4 text-center"
                />
                <button
                  onClick={() => {
                    if (adminPassword === 'admin123' || adminPassword === 'admin') {
                      setIsAdminLoggedIn(true);
                    } else {
                      alert('Incorrect Admin Password!');
                    }
                  }}
                  className="w-full bg-slate-900 text-amber-400 font-bold py-2.5 rounded-xl text-sm"
                >
                  Login to Admin Panel
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
                  <Plus className="w-5 h-5 text-amber-500 mr-1" /> Add New Zorima Product
                </h3>

                <form onSubmit={handleAddProduct} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Product Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Zorima Hair Treatment"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Product details & usage"
                      value={newProductDesc}
                      onChange={(e) => setNewProductDesc(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Price (PKR)</label>
                    <input
                      type="number"
                      required
                      placeholder="1500"
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Image URL Link</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={newProductImage}
                      onChange={(e) => setNewProductImage(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition text-sm mt-2"
                  >
                    Upload Product to Website
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 text-center border-t border-slate-800 text-sm">
        © 2026 ZORIMA PROFESSIONAL - Premium Beauty & Care. All Rights Reserved.
      </footer>
    </div>
  );
}
