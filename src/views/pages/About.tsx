export const AboutPage = () => (
  <div class="about-shell">
    <div class="about-content">
      {/* Header */}
      <div class="about-header">
        <a href="/" class="about-back">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <div class="about-brand">
          <svg class="about-logo" width="32" height="32" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="22" y1="2" x2="22" y2="16" stroke="#E85D3A" stroke-width="3" stroke-linecap="round"/>
            <rect x="12" y="16" width="20" height="18" rx="6" fill="#E85D3A"/>
            <rect x="16" y="22" width="12" height="6" rx="3" fill="#fff" opacity="0.3"/>
            <circle cx="22" cy="40" r="2" fill="#F0A030" opacity="0.6"/>
          </svg>
          <span class="about-wordmark">Pullcord</span>
        </div>
      </div>

      {/* What is this */}
      <section class="about-section">
        <h2 class="about-h2">What is this?</h2>
        <p>Pullcord is a real-time MARTA bus tracker for Atlanta. It shows you where your bus is, how far away it is, and lets you set a "pull the cord" alert so you don't have to stare at your phone.</p>
        <p>It's built for the way people actually ride the bus — pick your stop, see what's coming, get a push notification when it's time to walk out the door.</p>
      </section>

      {/* How it was made */}
      <section class="about-section">
        <h2 class="about-h2">How it was made</h2>
        <p>This app was written almost entirely by an AI agent. Not "AI-assisted" — the architecture, data pipeline, UI design, and nearly every line of code was authored by <strong>Clatis</strong>, an AI running on <a href="https://openclaw.ai" class="about-link" target="_blank" rel="noopener">OpenClaw</a> (Claude under the hood).</p>
        <p>The human half is <strong>Jake</strong>, a web developer in Atlanta who's been maintaining <a href="https://marta.io" class="about-link" target="_blank" rel="noopener">marta.io</a> for over a decade. Jake directed the product — what to build, how it should feel, when something was wrong — and did QA on his phone while riding actual buses. Clatis did the rest.</p>
        <p>We're being upfront about this because you deserve to know. If AI-generated software isn't your thing, no hard feelings.</p>
      </section>

      {/* The numbers */}
      <section class="about-section">
        <h2 class="about-h2">By the numbers</h2>
        <div class="about-stats">
          <div class="about-stat">
            <span class="about-stat-number">63</span>
            <span class="about-stat-label">commits</span>
          </div>
          <div class="about-stat">
            <span class="about-stat-number">6k</span>
            <span class="about-stat-label">lines of code</span>
          </div>
          <div class="about-stat">
            <span class="about-stat-number">7</span>
            <span class="about-stat-label">dependencies</span>
          </div>
          <div class="about-stat">
            <span class="about-stat-number">118</span>
            <span class="about-stat-label">bus routes</span>
          </div>
          <div class="about-stat">
            <span class="about-stat-number">8,724</span>
            <span class="about-stat-label">stops</span>
          </div>
          <div class="about-stat">
            <span class="about-stat-number">~2M</span>
            <span class="about-stat-label">stop times</span>
          </div>
        </div>
      </section>

      {/* Stack */}
      <section class="about-section">
        <h2 class="about-h2">Stack</h2>
        <div class="about-stack">
          <span class="about-chip">Hono</span>
          <span class="about-chip">Bun</span>
          <span class="about-chip">SQLite</span>
          <span class="about-chip">Leaflet</span>
          <span class="about-chip">Tailwind v4</span>
          <span class="about-chip">GTFS-RT</span>
          <span class="about-chip">Web Push</span>
          <span class="about-chip">JSX (no React)</span>
        </div>
        <p class="about-muted">No bundler, no framework, no build step beyond Tailwind CSS. The client is vanilla JavaScript. The server renders JSX to HTML strings via Hono.</p>
      </section>

      {/* Privacy */}
      <section class="about-section">
        <h2 class="about-h2">Privacy</h2>
        <p>Pullcord doesn't track you.</p>
        <ul class="about-list">
          <li><strong>Location:</strong> Used client-side only to find nearby stops. Never sent to our server, never stored.</li>
          <li><strong>Push subscriptions:</strong> Stored in SQLite while your alert is active. Deleted the moment the notification fires.</li>
          <li><strong>Analytics:</strong> None. No cookies, no tracking pixels, no third-party scripts.</li>
          <li><strong>Favorites:</strong> Stored in your browser's localStorage. Never leaves your device.</li>
        </ul>
      </section>

      {/* Data */}
      <section class="about-section">
        <h2 class="about-h2">Data</h2>
        <p>Real-time bus positions and predictions come from <a href="https://www.itsmarta.com/MARTA-Developer-resources.aspx" class="about-link" target="_blank" rel="noopener">MARTA's GTFS-RT feeds</a>, updated every ~30 seconds. Stop locations, routes, and schedules come from MARTA's static GTFS data.</p>
        <p>ETAs for tracked buses are computed from vehicle GPS positions and scheduled inter-stop times — not MARTA's prediction feed, which has known accuracy issues.</p>
      </section>

      {/* Why "Pullcord" */}
      <section class="about-section">
        <h2 class="about-h2">Why "Pullcord"?</h2>
        <p>On a bus, you pull the cord when your stop is coming up. It's the one moment of agency in the whole ride — you're telling the bus <em>this is where I get off</em>.</p>
        <p>The app's "Pull the Cord" feature works the same way. Set an alert, put your phone away, and it'll buzz you when it's time to head to your stop. One tug, then you're free.</p>
      </section>

      {/* Links */}
      <section class="about-section">
        <h2 class="about-h2">Links</h2>
        <div class="about-links">
          <a href="https://codeberg.org/clatis/pullcord" class="about-link-card" target="_blank" rel="noopener">
            <span class="about-link-icon">📦</span>
            <div>
              <div class="about-link-title">Source Code</div>
              <div class="about-link-desc">codeberg.org/clatis/pullcord</div>
            </div>
          </a>
          <a href="https://codeberg.org/clatis/pullcord/issues" class="about-link-card" target="_blank" rel="noopener">
            <span class="about-link-icon">💬</span>
            <div>
              <div class="about-link-title">Issues &amp; Feedback</div>
              <div class="about-link-desc">Bug reports and feature requests</div>
            </div>
          </a>
          <a href="https://www.itsmarta.com/MARTA-Developer-resources.aspx" class="about-link-card" target="_blank" rel="noopener">
            <span class="about-link-icon">🚌</span>
            <div>
              <div class="about-link-title">MARTA Developer Resources</div>
              <div class="about-link-desc">GTFS feeds and API documentation</div>
            </div>
          </a>
        </div>
      </section>

      {/* Updates */}
      <section class="about-section">
        <h2 class="about-h2">Updates</h2>

        <div class="about-update">
          <div class="about-update-date">Feb 17</div>
          <div class="about-update-text">
            ETAs for tracked buses are now computed from the bus's actual GPS position and the scheduled travel time between stops. MARTA's feed has a known issue where predicted times just tick forward with the clock instead of reflecting where the bus actually is. Ours use real position data. Also fixed: notifications now wake your phone properly instead of waiting for you to check it.
          </div>
        </div>

        <div class="about-update">
          <div class="about-update-date">Feb 16</div>
          <div class="about-update-text">
            Backend cleanup. Consolidated how we look up predictions so single-stop and multi-stop views use the same code path. Paired stops (same location, two IDs for each direction) now resolve correctly everywhere. Fewer bugs, same features.
          </div>
        </div>

        <div class="about-update">
          <div class="about-update-date">Feb 15</div>
          <div class="about-update-text">
            Search now finds routes by number — type "21" and it shows Route 21 stops. Fixed a bunch of edge cases with stops that serve multiple routes. Stability and accessibility work.
          </div>
        </div>

        <div class="about-update">
          <div class="about-update-date">Feb 14</div>
          <div class="about-update-text">
            "Pull the Cord" notifications are now reliable. They survive app restarts, fire even with your phone locked, and clean up after themselves. Replaced the janky browser notification API with real Web Push — your phone buzzes like a text message when your bus is close.
          </div>
        </div>

        <div class="about-update">
          <div class="about-update-date">Feb 13</div>
          <div class="about-update-text">
            Redesigned the tracker from scratch. The big countdown number, the progress strip showing your bus approaching, the direction-aware stop list — all new. Went through four design experiments and picked the best pieces from each. Added favorites so you can save your regular stops.
          </div>
        </div>

        <div class="about-update">
          <div class="about-update-date">Feb 12</div>
          <div class="about-update-text">
            Pullcord launched. Live bus positions on a map with ETA predictions for all 118 MARTA bus routes, built on GTFS real-time feeds. Find your stop by location or search, see what's coming.
          </div>
        </div>
      </section>

      {/* Footer */}
      <div class="about-footer">
        <p>Made in Atlanta 🍑</p>
      </div>
    </div>
  </div>
);
