window.LifeOS = window.LifeOS || {};

(function () {
  const DB_NAME = 'LifeOS_DB';
  const DB_VERSION = 1;
  const STORES = [
    'tasks', 'events', 'habits', 'habitLogs',
    'accounts', 'cards', 'transactions', 'budgets',
    'goals', 'notes', 'projects', 'notifications'
  ];

  const MIGRATIONS = {
    1: (db) => {
      STORES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    }
  };

  let dbInstance = null;

  const DB = {
    STORES,
    VERSION: DB_VERSION,
    init() {
      return new Promise((resolve, reject) => {
        if (dbInstance) return resolve(dbInstance);
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          for (let v = (e.oldVersion || 0) + 1; v <= DB_VERSION; v++) {
            if (MIGRATIONS[v]) MIGRATIONS[v](db);
          }
        };
        req.onsuccess = (e) => {
          dbInstance = e.target.result;
          dbInstance.onversionchange = () => {
            dbInstance.close();
            dbInstance = null;
          };
          resolve(dbInstance);
        };
        req.onerror = () => reject(req.error);
      });
    },
    async getAll(store) {
      const db = await this.init();
      return new Promise((res, rej) => {
        const req = db.transaction(store, 'readonly').objectStore(store).getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => rej(req.error);
      });
    },
    async get(store, id) {
      const db = await this.init();
      return new Promise((res, rej) => {
        const req = db.transaction(store, 'readonly').objectStore(store).get(id);
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => rej(req.error);
      });
    },
    async put(store, item) {
      const db = await this.init();
      return new Promise((res, rej) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(item);
        tx.oncomplete = () => res(item);
        tx.onerror = () => rej(tx.error);
      });
    },
    async delete(store, id) {
      const db = await this.init();
      return new Promise((res, rej) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(id);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
      });
    },
    async clearAll() {
      const db = await this.init();
      for (const s of STORES) {
        await new Promise((res) => {
          const tx = db.transaction(s, 'readwrite');
          tx.objectStore(s).clear();
          tx.oncomplete = () => res(true);
        });
      }
    },
    async exportAll() {
      const payload = {
        app: 'LifeOS',
        schemaVersion: DB_VERSION,
        exportedAt: new Date().toISOString(),
        preferences: Prefs.getAll(),
        stores: {}
      };
      for (const s of STORES) payload.stores[s] = await this.getAll(s);
      return payload;
    },
    async importAll(payload) {
      if (!payload || payload.app !== 'LifeOS' || typeof payload.stores !== 'object') {
        throw new Error('Arquivo JSON inválido.');
      }
      const db = await this.init();
      for (const s of STORES) {
        const list = Array.isArray(payload.stores[s]) ? payload.stores[s] : [];
        await new Promise((res, rej) => {
          const tx = db.transaction(s, 'readwrite');
          const os = tx.objectStore(s);
          os.clear();
          list.forEach((item) => { if (item && item.id) os.put(item); });
          tx.oncomplete = () => res(true);
          tx.onerror = () => rej(tx.error);
        });
      }
      if (payload.preferences) Prefs.saveAll({ ...Prefs.getAll(), ...payload.preferences, onboarded: true });
    },
    async seedDemoData() {
      const today = Utils.todayISO();
      await this.put('tasks', {
        id: 'demo_t1', isDemo: true, title: 'Revisar planejamento semanal',
        description: 'Definir prioridades principais da semana.', priority: 'Alta',
        dueDate: today, dueTime: '09:30', category: 'Pessoal', tags: ['foco'],
        subtasks: [{ id: 's1', title: 'Checar compromissos', done: true }],
        recurrence: 'weekly', completed: false, createdAt: new Date().toISOString()
      });
      await this.put('events', {
        id: 'demo_e1', isDemo: true, title: 'Bloco de Foco Profundo',
        startDate: today, startTime: '10:00', endDate: today, endTime: '11:30',
        location: 'Escritório', category: 'Trabalho', description: '', createdAt: new Date().toISOString()
      });
      await this.put('habits', {
        id: 'demo_h1', isDemo: true, name: 'Beber 2L de água', frequency: 'daily',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6], dailyTarget: 8, unit: 'copos', icon: '💧', createdAt: new Date().toISOString()
      });
      await this.put('goals', {
        id: 'demo_g1', isDemo: true, name: 'Ler 12 livros no ano', description: 'Manter leitura constante.',
        category: 'Acadêmicas', createdAt: today, deadline: Utils.addDays(today, 180),
        targetValue: 12, currentValue: 4, unit: 'livros', steps: [],
        history: [{ date: today, value: 4, note: 'Registro inicial' }], notes: ''
      });
      await this.put('notes', {
        id: 'demo_n1', isDemo: true, title: 'Guia Rápido do LifeOS',
        content: 'Todos os seus dados são salvos localmente no seu dispositivo.',
        category: 'Geral', tags: ['guia'], pinned: true, archived: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      await this.put('projects', {
        id: 'demo_p1', isDemo: true, name: 'Organização Pessoal 360°',
        description: 'Estruturar rotinas e metas pessoais.', deadline: Utils.addDays(today, 14),
        status: 'in_progress', priority: 'Alta',
        steps: [{ id: 'ps1', title: 'Cadastrar contas na aba Finanças', done: false }],
        notes: '', createdAt: new Date().toISOString()
      });
    },
    async clearDemoData() {
      for (const s of STORES) {
        const list = await this.getAll(s);
        for (const item of list) {
          if (item && item.isDemo) await this.delete(s, item.id);
        }
      }
    }
  };

  const PREFS_KEY = 'lifeos_preferences_v1';
  const DEFAULT_PREFS = {
    userName: 'Usuário', avatar: '', theme: 'dark', currency: 'BRL',
    weekStart: 0, dateFormat: 'DD/MM/YYYY', onboarded: false, lastBackupAt: null
  };

  const Prefs = {
    getAll() {
      try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; }
      catch { return { ...DEFAULT_PREFS }; }
    },
    get(k) { return this.getAll()[k]; },
    set(k, v) {
      const next = { ...this.getAll(), [k]: v };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    },
    saveAll(obj) { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...DEFAULT_PREFS, ...obj })); },
    reset() { localStorage.removeItem(PREFS_KEY); }
  };

  const CURRENCIES = {
    BRL: { locale: 'pt-BR', currency: 'BRL' },
    USD: { locale: 'en-US', currency: 'USD' },
    EUR: { locale: 'de-DE', currency: 'EUR' },
    GBP: { locale: 'en-GB', currency: 'GBP' }
  };

  const Utils = {
    uid(prefix = 'id') { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; },
    todayISO() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    addDays(iso, days) {
      const [y, m, d] = iso.split('-').map(Number);
      const dt = new Date(y, m - 1, d + days);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    },
    formatDate(iso) {
      if (!iso) return 'Sem data';
      const p = iso.split('-');
      if (p.length !== 3) return iso;
      return Prefs.get('dateFormat') === 'YYYY-MM-DD' ? iso : `${p[2]}/${p[1]}/${p[0]}`;
    },
    formatFullHeaderDate() {
      return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    },
    getGreeting() {
      const h = new Date().getHours();
      return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    },
    formatCurrency(val) {
      const cfg = CURRENCIES[Prefs.get('currency')] || CURRENCIES.BRL;
      return new Intl.NumberFormat(cfg.locale, { style: 'currency', currency: cfg.currency }).format(Number(val) || 0);
    },
    escapeHTML(str) {
      return String(str ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    },
    drawBarChart(canvas, labels, seriesA, seriesB = null, colors = ['#8BE0A3', '#F26D6D']) {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.getBoundingClientRect().width || 300;
      const h = canvas.getBoundingClientRect().height || 170;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      const padL = 12, padR = 12, padT = 16, padB = 26;
      const chartW = w - padL - padR, chartH = h - padT - padB;
      const maxVal = Math.max(...seriesA, ...(seriesB || []), 1);
      const groupW = chartW / (labels.length || 1);

      labels.forEach((lbl, i) => {
        const cx = padL + groupW * i + groupW / 2;
        if (seriesB) {
          const bw = Math.min(13, groupW * 0.32);
          const hA = ((seriesA[i] || 0) / maxVal) * chartH;
          const hB = ((seriesB[i] || 0) / maxVal) * chartH;
          ctx.fillStyle = colors[0];
          ctx.fillRect(cx - bw - 2, padT + chartH - hA, bw, Math.max(hA, 2));
          ctx.fillStyle = colors[1];
          ctx.fillRect(cx + 2, padT + chartH - hB, bw, Math.max(hB, 2));
        } else {
          const bw = Math.min(22, groupW * 0.5);
          const hA = ((seriesA[i] || 0) / maxVal) * chartH;
          ctx.fillStyle = colors[0];
          ctx.fillRect(cx - bw / 2, padT + chartH - hA, bw, Math.max(hA, 3));
        }
        ctx.fillStyle = '#929BA6';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(lbl).slice(0, 7), cx, h - 7);
      });
    },
    drawDonutChart(canvas, items) {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.getBoundingClientRect().width || 300;
      const h = canvas.getBoundingClientRect().height || 160;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      const palette = ['#8BE0A3', '#6DB3F2', '#F2C96D', '#B58BF2', '#F26D6D'];
      const total = items.reduce((s, i) => s + (Number(i.value) || 0), 0);
      const cx = Math.min(w * 0.26, 85), cy = h / 2, r = Math.min(cx - 12, cy - 12, 52);

      if (total <= 0) {
        ctx.strokeStyle = 'rgba(146,155,166,0.22)';
        ctx.lineWidth = 14;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#929BA6'; ctx.font = '12px -apple-system, sans-serif';
        ctx.fillText('Sem gastos no período', cx + r + 20, cy + 4);
        return;
      }

      let start = -Math.PI / 2;
      items.forEach((it, idx) => {
        const angle = (it.value / total) * Math.PI * 2;
        ctx.strokeStyle = palette[idx % palette.length];
        ctx.lineWidth = 14;
        ctx.beginPath(); ctx.arc(cx, cy, r, start, start + angle); ctx.stroke();
        start += angle;
      });

      let ly = 26;
      items.slice(0, 5).forEach((it, idx) => {
        const pct = Math.round((it.value / total) * 100);
        ctx.fillStyle = palette[idx % palette.length];
        ctx.beginPath(); ctx.arc(cx + r + 22, ly - 4, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#929BA6'; ctx.font = '12px -apple-system, sans-serif';
        ctx.fillText(`${it.label.slice(0, 14)} (${pct}%)`, cx + r + 32, ly);
        ly += 25;
      });
    }
  };

  window.LifeOS.DB = DB;
  window.LifeOS.Prefs = Prefs;
  window.LifeOS.Utils = Utils;
})();
