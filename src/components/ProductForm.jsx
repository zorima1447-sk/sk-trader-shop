import React, { useState } from 'react';

export default function ProductForm({ onAddProduct }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageBase64, setImageBase64] = useState('');

  // Direct image file ko Base64 mein convert karne ka function
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

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Database ke columns ke mutabiq poora data object
    const newProduct = {
      name,
      description,
      price: parseFloat(price) || 0,
      stock_quantity: parseInt(stockQuantity) || 0,
      category_id: categoryId,
      image_url: imageBase64
    };

    onAddProduct(newProduct);
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
          value={price} 
          onChange={(e) => setPrice(e.target.value)} 
          className="w-full p-2 border rounded" 
          required 
        />
      </div>

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

      <div>
        <label className="block text-sm font-medium">Category ID</label>
        <input 
          type="text" 
          value={categoryId} 
          onChange={(e) => setCategoryId(e.target.value)} 
          className="w-full p-2 border rounded text-sm" 
          placeholder="Enter category UUID"
          required 
        />
      </div>

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
          <p className="text-green-600 text-sm mt-1">✓ Image uploaded successfully!</p>
        )}
      </div>

      <button 
        type="submit" 
        className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
      >
        Save Product
      </button>
    </form>
  );
}
