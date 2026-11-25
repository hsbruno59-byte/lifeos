window.LifeOS = window.LifeOS || {};

(function () {
  const { DB, Prefs, Utils, Nav, Tasks, Calendar, Habits, Finance, Goals, Notes } = window.LifeOS;

  const App = {
    async init() {
      this.registerSW();
      await DB.init();
      this.bindGlobalEvents();
      this.refreshShell();

      if (!Prefs.get('onboarded')) {
        document.getElementById('onboarding-screen')?.classList.remove('hidden');
      } else {
        Nav.init();
      }
    },

    registerSW() {
      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      }
    },

    refreshShell() {
      const prefs = Prefs.getAll();
      document.documentElement.setAttribute('data-theme', prefs.theme || 'dark');

      const name = prefs.userName || 'Usuário';
      const hour = new Date().getHours();
      const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
      const elGreet = document.getElementById('header-greeting');
      if (elGreet) elGreet.textContent = `${greet}, ${name}`;

      const elAvatar = document.getElementById('header-avatar');
      if (elAvatar) elAvatar.textContent = name.charAt(0).toUpperCase() || 'L';

      const elDate = document.getElementById('header-date');
      if (elDate) {
        elDate.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
      }

      this.updateNetworkStatus();
      this.refreshNotifications();
    },

    updateNetworkStatus() {
      const pill = document.getElementById('network-pill');
      const label = pill?.querySelector('.network-label');
      if (!pill || !label) return;
      const online = navigator.onLine;
      pill.classList.toggle('online', online);
      pill.classList.toggle('offline', !online);
      label.textContent = online ? 'Online' : 'Offline';
    },

    async refreshNotifications() {
      const [tasks, events] = await Promise.all([DB.getAll('tasks'), DB.getAll('events')]);
      const today = Utils.todayISO();
      const alerts = [];

      tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < today).forEach((t) => {
        alerts.push({ title: `Tarefa atrasada: ${t.title}`, sub: `Venceu em ${Utils.formatDate(t.dueDate)}`, go: 'planning:tasks' });
      });
      events.filter((e) => e.startDate === today).forEach((e) => {
        alerts.push({ title: `Hoje às ${e.startTime}: ${e.title}`, sub: e.location || 'Compromisso agendado', go: 'planning:calendar' });
      });

      const badge = document.getElementById('notif-badge');
      if (badge) {
        badge.textContent = String(alerts.length);
        badge.classList.toggle('hidden', alerts.length === 0);
      }

      const listEl = document.getElementById('notifications-list');
      if (listEl) {
        listEl.innerHTML = alerts.length === 0
          ? `<div class="empty-state"><p class="text-secondary">Nenhum alerta pendente.</p></div>`
          : `<div class="item-list">${alerts.map((a) => `
              <div class="card-subtle" data-ngo="${a.go}" style="cursor:pointer;">
                <strong>${Utils.escapeHTML(a.title)}</strong>
                <div class="kpi-sub">${Utils.escapeHTML(a.sub)}</div>
              </div>
            `).join('')}</div>`;
        listEl.querySelectorAll('[data-ngo]').forEach((el) => {
          el.addEventListener('click', () => {
            document.getElementById('notifications-overlay')?.classList.add('hidden');
            const [s, sub] = el.dataset.ngo.split(':');
            Nav.go(s, sub || null);
          });
        });
      }
    },

    bindGlobalEvents() {
      window.addEventListener('online', () => this.updateNetworkStatus());
      window.addEventListener('offline', () => this.updateNetworkStatus());

      document.getElementById('onboarding-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('ob-name').value.trim();
        if (!name) return;
        Prefs.set('userName', name);
        Prefs.set('currency', document.getElementById('ob-currency').value);
        Prefs.set('theme', document.getElementById('ob-theme').value);
        Prefs.set('onboarded', true);
        if (document.getElementById('ob-demo').checked) await DB.seedDemo();
        document.getElementById('onboarding-screen')?.classList.add('hidden');
        this.refreshShell();
        Nav.init();
      });

      document.getElementById('btn-settings')?.addEventListener('click', () => Nav.go('settings'));
      document.getElementById('header-profile-trigger')?.addEventListener('click', () => Nav.go('settings'));

      const qcBackdrop = document.getElementById('quick-capture-backdrop');
      document.getElementById('fab-quick-capture')?.addEventListener('click', () => qcBackdrop?.classList.remove('hidden'));
      document.getElementById('close-quick-capture')?.addEventListener('click', () => qcBackdrop?.classList.add('hidden'));
      qcBackdrop?.addEventListener('click', (e) => { if (e.target === qcBackdrop) qcBackdrop.classList.add('hidden'); });

      document.querySelectorAll('[data-quick]').forEach((btn) => {
        btn.addEventListener('click', () => {
          qcBackdrop?.classList.add('hidden');
          const type = btn.dataset.quick;
          if (type === 'task') Tasks.openForm();
          else if (type === 'note') Notes.openForm();
          else if (type === 'event') Calendar.openForm();
          else if (type === 'expense') Finance.openTransactionForm('expense');
          else if (type === 'income') Finance.openTransactionForm('income');
          else if (type === 'goal') Goals.openForm();
        });
      });

      const notifOverlay = document.getElementById('notifications-overlay');
      document.getElementById('btn-notifications')?.addEventListener('click', () => {
        this.refreshNotifications();
        notifOverlay?.classList.remove('hidden');
      });
      document.getElementById('close-notifications')?.addEventListener('click', () => notifOverlay?.classList.add('hidden'));
      document.getElementById('mark-all-notifs-read')?.addEventListener('click', () => {
        document.getElementById('notif-badge')?.classList.add('hidden');
        notifOverlay?.classList.add('hidden');
        Nav.toast('Alertas limpos.');
      });

      const searchOverlay = document.getElementById('search-overlay');
      const searchInput = document.getElementById('global-search-input');
      document.getElementById('btn-global-search')?.addEventListener('click', () => {
        searchOverlay?.classList.remove('hidden');
        searchInput.value = '';
        document.getElementById('global-search-results').innerHTML = '';
        searchInput?.focus();
      });
      document.getElementById('close-global-search')?.addEventListener('click', () => searchOverlay?.classList.add('hidden'));
      searchInput?.addEventListener('input', () => this.runGlobalSearch(searchInput.value));
    },

    async runGlobalSearch(query) {
      const resEl = document.getElementById('global-search-results');
      const q = query.trim().toLowerCase();
      if (!q) {
        resEl.innerHTML = '';
        return;
      }

      const [tasks, notes, projects, goals, txs] = await Promise.all([
        DB.getAll('tasks'), DB.getAll('notes'), DB.getAll('projects'), DB.getAll('goals'), DB.getAll('transactions')
      ]);

      const hits = [];
      tasks.filter((t) => (t.title || '').toLowerCase().includes(q)).forEach((t) => hits.push({ tag: 'Tarefa', title: t.title, go: 'planning:tasks' }));
      notes.filter((n) => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q)).forEach((n) => hits.push({ tag: 'Nota', title: n.title, go: 'library:notes' }));
      projects.filter((p) => (p.name || '').toLowerCase().includes(q)).forEach((p) => hits.push({ tag: 'Projeto', title: p.name, go: 'library:projects' }));
      goals.filter((g) => (g.name || '').toLowerCase().includes(q)).forEach((g) => hits.push({ tag: 'Objetivo', title: g.name, go: 'goals' }));
      txs.filter((t) => (t.description || '').toLowerCase().includes(q)).forEach((t) => hits.push({ tag: 'Finanças', title: `${t.description} (${Utils.formatCurrency(t.amount)})`, go: 'finance:transactions' }));

      resEl.innerHTML = hits.length === 0
        ? `<div class="empty-state"><p class="text-secondary">Nenhum resultado encontrado.</p></div>`
        : hits.slice(0, 20).map((h) => `
            <div class="card-subtle row-between" data-sgo="${h.go}" style="cursor:pointer;">
              <strong>${Utils.escapeHTML(h.title)}</strong>
              <span class="badge">${h.tag}</span>
            </div>
          `).join('');

      resEl.querySelectorAll('[data-sgo]').forEach((el) => {
        el.addEventListener('click', () => {
          document.getElementById('search-overlay')?.classList.add('hidden');
          const [s, sub] = el.dataset.sgo.split(':');
          Nav.go(s, sub || null);
        });
      });
    }
  };

  window.LifeOS.App = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})();
