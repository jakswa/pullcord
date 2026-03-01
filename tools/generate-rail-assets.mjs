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

  // Generate favicon (32x32)
  const favPage = await ctx.newPage();
  await favPage.setViewportSize({ width: 32, height: 32 });
  await favPage.setContent(iconHTML(32).replace(/border-radius:[^;]+;/, ''));
  await favPage.screenshot({ path: 'public/icons/rail-favicon.png', type: 'png' });
  await favPage.close();
  console.log('✓ rail-favicon.png');

  // Screenshot the actual rail page for OG image
  const screenshotPage = await ctx.newPage();
  await screenshotPage.setViewportSize({ width: 390, height: 844 }); // iPhone viewport
  await screenshotPage.goto('http://0.0.0.0:4200/rail', { waitUntil: 'networkidle', timeout: 15000 });
  // Wait for data to load
  await screenshotPage.waitForTimeout(2000);
  const phoneShot = await screenshotPage.screenshot({ type: 'png' });
  await screenshotPage.close();
  console.log('✓ phone screenshot captured');

  // Compose OG image: dark bg + zoomed/cropped phone screenshot
  const ogPage = await ctx.newPage();
  await ogPage.setViewportSize({ width: OG_WIDTH, height: OG_HEIGHT });

  // Convert screenshot to base64 for embedding
  const b64 = Buffer.from(phoneShot).toString('base64');

  await ogPage.setContent(`
<html>
<body style="margin:0; width:${OG_WIDTH}px; height:${OG_HEIGHT}px; background:#0f0f0f; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; overflow:hidden; position:relative;">
  <!-- Line color bar at top -->
  <div style="position:absolute; top:0; left:0; right:0; height:5px; display:flex; z-index:10;">
    <div style="flex:1; background:#E05555;"></div>
    <div style="flex:1; background:#D4A020;"></div>
    <div style="flex:1; background:#4A9FE5;"></div>
    <div style="flex:1; background:#3BAA6E;"></div>
  </div>

  <!-- Phone screenshot, zoomed and cropped, right side -->
  <div style="position:absolute; right:-20px; top:50%; transform:translateY(-50%); width:420px; height:700px; border-radius:24px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.5); border:2px solid rgba(255,255,255,0.08);">
    <img src="data:image/png;base64,${b64}" style="width:100%; height:100%; object-fit:cover; object-position:top center;" />
  </div>

  <!-- Left side text content -->
  <div style="position:absolute; left:80px; top:50%; transform:translateY(-50%); max-width:620px;">
    <div style="font-size:20px; font-weight:500; color:rgba(255,255,255,0.4); letter-spacing:2px; text-transform:lowercase; margin-bottom:12px;">marta.io</div>
    <div style="font-size:64px; font-weight:700; color:#fff; letter-spacing:-1px; line-height:1.1; margin-bottom:16px;">Real-time<br/>rail arrivals</div>
    <div style="font-size:24px; color:rgba(255,255,255,0.5); line-height:1.4;">All 38 stations · Live data<br/>No app download required</div>

    <!-- Line pills -->
    <div style="display:flex; gap:10px; margin-top:28px;">
      <div style="background:#E05555; color:#fff; font-weight:700; font-size:15px; padding:6px 14px; border-radius:8px;">RED</div>
      <div style="background:#D4A020; color:#fff; font-weight:700; font-size:15px; padding:6px 14px; border-radius:8px;">GOLD</div>
      <div style="background:#4A9FE5; color:#fff; font-weight:700; font-size:15px; padding:6px 14px; border-radius:8px;">BLUE</div>
      <div style="background:#3BAA6E; color:#fff; font-weight:700; font-size:15px; padding:6px 14px; border-radius:8px;">GREEN</div>
    </div>
  </div>

  <!-- Disclaimer -->
  <div style="position:absolute; bottom:16px; left:80px; font-size:13px; color:rgba(255,255,255,0.2);">beta.marta.io · Not affiliated with MARTA</div>
</body>
</html>`);

  await ogPage.screenshot({ path: 'public/icons/og-rail.png', type: 'png' });
  await ogPage.close();
  console.log('✓ og-rail.png');

  await browser.close();
}

main().catch(console.error);
