// Pullcord — Stop View (multi-route arrivals)
// Flat departure board: all buses at this stop, sorted by ETA.
// Tap a row to select it (highlighted). Cord works on selection.

class StopView {
  constructor() {
    this.data = window.__STOP_DATA__;
    this.arrivals = [];
    this.selectedId = null; // "routeId:vehicleId" or "routeId:tripId"
    this.pollTimer = null;
    this.countdownTimer = null;

    // Cord state
    this.cordActive = false;
    this.cordId = null;
    this.cordThreshold = null;
    this.pushSupported = 'serviceWorker' in navigator && 'PushManager' in window;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    this.checkCordFired();
    this.initCord();
    this.initFavoriteBtn();
    this.initRefreshBtn();
    this.fetchArrivals();
    this.startPolling();
    this.startCountdown();
  }

  checkCordFired() {
    const params = new URLSearchParams(window.location.search);
    const firedId = params.get('cordFired');
    if (!firedId) return;
    fetch(`/api/push/cord/${firedId}`, { method: 'DELETE' }).catch(() => {});
    this.cordActive = false;
    this.cordId = null;
    this.cordFiredId = firedId;
    params.delete('cordFired');
    const clean = params.toString();
    history.replaceState(null, '', window.location.pathname + (clean ? '?' + clean : ''));
  }

  async fetchArrivals() {
    try {
      const res = await fetch(`/api/stops/${this.data.stop.stop_id}/arrivals`);
      const json = await res.json();
      this.arrivals = json.arrivals || [];
      // Auto-select first if nothing selected
      if (!this.selectedId && this.arrivals.length > 0) {
        this.selectedId = this.arrivalKey(this.arrivals[0]);
      }
      this.render();
    } catch (e) {
      console.error('Failed to fetch arrivals:', e);
    }
  }

  arrivalKey(a) {
    return `${a.routeId}:${a.vehicleId || a.tripId}`;
  }

  startPolling() {
    this.pollTimer = setInterval(() => this.fetchArrivals(), 30000);
  }

  startCountdown() {
    this.countdownTimer = setInterval(() => {
      for (const a of this.arrivals) {
        if (a.etaSeconds > 0) a.etaSeconds -= 1;
      }
      this.updateCountdowns();
    }, 1000);
  }

  updateCountdowns() {
    document.querySelectorAll('.stop-row').forEach(row => {
      const key = row.dataset.key;
      const a = this.arrivals.find(x => this.arrivalKey(x) === key);
      if (!a) return;
      const etaEl = row.querySelector('.stop-eta');
      if (etaEl) etaEl.textContent = this.formatEta(a.etaSeconds);
    });

    // Update cord status if active
    if (this.cordActive) this.updateCordStatus();
  }

  formatEta(sec) {
    if (sec <= 0) return 'NOW';
    if (sec < 60) return '<1m';
    const min = Math.floor(sec / 60);
    return `${min}m`;
  }

  formatAbsoluteTime(sec) {
    const arrival = new Date(Date.now() + sec * 1000);
    return arrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  render() {
    const list = document.getElementById('arrivals-list');
    if (!list) return;

    if (this.arrivals.length === 0) {
      list.innerHTML = '<div class="stop-empty">No buses arriving right now</div>';
      return;
    }

    list.innerHTML = this.arrivals.map(a => {
      const key = this.arrivalKey(a);
      const selected = key === this.selectedId;
      const color = `#${a.routeColor}`;
      const arriving = a.etaSeconds <= 120;

      return `
        <button class="stop-row ${selected ? 'stop-row-selected' : ''} ${arriving ? 'stop-row-arriving' : ''}"
                data-key="${key}" style="--row-color:${color}">
          <span class="stop-row-badge" style="background:${color}">${a.routeShortName}</span>
          <span class="stop-row-headsign">${a.headsign}</span>
          <span class="stop-eta ${arriving ? 'stop-eta-now' : ''}">${this.formatEta(a.etaSeconds)}</span>
          ${a.etaSeconds >= 600 ? `<span class="stop-eta-abs">~${this.formatAbsoluteTime(a.etaSeconds)}</span>` : ''}
        </button>
      `;
    }).join('');

    // Wire tap handlers
    list.querySelectorAll('.stop-row').forEach(row => {
      row.addEventListener('click', () => {
        this.selectedId = row.dataset.key;
        // Update selection visuals
        list.querySelectorAll('.stop-row').forEach(r => r.classList.remove('stop-row-selected'));
        row.classList.add('stop-row-selected');
      });
    });
  }

  getSelectedArrival() {
    return this.arrivals.find(a => this.arrivalKey(a) === this.selectedId) || null;
  }

  // ── Pull the Cord ──

  initCord() {
    const section = document.getElementById('cord-section');
    if (!section || !this.pushSupported) {
      if (section) section.style.display = 'none';
      return;
    }

    section.querySelectorAll('.d-cord-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activateCord(parseInt(btn.dataset.minutes, 10));
      });
    });

    const cancelBtn = document.getElementById('cord-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelCord());

    if (this.cordFiredId) {
      const label = document.getElementById('cord-label');
      if (label) label.textContent = '✅ Notification delivered!';
      setTimeout(() => { if (label) label.textContent = '🔔 Alert me'; }, 3000);
      this.cordFiredId = null;
    }
  }

  async activateCord(thresholdMinutes) {
    const arrival = this.getSelectedArrival();
    if (!arrival) return;

    const cordIdle = document.getElementById('cord-idle');
    const label = document.getElementById('cord-label');
    const activeDisplay = document.getElementById('cord-active-display');

    if (label) label.textContent = 'Setting up...';

    try {
      const reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const vapidRes = await fetch('/api/push/vapid');
      const { publicKey } = await vapidRes.json();
      if (!publicKey) throw new Error('No VAPID key');

      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        if (label) label.textContent = 'Notifications blocked';
        setTimeout(() => { if (label) label.textContent = '🔔 Alert me'; }, 3000);
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey),
      });

      const cordRes = await fetch('/api/push/cord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          routeId: arrival.routeId,
          stopId: this.data.stop.stop_id,
          vehicleId: arrival.vehicleId || null,
          thresholdMinutes,
        }),
      });

      const { cordId } = await cordRes.json();
      this.cordActive = true;
      this.cordId = cordId;
      this.cordThreshold = thresholdMinutes;

      if (cordIdle) cordIdle.classList.add('hidden');
      if (activeDisplay) activeDisplay.classList.remove('hidden');
      if (navigator.vibrate) navigator.vibrate([50, 30, 100]);
      this.updateCordStatus();
    } catch (err) {
      console.error('Cord setup failed:', err);
      if (label) label.textContent = 'Setup failed — try again';
      setTimeout(() => { if (label) label.textContent = '🔔 Alert me'; }, 3000);
    }
  }

  cancelCord() {
    if (this.cordId) fetch(`/api/push/cord/${this.cordId}`, { method: 'DELETE' }).catch(() => {});
    this.cordActive = false;
    this.cordId = null;
    const cordIdle = document.getElementById('cord-idle');
    const activeDisplay = document.getElementById('cord-active-display');
    const label = document.getElementById('cord-label');
    if (label) label.textContent = '🔔 Alert me';
    if (cordIdle) cordIdle.classList.remove('hidden');
    if (activeDisplay) activeDisplay.classList.add('hidden');
  }

  updateCordStatus() {
    const statusText = document.getElementById('cord-status-text');
    if (!statusText || !this.cordActive) return;
    const arrival = this.getSelectedArrival();
    if (arrival) {
      const mins = Math.floor(arrival.etaSeconds / 60);
      statusText.textContent = `${this.cordThreshold}m alert · bus ${mins}m away`;
    }
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  // ── Favorites ──

  initFavoriteBtn() {
    const btn = document.getElementById('save-stop-btn');
    if (!btn) return;

    const saved = this.isSaved();
    if (saved) btn.querySelector('span').textContent = 'Saved ★';

    btn.addEventListener('click', () => {
      const favorites = JSON.parse(localStorage.getItem('pullcord-favorites') || '[]');
      const existing = favorites.findIndex(f => f.stop_id === this.data.stop.stop_id);

      if (existing >= 0) {
        favorites.splice(existing, 1);
        btn.querySelector('span').textContent = 'Save Stop';
      } else {
        favorites.push({
          stop_id: this.data.stop.stop_id,
          stop_name: this.data.stop.stop_name,
          routes: this.data.routes.map(r => r.route_short_name),
          url: window.location.href,
        });
        btn.querySelector('span').textContent = 'Saved ★';
      }
      localStorage.setItem('pullcord-favorites', JSON.stringify(favorites));
    });
  }

  isSaved() {
    const favorites = JSON.parse(localStorage.getItem('pullcord-favorites') || '[]');
    return favorites.some(f => f.stop_id === this.data.stop.stop_id);
  }

  initRefreshBtn() {
    const btn = document.getElementById('refresh-btn');
    if (btn) btn.addEventListener('click', () => this.fetchArrivals());
  }
}

new StopView();
