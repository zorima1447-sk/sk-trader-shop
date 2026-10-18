import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ProductForm({ onAddProduct }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [loading, setLoading] = useState(false);

  // Categories fetch karna taake dropdown se sahi ID select ho
  useEffect(() => {
    async function fetchCategories() {
      const { data } = await supabase.from('categories').select('*');
      if (data) {
        setCategories(data);
      }
    }
    fetchCategories();
  }, []);

  // Direct Image File ko convert karne ka function (URL ka option khatam)
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const newProduct = {
      name,
      description,
      price: parseFloat(price) || 0,
      stock_quantity: parseInt(stockQuantity) || 0,
      category_id: categoryId,
      image_url: imageBase64
    };

    await onAddProduct(newProduct);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white rounded shadow-md space-y-4">
      <h3 className="text-lg font-bold">Add New Product</h3>
      
      <div>
        <label className="block text-sm font-medium">Product Name</label>
        <input 
          type="text" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          className="w-full p-2 border rounded" 
          required 
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          className="w-full p-2 border rounded" 
          placeholder="Enter product description"
          required 
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Price</label>
        <input 
          type="number" 
          step="0.01"
          value={price} 
          onChange={(e) => setPrice(e.target.value)} 
          className="w-full p-2 border rounded" 
          required 
        />
      </div>

      {/* Stock Quantity ka option */}
      <div>
        <label className="block text-sm font-medium">Stock Quantity</label>
        <input 
          type="number" 
          value={stockQuantity} 
          onChange={(e) => setStockQuantity(e.target.value)} 
          className="w-full p-2 border rounded" 
          required 
        />
      </div>

      {/* Category Dropdown */}
      <div>
        <label className="block text-sm font-medium">Select Category</label>
        <select 
          value={categoryId} 
          onChange={(e) => setCategoryId(e.target.value)} 
          className="w-full p-2 border rounded" 
          required
        >
          <option value="">-- Select Category --</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Sirf Direct File Upload (URL ka koi option nahi) */}
      <div>
        <label className="block text-sm font-medium">Upload Product Image</label>
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleImageChange} 
          className="w-full p-2 border rounded" 
          required 
        />
        {imageBase64 && (
          <p className="text-green-600 text-sm mt-1">✓ Image ready to upload!</p>
        )}
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
      >
        {loading ? 'Saving...' : 'Save Product'}
      </button>
    </form>
  );
}
