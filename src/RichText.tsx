import React, { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Product description with formatting (bold, italic, underline, size, colours,
// lists, alignment). The text is saved as a small piece of HTML in the
// "description" column. Old plain-text descriptions keep working.
// Everything is cleaned before saving and before showing, so only safe
// formatting can ever reach the shop page.
// ---------------------------------------------------------------------------

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'BR', 'P', 'DIV', 'SPAN', 'FONT', 'UL', 'OL', 'LI', 'H2', 'H3', 'A', 'IMG', 'BLOCKQUOTE', 'HR']);
// links: web pages, email, phone and pages of this shop only
const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;
const SAFE_SRC = /^(https:\/\/|\/(?!\/))/i;
const ALLOWED_STYLES = ['color', 'background-color', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'text-align'];
const FONT_SIZE_MAP: Record<string, string> = { '1': '11px', '2': '13px', '3': '15px', '4': '18px', '5': '22px', '6': '28px', '7': '36px' };

const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const isHtml = (t: string) => /<\/?(b|strong|i|em|u|s|br|p|div|span|font|ul|ol|li|h2|h3|a|img|blockquote|hr)\b/i.test(t || '');

// Old plain text -> HTML (keeps the line breaks)
export function toHtml(text: string): string {
  if (!text) return '';
  return isHtml(text) ? text : escapeHtml(text).replace(/\n/g, '<br>');
}

// Plain text of a description (for search, emails, the AI assistant)
export function htmlToText(html: string): string {
  if (!html || !isHtml(html)) return html || '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h2|h3)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanStyle(style: string): string {
  const out: string[] = [];
  style.split(';').forEach((rule) => {
    const i = rule.indexOf(':');
    if (i < 0) return;
    const prop = rule.slice(0, i).trim().toLowerCase();
    const val = rule.slice(i + 1).trim();
    if (!ALLOWED_STYLES.includes(prop)) return;
    if (!/^[#a-z0-9.,%() \-]+$/i.test(val) || /url|expression|javascript/i.test(val)) return;
    out.push(`${prop}: ${val}`);
  });
  return out.join('; ');
}

function cleanNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as HTMLElement;
  const tag = el.tagName.toUpperCase();
  if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE'].includes(tag)) return null;

  let out: HTMLElement | DocumentFragment;
  if (!ALLOWED_TAGS.has(tag)) {
    out = doc.createDocumentFragment(); // keep the text, drop the unknown tag
  } else if (tag === 'FONT') {
    const span = doc.createElement('span');
    const styles: string[] = [];
    const c = el.getAttribute('color');
    if (c && /^#?[a-z0-9]+$/i.test(c)) styles.push(`color: ${c}`);
    const z = el.getAttribute('size');
    if (z && FONT_SIZE_MAP[z]) styles.push(`font-size: ${FONT_SIZE_MAP[z]}`);
    const extra = cleanStyle(el.getAttribute('style') || '');
    if (extra) styles.push(extra);
    if (styles.length) span.setAttribute('style', styles.join('; '));
    out = span;
  } else if (tag === 'IMG') {
    const src = (el.getAttribute('src') || '').trim();
    if (!SAFE_SRC.test(src)) return null;
    const img = doc.createElement('img');
    img.setAttribute('src', src);
    img.setAttribute('alt', (el.getAttribute('alt') || '').slice(0, 200));
    img.setAttribute('loading', 'lazy');
    return img;
  } else if (tag === 'A') {
    const href = (el.getAttribute('href') || '').trim();
    if (!SAFE_HREF.test(href)) {
      out = doc.createDocumentFragment();
    } else {
      const a = doc.createElement('a');
      a.setAttribute('href', href);
      if (/^https?:/i.test(href) && !/^https?:\/\/(www\.)?sktraderpk\.com/i.test(href)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
      out = a;
    }
  } else {
    const copy = doc.createElement(tag.toLowerCase());
    const st = cleanStyle(el.getAttribute('style') || '');
    if (st) copy.setAttribute('style', st);
    const align = el.getAttribute('align');
    if (align && /^(left|right|center|justify)$/i.test(align)) copy.setAttribute('style', [st, `text-align: ${align}`].filter(Boolean).join('; '));
    out = copy;
  }
  el.childNodes.forEach((ch) => {
    const c = cleanNode(ch, doc);
    if (c) out.appendChild(c);
  });
  return out;
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return escapeHtml(htmlToText(html));
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';
  const box = doc.createElement('div');
  root.childNodes.forEach((ch) => {
    const c = cleanNode(ch, doc);
    if (c) box.appendChild(c);
  });
  const res = box.innerHTML.trim();
  // an "empty" editor still leaves <br> or empty blocks behind
  return htmlToText(res).trim() || /<img\b/i.test(res) ? res : '';
}

// ---------------- shop page ----------------
export function RichTextView({ text, className = '' }: { text: string; className?: string }) {
  return <div className={`rich-text ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(toHtml(text)) }} />;
}

// ---------------- admin editor ----------------
export const COLOR_SWATCHES = [
  '#000000', '#334155', '#64748b', '#ffffff', '#ef4444', '#dc2626', '#f97316', '#f59e0b',
  '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#92400e', '#7c2d12'
];

const SIZES: { label: string; value: string }[] = [
  { label: 'Small', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Large', value: '4' },
  { label: 'Extra large', value: '5' },
  { label: 'Huge', value: '6' },
  { label: 'Giant', value: '7' }
];

export function RichTextEditor({ value, onChange, placeholder, article, onUploadImage }: {
  value: string; onChange: (html: string) => void; placeholder?: string;
  article?: boolean;                                   // blog / page editor: headings, links, pictures, product box
  onUploadImage?: (file: File) => Promise<string>;     // returns the picture's web address
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string>('');
  const saved = useRef<Range | null>(null);
  const [colorOpen, setColorOpen] = useState<'' | 'text' | 'mark'>('');
  const [custom, setCustom] = useState('#e11d48');
  const [, force] = useState(0);

  // load a product's text into the editor (only when it really changed from outside)
  useEffect(() => {
    if (!ref.current) return;
    if (value === last.current) return;
    const html = sanitizeHtml(toHtml(value || ''));
    ref.current.innerHTML = html;
    last.current = value;
  }, [value]);

  const emit = () => {
    if (!ref.current) return;
    const html = sanitizeHtml(ref.current.innerHTML);
    last.current = html;
    onChange(html);
    force((n) => n + 1);
  };

  const keepSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current && ref.current.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    if (!ref.current) return;
    ref.current.focus();
    const sel = window.getSelection();
    if (sel && saved.current) { sel.removeAllRanges(); sel.addRange(saved.current); }
  };

  const cmd = (name: string, arg?: string) => {
    restoreSelection();
    try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* old browsers */ }
    document.execCommand(name, false, arg);
    keepSelection();
    emit();
  };

  const active = (name: string) => {
    try { return document.queryCommandState(name); } catch { return false; }
  };

  const btn = (label: React.ReactNode, title: string, onClick: () => void, on = false, extra = '') => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`min-w-[2rem] h-8 px-2 rounded-lg text-sm flex items-center justify-center cursor-pointer ${on ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'} ${extra}`}
    >
      {label}
    </button>
  );

  const palette = (mode: 'text' | 'mark') => (
    <div className="absolute z-30 top-full left-0 mt-1 bg-white border rounded-xl shadow-2xl p-3 w-64" onMouseDown={(e) => e.preventDefault()}>
      <p className="text-[11px] font-bold text-slate-500 mb-2">{mode === 'text' ? 'Text colour' : 'Highlight colour'}</p>
      <div className="grid grid-cols-8 gap-1.5">
        {COLOR_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { cmd(mode === 'text' ? 'foreColor' : 'hiliteColor', c); setColorOpen(''); }}
            className="w-6 h-6 rounded-md border border-slate-300 cursor-pointer"
            style={{ background: c }}
            aria-label={c}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <input type="color" value={custom} onChange={(e) => setCustom(e.target.value)} className="w-9 h-8 p-0 border rounded cursor-pointer" aria-label="Any colour" />
        <button type="button" onClick={() => { cmd(mode === 'text' ? 'foreColor' : 'hiliteColor', custom); setColorOpen(''); }} className="flex-1 text-xs font-bold bg-slate-900 text-white rounded-lg py-1.5 cursor-pointer">
          Use this colour
        </button>
      </div>
      {mode === 'mark' && (
        <button type="button" onClick={() => { cmd('hiliteColor', 'transparent'); setColorOpen(''); }} className="w-full mt-2 text-[11px] text-slate-500 underline cursor-pointer">No highlight</button>
      )}
    </div>
  );

  const empty = !htmlToText(value || '').trim() && !/<img\b/i.test(value || '');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const addLink = () => {
    keepSelection();
    const url = window.prompt('Link address (e.g. https://www.sktraderpk.com/blog or /about):', 'https://');
    if (!url || !SAFE_HREF.test(url.trim())) return;
    cmd('createLink', url.trim());
  };
  const addProducts = () => {
    keepSelection();
    const kw = window.prompt('Product box: type words of the products to show (e.g. shampoo, mask). Optional: add | and a heading.', 'shampoo, mask | Recommended for you');
    if (!kw || !kw.trim()) return;
    restoreSelection();
    document.execCommand('insertParagraph');
    document.execCommand('insertText', false, `[[products: ${kw.trim().replace(/\]/g, '')}]]`);
    document.execCommand('insertParagraph');
    keepSelection();
    emit();
  };
  const addVideo = () => {
    keepSelection();
    const url = window.prompt('YouTube video link (e.g. https://youtu.be/xxxx or https://www.youtube.com/watch?v=xxxx):', 'https://');
    if (!url || !/(youtube\.com|youtu\.be)\//i.test(url)) return;
    restoreSelection();
    document.execCommand('insertParagraph');
    document.execCommand('insertText', false, `[[youtube: ${url.trim().replace(/\]/g, '')}]]`);
    document.execCommand('insertParagraph');
    keepSelection();
    emit();
  };
  const pickImage = async (f: File | undefined) => {
    if (!f || !onUploadImage) return;
    setUploading(true);
    try {
      const url = await onUploadImage(f);
      if (url) cmd('insertImage', url);
    } catch (e: any) {
      window.alert('Picture could not be uploaded: ' + (e?.message || e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="border rounded-xl bg-white focus-within:border-amber-500">
      <div className="flex flex-wrap items-center gap-1 p-1.5 border-b bg-slate-50 rounded-t-xl relative">
        {btn(<b>B</b>, 'Bold', () => cmd('bold'), active('bold'))}
        {btn(<i className="font-serif">I</i>, 'Italic', () => cmd('italic'), active('italic'))}
        {btn(<u>U</u>, 'Underline', () => cmd('underline'), active('underline'))}
        {btn(<s>S</s>, 'Strike through', () => cmd('strikeThrough'), active('strikeThrough'))}
        <span className="w-px h-6 bg-slate-200 mx-0.5" />
        <select
          title="Text size"
          aria-label="Text size"
          defaultValue=""
          onMouseDown={keepSelection}
          onChange={(e) => { if (e.target.value) cmd('fontSize', e.target.value); e.target.value = ''; }}
          className="h-8 px-2 border border-slate-200 rounded-lg text-xs bg-white cursor-pointer"
        >
          <option value="">Size</option>
          {SIZES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
        </select>
        <div className="relative">
          {btn(<span className="flex flex-col items-center leading-none"><span className="font-bold">A</span><span className="w-4 h-1 rounded-sm mt-0.5" style={{ background: 'linear-gradient(90deg,#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7)' }} /></span>, 'Text colour', () => { keepSelection(); setColorOpen(colorOpen === 'text' ? '' : 'text'); })}
          {colorOpen === 'text' && palette('text')}
        </div>
        <div className="relative">
          {btn(<span className="px-1 rounded bg-yellow-200 text-xs font-bold">ab</span>, 'Highlight', () => { keepSelection(); setColorOpen(colorOpen === 'mark' ? '' : 'mark'); })}
          {colorOpen === 'mark' && palette('mark')}
        </div>
        <span className="w-px h-6 bg-slate-200 mx-0.5" />
        {btn('• List', 'Bullet list', () => cmd('insertUnorderedList'), active('insertUnorderedList'), 'text-xs')}
        {btn('1. List', 'Numbered list', () => cmd('insertOrderedList'), active('insertOrderedList'), 'text-xs')}
        <span className="w-px h-6 bg-slate-200 mx-0.5" />
        {btn('⇤', 'Align left', () => cmd('justifyLeft'))}
        {btn('↔', 'Align centre', () => cmd('justifyCenter'))}
        {btn('⇥', 'Align right', () => cmd('justifyRight'))}
        {btn('Clear', 'Remove formatting', () => cmd('removeFormat'), false, 'text-xs')}
        {article && (
          <>
            <span className="w-px h-6 bg-slate-200 mx-0.5" />
            {btn('H2', 'Heading', () => cmd('formatBlock', 'H2'), false, 'text-xs font-black')}
            {btn('H3', 'Small heading', () => cmd('formatBlock', 'H3'), false, 'text-xs font-bold')}
            {btn('¶', 'Normal text', () => cmd('formatBlock', 'P'), false, 'text-xs')}
            {btn('🔗 Link', 'Add a link to the selected text', addLink, false, 'text-xs')}
            {onUploadImage && btn(uploading ? '…' : '🖼 Picture', 'Add a picture here', () => { keepSelection(); fileRef.current?.click(); }, false, 'text-xs')}
            {btn('🛍 Products', 'Add a product box here', addProducts, false, 'text-xs')}
            {btn('▶ YouTube', 'Add a YouTube video here', addVideo, false, 'text-xs')}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
          </>
        )}
      </div>
      <div className="relative">
        {empty && placeholder && <div className="absolute top-2.5 left-3.5 text-sm text-slate-400 pointer-events-none">{placeholder}</div>}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onKeyUp={keepSelection}
          onMouseUp={() => { keepSelection(); force((n) => n + 1); }}
          onBlur={keepSelection}
          onPaste={(e) => {
            // paste as plain text so no strange formatting comes in from other websites
            e.preventDefault();
            const t = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, t);
          }}
          className={`rich-text ${article ? 'article-text min-h-[20rem] max-h-[40rem]' : 'min-h-[8rem] max-h-[24rem]'} overflow-y-auto px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none`}
        />
      </div>
      <p className="text-[10px] text-slate-400 px-3 pb-2">Select text, then press B / I / U, choose a size or a colour.</p>
    </div>
  );
}
