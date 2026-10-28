import React from 'react';

// Small brand icons for the shop's social media links (top bar, footer, blog share)
type Net = 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'whatsapp';

const PATHS: Record<Net, string> = {
  facebook: 'M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9z',
  instagram: 'M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM21 8.3c-.1-1.5-.4-2.8-1.5-3.8C18.5 3.4 17.2 3.1 15.7 3c-1.5-.1-6-.1-7.5 0-1.5.1-2.8.4-3.8 1.5C3.4 5.5 3.1 6.8 3 8.3c-.1 1.5-.1 6 0 7.5.1 1.5.4 2.8 1.5 3.8 1 1 2.3 1.4 3.8 1.5 1.5.1 6 .1 7.5 0 1.5-.1 2.8-.4 3.8-1.5 1-1 1.4-2.3 1.5-3.8.1-1.5.1-6 0-7.5zm-2 9.1a3 3 0 0 1-1.7 1.7c-1.2.5-4 .4-5.3.4s-4.1.1-5.3-.4a3 3 0 0 1-1.7-1.7c-.5-1.2-.4-4-.4-5.3s-.1-4.1.4-5.3a3 3 0 0 1 1.7-1.7c1.2-.5 4-.4 5.3-.4s4.1-.1 5.3.4a3 3 0 0 1 1.7 1.7c.5 1.2.4 4 .4 5.3s.1 4.1-.4 5.3z',
  tiktok: 'M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9a7.4 7.4 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z',
  youtube: 'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z',
  whatsapp: 'M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zM20.5 3.5A11.8 11.8 0 0 0 1.9 17.7L.2 24l6.4-1.7A11.8 11.8 0 0 0 24 12a11.7 11.7 0 0 0-3.5-8.5z',
};

export const NET_LABEL: Record<Net, string> = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', whatsapp: 'WhatsApp' };
export const NET_COLOR: Record<Net, string> = { facebook: '#1877F2', instagram: '#E4405F', tiktok: '#000000', youtube: '#FF0000', whatsapp: '#25D366' };

export function BrandIcon({ net, className = 'w-4 h-4' }: { net: Net; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d={PATHS[net]} />
    </svg>
  );
}

const fixUrl = (u: string) => (/^https?:\/\//i.test(u.trim()) ? u.trim() : 'https://' + u.trim().replace(/^\/+/, ''));

// The shop's links (only the ones filled in Admin > Store Profile)
export function socialLinks(s: { facebook?: string; instagram?: string; tiktok?: string; youtube?: string; whatsapp?: string }, withWhatsapp = true) {
  const out: { net: Net; url: string }[] = [];
  if (s.facebook && s.facebook.trim()) out.push({ net: 'facebook', url: fixUrl(s.facebook) });
  if (s.instagram && s.instagram.trim()) out.push({ net: 'instagram', url: fixUrl(s.instagram) });
  if (s.tiktok && s.tiktok.trim()) out.push({ net: 'tiktok', url: fixUrl(s.tiktok) });
  if (s.youtube && s.youtube.trim()) out.push({ net: 'youtube', url: fixUrl(s.youtube) });
  const wa = String(s.whatsapp || '').replace(/\D/g, '');
  if (withWhatsapp && wa.length >= 10) out.push({ net: 'whatsapp', url: `https://wa.me/${wa}` });
  return out;
}

// Row of icons. style "plain": small icons in the text colour (top bar). "round": coloured circles (footer).
export function SocialRow({ links, variant = 'plain', className = '' }: { links: { net: Net; url: string }[]; variant?: 'plain' | 'round'; className?: string }) {
  if (!links.length) return null;
  return (
    <div className={`flex items-center ${variant === 'round' ? 'gap-2.5' : 'gap-2.5'} ${className}`}>
      {links.map((l) => (
        <a
          key={l.net}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          aria-label={NET_LABEL[l.net]}
          title={NET_LABEL[l.net]}
          className={variant === 'round'
            ? `w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm hover:scale-110 transition-transform ${l.net === 'tiktok' ? 'ring-1 ring-white/40' : ''}`
            : 'opacity-80 hover:opacity-100 transition-opacity'}
          style={variant === 'round' ? { background: NET_COLOR[l.net] } : undefined}
        >
          <BrandIcon net={l.net} className={variant === 'round' ? 'w-[18px] h-[18px]' : 'w-3.5 h-3.5'} />
        </a>
      ))}
    </div>
  );
}

// The shop's social icons straight from the settings. size "sm" = small plain icons (top bar), otherwise coloured circles (footer)
export function SocialIcons({ settings, size = 'md', className = '' }: { settings: any; size?: 'sm' | 'md'; className?: string }) {
  return <SocialRow links={socialLinks(settings)} variant={size === 'sm' ? 'plain' : 'round'} className={className} />;
}
