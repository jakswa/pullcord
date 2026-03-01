// Generate rail PWA icons + OG image via Playwright
import { chromium } from 'playwright-core';

const ICON_SIZES = [192, 512];
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const iconHTML = (size) => `
<html>
<body style="margin:0; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center; background:#1a1a2e; border-radius:${Math.round(size * 0.18)}px; overflow:hidden;">
  <svg width="${Math.round(size * 0.55)}" height="${Math.round(size * 0.55)}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Train body -->
    <rect x="14" y="8" width="36" height="40" rx="8" fill="#e8e8e8"/>
    <!-- Window -->
    <rect x="20" y="14" width="24" height="14" rx="3" fill="#1a1a2e"/>
    <!-- Line color stripes -->
    <rect x="20" y="16" width="5" height="10" rx="1" fill="#E05555" opacity="0.9"/>
    <rect x="27" y="16" width="5" height="10" rx="1" fill="#D4A020" opacity="0.9"/>
    <rect x="34" y="16" width="5" height="10" rx="1" fill="#4A9FE5" opacity="0.9"/>
    <rect x="41" y="16" width="2" height="10" rx="1" fill="#3BAA6E" opacity="0.9"/>
    <!-- Lower body detail -->
    <rect x="22" y="34" width="8" height="4" rx="2" fill="#aaa"/>
    <rect x="34" y="34" width="8" height="4" rx="2" fill="#aaa"/>
    <!-- Wheels/rails -->
    <rect x="10" y="50" width="44" height="3" rx="1.5" fill="#666"/>
    <circle cx="22" cy="50" r="4" fill="#888"/>
    <circle cx="22" cy="50" r="2" fill="#555"/>
    <circle cx="42" cy="50" r="4" fill="#888"/>
    <circle cx="42" cy="50" r="2" fill="#555"/>
    <!-- Headlight -->
    <circle cx="32" cy="43" r="2.5" fill="#FFD700" opacity="0.8"/>
  </svg>
</body>
</html>`;

const ogHTML = `
<html>
<body style="margin:0; width:${OG_WIDTH}px; height:${OG_HEIGHT}px; background:#1a1a2e; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; overflow:hidden; position:relative;">
  <!-- Subtle grid lines -->
  <div style="position:absolute; inset:0; opacity:0.04; background-image: repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 60px), repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 60px);"></div>
  
  <!-- Line color bar at top -->
  <div style="position:absolute; top:0; left:0; right:0; height:6px; display:flex;">
    <div style="flex:1; background:#E05555;"></div>
    <div style="flex:1; background:#D4A020;"></div>
    <div style="flex:1; background:#4A9FE5;"></div>
    <div style="flex:1; background:#3BAA6E;"></div>
  </div>

  <!-- Train icon -->
  <svg width="80" height="80" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:24px; opacity:0.9;">
    <rect x="14" y="8" width="36" height="40" rx="8" fill="#e8e8e8"/>
    <rect x="20" y="14" width="24" height="14" rx="3" fill="#1a1a2e"/>
    <rect x="20" y="16" width="5" height="10" rx="1" fill="#E05555" opacity="0.9"/>
    <rect x="27" y="16" width="5" height="10" rx="1" fill="#D4A020" opacity="0.9"/>
    <rect x="34" y="16" width="5" height="10" rx="1" fill="#4A9FE5" opacity="0.9"/>
    <rect x="41" y="16" width="2" height="10" rx="1" fill="#3BAA6E" opacity="0.9"/>
    <rect x="22" y="34" width="8" height="4" rx="2" fill="#aaa"/>
    <rect x="34" y="34" width="8" height="4" rx="2" fill="#aaa"/>
    <rect x="10" y="50" width="44" height="3" rx="1.5" fill="#666"/>
    <circle cx="22" cy="50" r="4" fill="#888"/>
    <circle cx="22" cy="50" r="2" fill="#555"/>
    <circle cx="42" cy="50" r="4" fill="#888"/>
    <circle cx="42" cy="50" r="2" fill="#555"/>
    <circle cx="32" cy="43" r="2.5" fill="#FFD700" opacity="0.8"/>
  </svg>

  <div style="font-size:72px; font-weight:700; letter-spacing:-2px; margin-bottom:8px;">MARTA Rail</div>
  <div style="font-size:28px; font-weight:400; color:rgba(255,255,255,0.6); margin-bottom:32px;">Real-time arrivals for all 38 stations</div>
  
  <!-- Fake station row preview -->
  <div style="display:flex; gap:16px; align-items:center; background:rgba(255,255,255,0.06); border-radius:12px; padding:16px 32px; border:1px solid rgba(255,255,255,0.08);">
    <div style="display:flex; gap:8px; align-items:center;">
      <div style="background:#E05555; color:#fff; font-weight:700; font-size:16px; padding:4px 10px; border-radius:6px;">N</div>
      <div style="background:#E05555; color:#fff; font-size:14px; padding:2px 8px; border-radius:4px;">RED</div>
      <span style="font-size:20px; color:rgba(255,255,255,0.8); margin-left:4px;">North Springs</span>
    </div>
    <span style="font-size:28px; font-weight:600; font-variant-numeric:tabular-nums; margin-left:auto;">3 min</span>
  </div>

  <!-- Domain -->
  <div style="position:absolute; bottom:24px; font-size:20px; color:rgba(255,255,255,0.3); letter-spacing:1px;">beta.marta.io</div>
</body>
</html>`;

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });

  // Generate icons
  for (const size of ICON_SIZES) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(iconHTML(size));
    await page.screenshot({ path: `public/icons/rail-${size}.png`, type: 'png' });
    await page.close();
    console.log(`✓ rail-${size}.png`);
  }

  // Generate OG image
  const ogPage = await ctx.newPage();
  await ogPage.setViewportSize({ width: OG_WIDTH, height: OG_HEIGHT });
  await ogPage.setContent(ogHTML);
  await ogPage.screenshot({ path: 'public/icons/og-rail.png', type: 'png' });
  await ogPage.close();
  console.log('✓ og-rail.png');

  // Generate favicon (32x32 from the 192 design, but with no border radius)
  const favPage = await ctx.newPage();
  await favPage.setViewportSize({ width: 32, height: 32 });
  await favPage.setContent(iconHTML(32).replace(`border-radius:${Math.round(32 * 0.18)}px;`, ''));
  await favPage.screenshot({ path: 'public/icons/rail-favicon.png', type: 'png' });
  await favPage.close();
  console.log('✓ rail-favicon.png');

  await browser.close();
}

main().catch(console.error);
