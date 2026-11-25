window.LifeOS = window.LifeOS || {};

(function () {
  const state = {
    section: 'dashboard',
    subTab: { planning: 'tasks', finance: 'overview', library: 'notes' }
  };

  const SUB_TABS = {
    planning: [
      { id: 'tasks', label: 'Tarefas' },
      { id: 'calendar', label: 'Calendário' },
      { id: 'habits', label: 'Hábitos' }
    ],
    finance: [
      { id: 'overview', label: 'Visão Geral' },
      { id: 'transactions', label: 'Movimentações' },
      { id: 'accounts', label: 'Contas & Cartões' },
      { id: 'budget', label: 'Orçamento' }
    ],
    library: [
      { id: 'notes', label: 'Notas' },
      { id: 'projects', label: 'Projetos' },
      { id: 'reports', label: 'Relatórios' }
    ]
  };

  const Nav = {
    async go(section, subTab = null) {
      state.section = section;
      if (subTab && state.subTab[section] !== undefined) state.subTab[section] = subTab;

      document.querySelectorAll('#bottom-nav .nav-item').forEach((b) => {
        b.classList.toggle('active', b.dataset.section === section);
      });

      const subEl = document.getElementById('sub-nav');
      const tabs = SUB_TABS[section];
      if (tabs) {
        subEl.classList.remove('hidden');
        subEl.innerHTML = tabs
          .map((t) => `<button type="button" class="sub-tab ${t.id === state.subTab[section] ? 'active' : ''}" data-sub="${t.id}">${t.label}</button>`)
          .join('');
        subEl.querySelectorAll('.sub-tab').forEach((b) => b.addEventListener('click', () => this.go(section, b.dataset.sub)));
      } else {
        subEl.classList.add('hidden');
        subEl.innerHTML = '';
      }

      await this.renderCurrentView();
    },

    async renderCurrentView() {
      const c = document.getElementById('main-content');
      if (state.section === 'dashboard') await window.LifeOS.Dashboard.render(c);
      else if (state.section === 'planning') {
        const sub = state.subTab.planning;
        if (sub === 'tasks') await window.LifeOS.Tasks.render(c);
        else if (sub === 'calendar') await window.LifeOS.Calendar.render(c);
        else await window.LifeOS.Habits.render(c);
      } else if (state.section === 'finance') await window.LifeOS.Finance.render(c, state.subTab.finance);
      else if (state.section === 'goals') await window.LifeOS.Goals.render(c);
      else if (state.section === 'library') {
        const sub = state.subTab.library;
        if (sub === 'notes') await window.LifeOS.Notes.render(c);
        else if (sub === 'projects') await window.LifeOS.Projects.render(c);
        else await window.LifeOS.Reports.render(c);
      } else if (state.section === 'settings') await window.LifeOS.Settings.render(c);
    },

    openModal(title, html) {
      document.getElementById('modal-title').textContent = title;
      const body = document.getElementById('modal-body');
      body.innerHTML = html;
      document.getElementById('modal-backdrop').classList.remove('hidden');
      return body;
    },

    closeModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('modal-body').innerHTML = '';
    },

    confirm(title, message, okLabel = 'Confirmar') {
      return new Promise((resolve) => {
        const bd = document.getElementById('confirm-backdrop');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');
        okBtn.textContent = okLabel;
        bd.classList.remove('hidden');
        const done = (val) => { bd.classList.add('hidden'); resolve(val); };
        okBtn.onclick = () => done(true);
        cancelBtn.onclick = () => done(false);
      });
    },

    toast(msg, isError = false) {
      const box = document.
