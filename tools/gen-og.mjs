#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

await page.setContent(`<html><body style="margin:0;display:flex;align-items:center;justify-content:center;width:1200px;height:630px;background:linear-gradient(135deg,#FDF8F2 0%,#FFF5EB 50%,#F7EFE5 100%);font-family:system-ui,sans-serif">
  <div style="text-align:center">
    <svg width="80" height="80" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="22" y1="2" x2="22" y2="16" stroke="#E85D3A" stroke-width="3" stroke-linecap="round"/>
      <rect x="12" y="16" width="20" height="18" rx="6" fill="#E85D3A"/>
      <rect x="16" y="22" width="12" height="6" rx="3" fill="#fff" opacity="0.3"/>
      <circle cx="22" cy="40" r="2" fill="#F0A030" opacity="0.6"/>
    </svg>
    <div style="font-size:72px;font-weight:800;color:#3B2820;letter-spacing:-0.03em;margin-top:16px">Pullcord</div>
    <div style="font-size:28px;color:#A89282;margin-top:8px">Pull the cord. Catch your ride.</div>
    <div style="font-size:18px;color:#D4C4B4;margin-top:24px">Real-time MARTA bus tracking</div>
  </div>
</body></html>`);

const buf = await page.screenshot({ type: 'png' });
const { writeFileSync } = await import('fs');
writeFileSync('public/icons/og-image.png', buf);
console.log('✓ og-image.png (1200x630)');

await browser.close();
