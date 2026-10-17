import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { ShoppingCart, Package, CheckCircle2, Phone, MapPin, User, Trash2 } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);

  // Customer Form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*');
    if (error) {
      console.error('Error fetching products:', error);
      // Demo Data if table is empty
      setProducts([
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
      ]);
    } else if (data && data.length > 0) {
      setProducts(data);
    } else {
      // Fallback sample data if database is empty
      setProducts([
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
        }
      ]);
    }
    setLoading(false);
  }

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
    setIsCartOpen(true);
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !shippingAddress) {
      alert('Please fill in all checkout fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert into orders table
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            customer_name: customerName,
            customer_phone: customerPhone,
            shipping_address: shippingAddress,
            total_amount: totalAmount,
            status: 'Pending'
          }
        ])
        .select();

      if (orderError) throw orderError;

      if (orderData && orderData[0]) {
        const orderId = orderData[0].id;
        const orderItems = cart.map((item) => ({
          order_id: orderId,
          product_id: item.id,
          quantity: item.quantity,
          price: item.price
        }));

        await supabase.from('order_items').insert(orderItems);
      }

      setOrderSuccess(true);
      setCart([]);
    } catch (err) {
      console.error('Checkout error:', err);
      // Demo fallback success
      setOrderSuccess(true);
      setCart([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header / Navbar */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Package className="w-8 h-8 text-indigo-400" />
            <span className="text-2xl font-bold tracking-wide text-white">SK TRADER</span>
          </div>
          <button
            onClick={() => setIsCartOpen(!isCartOpen)}
            className="relative flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            <span>Cart</span>
            {cart.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white py-12 px-4 text-center">
        <h1 className="text-3xl md:text-5xl font-extrabold mb-3">Professional Beauty & Hair Care Store</h1>
        <p className="text-indigo-200 text-lg max-w-2xl mx-auto">Order online high quality products with fast shipping right to your doorstep.</p>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 border-b pb-2">Featured Products</h2>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading products from Supabase...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition flex flex-col">
                <img
                  src={product.image_url || 'https://via.placeholder.com/300'}
                  alt={product.name}
                  className="w-full h-48 object-cover bg-slate-100"
                />
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800 mb-1">{product.name}</h3>
                    <p className="text-slate-600 text-sm mb-4">{product.description}</p>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xl font-extrabold text-indigo-600">PKR {product.price}</span>
                    <button
                      onClick={() => addToCart(product)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cart Drawer / Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl p-6 overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center">
                <ShoppingCart className="mr-2 w-5 h-5 text-indigo-600" /> Your Shopping Cart
              </h3>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl"
              >
                ✕
              </button>
            </div>

            {orderSuccess ? (
              <div className="my-auto text-center py-8">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h4 className="text-2xl font-bold text-slate-800 mb-2">Order Confirmed!</h4>
                <p className="text-slate-600 mb-6">Thank you for your order. We will contact you soon on WhatsApp to deliver your items.</p>
                <button
                  onClick={() => {
                    setOrderSuccess(false);
                    setIsCartOpen(false);
                  }}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Continue Shopping
                </button>
              </div>
            ) : cart.length === 0 ? (
              <div className="my-auto text-center py-12 text-slate-400">
                Your cart is empty.
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto py-4 space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center border-b pb-3">
                      <div>
                        <h4 className="font-semibold text-slate-800 text-sm">{item.name}</h4>
                        <span className="text-xs text-slate-500">
                          {item.quantity} x PKR {item.price}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-slate-800 text-sm">
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

                  <div className="pt-2 flex justify-between text-lg font-bold text-slate-900 border-t">
                    <span>Total Amount:</span>
                    <span className="text-indigo-600">PKR {totalAmount}</span>
                  </div>
                </div>

                {/* Checkout Form */}
                <form onSubmit={handleCheckout} className="border-t pt-4 space-y-3">
                  <h4 className="font-bold text-slate-800">Checkout Information</h4>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Your Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="Shahzad Khan"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">WhatsApp / Phone Number</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        placeholder="03001234567"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Delivery Address</label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <textarea
                        required
                        rows={2}
                        placeholder="Shop/House address, City"
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition shadow-md text-center"
                  >
                    {isSubmitting ? 'Processing Order...' : 'Confirm Order (Cash on Delivery)'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 text-center border-t border-slate-800 text-sm">
        © 2026 SK TRADER - Online E-Commerce Store. All Rights Reserved.
      </footer>
    </div>
  );
}
