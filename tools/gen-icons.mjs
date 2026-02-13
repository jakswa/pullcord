#!/usr/bin/env node
// Generate PWA icons from pullcord SVG
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const sizes = [192, 512];
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44">
  <line x1="22" y1="2" x2="22" y2="16" stroke="#E85D3A" stroke-width="3" stroke-linecap="round"/>
  <rect x="12" y="16" width="20" height="18" rx="6" fill="#E85D3A"/>
  <rect x="16" y="22" width="12" height="6" rx="3" fill="#fff" opacity="0.3"/>
  <circle cx="22" cy="40" r="2" fill="#F0A030" opacity="0.6"/>
</svg>`;

const browser = await chromium.launch({ headless: true });

for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  
  // Regular icon: SVG on cream background
  await page.setContent(`<html><body style="margin:0;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:#FDF8F2">
    <div style="width:${Math.floor(size*0.6)}px;height:${Math.floor(size*0.6)}px">${svgContent}</div>
  </body></html>`);
  const buf = await page.screenshot({ type: 'png' });
  writeFileSync(`public/icons/icon-${size}.png`, buf);
  console.log(`✓ icon-${size}.png`);
  
  // Maskable icon: more padding, solid bg
  await page.setContent(`<html><body style="margin:0;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:#E85D3A">
    <div style="width:${Math.floor(size*0.45)}px;height:${Math.floor(size*0.45)}px">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44">
        <line x1="22" y1="2" x2="22" y2="16" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
        <rect x="12" y="16" width="20" height="18" rx="6" fill="#fff"/>
        <rect x="16" y="22" width="12" height="6" rx="3" fill="#E85D3A" opacity="0.3"/>
        <circle cx="22" cy="40" r="2" fill="#F0A030" opacity="0.6"/>
      </svg>
    </div>
  </body></html>`);
  const maskBuf = await page.screenshot({ type: 'png' });
  writeFileSync(`public/icons/icon-maskable-${size}.png`, maskBuf);
  console.log(`✓ icon-maskable-${size}.png`);
  
  await page.close();
}

await browser.close();
console.log('Done!');
