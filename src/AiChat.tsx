import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { MessageCircle, X, Sparkles } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };

// Turns plain links in the AI reply into clickable links (opens product / invoice pages)
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} className="underline font-semibold break-all" target={p.includes(window.location.host) ? '_self' : '_blank'} rel="noreferrer">
            {p.includes('?product=') ? 'Open product' : p.includes('?invoice=') ? 'Open invoice' : p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

export function ChatPanel({ mode, storeName, onClose, tall = false }: { mode: 'customer' | 'admin'; storeName: string; onClose?: () => void; tall?: boolean }) {
  const storeKey = `ai_chat_${mode}`;
  const hello: Msg = {
    role: 'assistant',
    content: mode === 'customer'
      ? `Assalam o Alaikum! Main ${storeName} ka assistant hoon. Product, qeemat, size, delivery charges ya apne order ke baare mein poochiye.`
      : 'Assalam o Alaikum! Main aapka admin assistant hoon. Sale, orders, payments, stock aur qeemat ke baare mein poochiye, ya kaam bataiye (jaise "SK-261022-1005 ko Shipped kar do").'
  };
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try { const s = sessionStorage.getItem(storeKey); if (s) return JSON.parse(s); } catch { /* ignore */ }
    return [hello];
  });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { sessionStorage.setItem(storeKey, JSON.stringify(msgs.slice(-30))); } catch { /* ignore */ }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs]);

  const quick = mode === 'customer'
    ? ['Best sellers kya hain?', 'Lahore ki delivery kitni hai?', 'Mera order kahan hai?']
    : ['Aaj ki sale', 'Pending orders dikhao', 'Kam stock wale products', 'Online payments jo check karni hain'];

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: question }];
    setMsgs(next);
    setText('');
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { mode, messages: next.filter((m, i) => !(i === 0 && m.role === 'assistant')), site_url: window.location.origin }
      });
      const reply = error
        ? 'The assistant is not available right now. Please try again later.'
        : (data && (data.reply || data.error)) || '...';
      setMsgs(m => [...m, { role: 'assistant', content: reply }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`bg-white flex flex-col overflow-hidden ${tall ? 'h-[70vh] min-h-[420px] rounded-xl border' : 'h-full'}`}>
      <div className="bg-amber-600 text-white px-4 py-3 flex items-center gap-2 shrink-0">
        <Sparkles className="w-5 h-5" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">{mode === 'customer' ? `${storeName} Assistant` : 'AI Admin Assistant'}</p>
          <p className="text-[10px] text-white/80 leading-tight">AI can make mistakes - please check important details</p>
        </div>
        <button onClick={() => { setMsgs([hello]); }} className="text-[11px] underline text-white/90 cursor-pointer">New chat</button>
        {onClose && <button onClick={onClose} className="p-1 cursor-pointer" aria-label="Close chat"><X className="w-5 h-5" /></button>}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-amber-600 text-white rounded-br-sm' : 'bg-white border text-slate-800 rounded-bl-sm'}`}>
              <Linkify text={m.content} />
            </div>
          </div>
        ))}
        {busy && <div className="text-xs text-slate-500 px-2">Typing...</div>}
        {msgs.length <= 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {quick.map(q => (
              <button key={q} onClick={() => send(q)} className="text-xs bg-white border border-amber-300 text-amber-800 px-2.5 py-1 rounded-full cursor-pointer">{q}</button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2 p-2 border-t shrink-0">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={mode === 'customer' ? 'Apna sawal likhiye...' : 'Kaam ya sawal likhiye...'}
          className="flex-1 min-w-0 px-3 py-2 border rounded-full text-sm focus:outline-none focus:border-amber-500"
        />
        <button disabled={busy || !text.trim()} className="bg-amber-600 text-white text-sm font-bold px-4 rounded-full disabled:opacity-50 cursor-pointer">Send</button>
      </form>
    </div>
  );
}

// Floating chat button for shoppers
export default function AiChatBubble({ storeName, raised = false }: { storeName: string; raised?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div className="fixed z-[60] inset-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-96 sm:h-[560px] sm:rounded-2xl sm:shadow-2xl sm:border overflow-hidden">
          <ChatPanel mode="customer" storeName={storeName} onClose={() => setOpen(false)} />
        </div>
      )}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={`fixed z-[45] right-4 ${raised ? 'bottom-20' : 'bottom-5'} sm:bottom-5 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-xl pl-3 pr-4 py-3 flex items-center gap-2 cursor-pointer`}
          aria-label="Chat with us"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-bold">Chat</span>
        </button>
      )}
    </>
  );
}
