import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { InvoicePage } from './Invoice.tsx'
import './index.css'

// A link like  https://your-site/?invoice=<order id>  opens only the printable invoice.
const invoiceId = new URLSearchParams(window.location.search).get('invoice')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {invoiceId ? <InvoicePage orderId={invoiceId} /> : <App />}
  </React.StrictMode>,
)
