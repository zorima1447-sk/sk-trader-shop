import React from 'react';
import {
  Star, Sparkles, Truck, ShieldCheck, BadgeCheck, Heart, Gift, Tag, Percent, Phone, Clock,
  Flame, Zap, Crown, Leaf, ThumbsUp, CheckCircle2, Wallet, MessageCircle, Package
} from 'lucide-react';

// Icons the admin can pick for the scrolling strip (Settings > Website Look).
export const ICONS: Record<string, { label: string; C: any }> = {
  flame: { label: 'Flame / Hot', C: Flame },
  sparkles: { label: 'Sparkles', C: Sparkles },
  star: { label: 'Star', C: Star },
  badge: { label: 'Original badge', C: BadgeCheck },
  shield: { label: 'Shield', C: ShieldCheck },
  truck: { label: 'Delivery truck', C: Truck },
  wallet: { label: 'Wallet / Cash', C: Wallet },
  tag: { label: 'Price tag', C: Tag },
  percent: { label: 'Percent / Discount', C: Percent },
  gift: { label: 'Gift', C: Gift },
  heart: { label: 'Heart', C: Heart },
  crown: { label: 'Crown', C: Crown },
  zap: { label: 'Lightning', C: Zap },
  leaf: { label: 'Leaf / Natural', C: Leaf },
  thumbs: { label: 'Thumbs up', C: ThumbsUp },
  check: { label: 'Check', C: CheckCircle2 },
  clock: { label: 'Clock', C: Clock },
  phone: { label: 'Phone', C: Phone },
  chat: { label: 'Chat', C: MessageCircle },
  box: { label: 'Box', C: Package }
};

// A known icon name draws that icon; anything else (for example an emoji) is shown as text.
export function ShopIcon({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  if (!name) return null;
  const hit = ICONS[name];
  if (hit) {
    const C = hit.C;
    return <C className={className} />;
  }
  return <span className="leading-none">{name}</span>;
}
