import React, { useEffect, useState } from 'react';
import { cleanLogo } from './logoClean';

export type LogoTone = 'original' | 'dark' | 'light';

const toneFilter = (tone?: LogoTone) =>
  tone === 'dark' ? 'brightness(0)' : tone === 'light' ? 'brightness(0) invert(1)' : undefined;

// One brand logo, background removed (unless switched off), same height for every brand
export function BrandLogo({ src, alt, removeBg = true, tone = 'original', className = '' }: { src: string; alt: string; removeBg?: boolean; tone?: LogoTone; className?: string }) {
  const [shown, setShown] = useState<string>(removeBg ? '' : src);
  useEffect(() => {
    let alive = true;
    if (!removeBg) { setShown(src); return; }
    setShown('');
    cleanLogo(src).then((u) => { if (alive) setShown(u); });
    return () => { alive = false; };
  }, [src, removeBg]);
  if (!shown) return <span className={`inline-block ${className}`} />;
  return <img src={shown} alt={alt} loading="lazy" className={`object-contain ${className}`} style={{ filter: toneFilter(tone) }} />;
}
