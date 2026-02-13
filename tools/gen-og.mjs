#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

await page.setContent(`
<html><head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@700;900&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    background: #E85D3A;
    font-family: 'Inter', system-ui, sans-serif;
    display: flex;
    align-items: center;
    padding: 0 80px;
    position: relative;
    overflow: hidden;
  }
  /* Subtle texture */
  body::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 30% 50%, rgba(255,255,255,0.12) 0%, transparent 60%),
                radial-gradient(ellipse at 80% 80%, rgba(0,0,0,0.08) 0%, transparent 50%);
  }
  .content { position: relative; z-index: 1; }
  .icon-row {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-bottom: 24px;
  }
  .title {
    font-size: 96px;
    font-weight: 900;
    color: #fff;
    letter-spacing: -0.03em;
    line-height: 1;
  }
  .tagline {
    font-size: 36px;
    font-weight: 700;
    color: rgba(255,255,255,0.85);
    margin-top: 16px;
  }
  .sub {
    font-size: 24px;
    color: rgba(255,255,255,0.55);
    margin-top: 16px;
    letter-spacing: 0.02em;
  }
  .domain {
    position: absolute;
    bottom: 40px;
    right: 80px;
    font-size: 20px;
    font-weight: 700;
    color: rgba(255,255,255,0.4);
    letter-spacing: 0.03em;
  }
</style>
</head><body>
  <div class="content">
    <div class="icon-row">
      <svg width="88" height="88" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="22" y1="2" x2="22" y2="16" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
        <rect x="12" y="16" width="20" height="18" rx="6" fill="#fff"/>
        <rect x="16" y="22" width="12" height="6" rx="3" fill="#E85D3A" opacity="0.3"/>
        <circle cx="22" cy="40" r="2.5" fill="#fff" opacity="0.5"/>
      </svg>
      <div class="title">Pullcord</div>
    </div>
    <div class="tagline">Pull the cord. Catch your ride.</div>
    <div class="sub">Real-time MARTA bus tracking with live positions and ETA predictions</div>
  </div>
  <div class="domain">pullcord.home.jake.town</div>
</body></html>`);

// Wait for fonts to load
await page.waitForTimeout(1000);

const buf = await page.screenshot({ type: 'png' });
const { writeFileSync } = await import('fs');
writeFileSync('public/icons/og-image.png', buf);
console.log('✓ og-image.png (1200x630)');

await browser.close();
