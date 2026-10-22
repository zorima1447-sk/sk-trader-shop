// ---------------------------------------------------------------------------
// Brand logos: removes the plain background around a logo (white, black or any
// single colour touching the edges) and trims the empty space, so every logo
// sits cleanly on the page like on big beauty shops. Done in the browser, the
// result is remembered so it runs only once per logo.
// ---------------------------------------------------------------------------

const cache = new Map<string, Promise<string>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

async function process(src: string): Promise<string> {
  const img = await loadImage(src);
  const scale = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h); // throws if the image does not allow it (then the original is shown)
  const px = data.data;

  // 1. background colour = the most common colour on the outer edge
  const counts = new Map<string, { n: number; r: number; g: number; b: number }>();
  let edge = 0;
  let transparentEdge = 0;
  const visit = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    edge++;
    if (px[i + 3] < 20) { transparentEdge++; return; }
    const key = `${px[i] >> 4},${px[i + 1] >> 4},${px[i + 2] >> 4}`;
    const c = counts.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    c.n++; c.r += px[i]; c.g += px[i + 1]; c.b += px[i + 2];
    counts.set(key, c);
  };
  for (let x = 0; x < w; x++) { visit(x, 0); visit(x, h - 1); }
  for (let y = 0; y < h; y++) { visit(0, y); visit(w - 1, y); }

  let best: { n: number; r: number; g: number; b: number } | null = null;
  counts.forEach((c) => { if (!best || c.n > best.n) best = c; });

  // 2. flood-fill the background from the edges and make it see-through
  if (best && transparentEdge < edge * 0.5 && (best as any).n > edge * 0.35) {
    const b = best as { n: number; r: number; g: number; b: number };
    const br = b.r / b.n, bg = b.g / b.n, bb = b.b / b.n;
    const TOL = 60, SOFT = 95;
    const dist = (i: number) => Math.sqrt((px[i] - br) ** 2 + (px[i + 1] - bg) ** 2 + (px[i + 2] - bb) ** 2);
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    const push = (x: number, y: number) => {
      const p = y * w + x;
      if (seen[p]) return;
      seen[p] = 1;
      stack.push(p);
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      const p = stack.pop() as number;
      const i = p * 4;
      const d = dist(i);
      if (d > SOFT) continue; // part of the logo: stop here
      // soft edge: half-way colours become half see-through (smooth outline)
      px[i + 3] = d <= TOL ? 0 : Math.min(px[i + 3], Math.round(((d - TOL) / (SOFT - TOL)) * 255));
      if (d > TOL) continue;
      const x = p % w, y = (p - x) / w;
      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < h - 1) push(x, y + 1);
    }
    // remove left-over specks (faint pixels) so trimming works well
    for (let i = 3; i < px.length; i += 4) if (px[i] < 70) px[i] = 0;
    // a light logo that sat on a dark box would be invisible on the white page: make it dark
    const bgLum = 0.299 * br + 0.587 * bg + 0.114 * bb;
    if (bgLum < 90) {
      let sum = 0, cnt = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] > 200) { sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; cnt++; }
      }
      if (cnt && sum / cnt > 140) {
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] > 0) {
            const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            const v = Math.round(255 - l); // light -> dark, keeps the details
            px[i] = v; px[i + 1] = v; px[i + 2] = v;
          }
        }
      }
    }
    ctx.putImageData(data, 0, 0);
  }

  // 3. trim the empty space around the logo
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 120) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return src; // nothing left - keep the original
  const pad = 2;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  const octx = out.getContext('2d');
  if (!octx) return src;
  octx.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

export function cleanLogo(src: string): Promise<string> {
  if (!src) return Promise.resolve('');
  let p = cache.get(src);
  if (!p) {
    p = process(src).catch(() => src);
    cache.set(src, p);
  }
  return p;
}

