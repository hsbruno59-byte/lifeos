window.LifeOS = window.LifeOS || {};

(function () {
  const { DB, Utils, Nav } = window.LifeOS;
  let view = 'today';
  let prio = 'all';
  let search = '';

  const PRIO_BADGE = { Baixa: 'badge', Média: 'badge-info', Alta: 'badge-warning', Urgente: 'badge-danger' };
  const REC_TEXT = { none: '', daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal' };

  const Tasks = {
    async render(container) {
      const tasks = await DB.getAll('tasks');
      const today = Utils.todayISO();
      const tomorrow = Utils.addDays(today, 1);

      const doneCount = tasks.filter((t) => t.completed).length;
      const overdueCount = tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < today).length;
      const prodPct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

      let list = tasks.filter((t) => {
        if (view === 'today') return !t.completed && t.dueDate === today;
        if (view === 'tomorrow') return !t.completed && t.dueDate === tomorrow;
        if (view === 'upcoming') return !t.completed && t.dueDate && t.dueDate > tomorrow;
        if (view === 'overdue') return !t.completed && t.dueDate && t.dueDate < today;
        if (view === 'completed') return Boolean(t.completed);
        return true;
      });

      if (prio !== 'all') list = list.filter((t) => t.priority === prio);
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(
          (t) =>
            (t.title || '').toLowerCase().includes(q) ||
            (t.description || '').toLowerCase().includes(q) ||
            (t.category || '').toLowerCase().includes(q) ||
            (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
        );
      }

      const views = [
        { id: 'today', label: 'Hoje' },
        { id: 'tomorrow', label: 'Amanhã' },
        { id: 'upcoming', label: 'Próximos dias' },
        { id: 'overdue', label: `Atrasadas (${overdueCount})` },
        { id: 'completed', label: 'Concluídas' },
        { id: 'all', label: 'Todas' }
      ];

      container.innerHTML = `
        <div class="section-heading">
          <h2>Tarefas</h2>
          <button type="button" id="btn-new-task" class="btn btn-primary btn-sm">+ Tarefa</button>
        </div>

        <div class="kpi-grid">
          <div class="kpi-box">
            <span class="kpi-label">Produtividade</span>
            <span class="kpi-value text-accent">${prodPct}%</span>
            <span class="kpi-sub">${doneCount}/${tasks.length} concluídas</span>
          </div>
          <div class="kpi-box">
            <span class="kpi-label">Atrasadas</span>
            <span class="kpi-value ${overdueCount ? 'text-danger' : ''}">${overdueCount}</span>
            <span class="kpi-sub">Pendentes vencidas</span>
          </div>
        </div>

        <div class="chip-row">
          ${views.map((v) => `<button type="button" class="chip ${view === v.id ? 'active' : ''}" data-tview="${v.id}">${v.label}</button>`).join('')}
        </div>

        <div class="form-row">
          <input type="search" id="t-search" class="input" placeholder="Pesquisar tarefas..." value="${Utils.escapeHTML(search)}">
          <select id="t-prio" class="input">
            <option value="all" ${prio === 'all' ? 'selected' : ''}>Todas prioridades</option>${['Urgente', 'Alta', 'Média', 'Baixa'].map((p) => `<option value="${p}" ${prio === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>

        <div class="item-list">
          ${
            list.length === 0
              ? `<div class="empty-state"><p class="text-secondary">Nenhuma tarefa nesta visualização.</p></div>`
              : list
                  .map((t) => {
                    const subs = Array.isArray(t.subtasks) ? t.subtasks : [];
                    return `
                    <div class="list-item ${t.completed ? 'completed' : ''}">
                      <button type="button" class="check-circle ${t.completed ? 'checked' : ''}" data-toggle-t="${t.id}">${t.completed ? '✓' : ''}</button>
                      <div style="flex:1; min-width:0;">
                        <div class="row-between">
                          <strong style="${t.completed ? 'text-decoration:line-through;' : ''}">${Utils.escapeHTML(t.title)}</strong>
                          <span class="badge ${PRIO_BADGE[t.priority] || 'badge'}">${Utils.escapeHTML(t.priority || 'Média')}</span>
                        </div>
                        ${t.description ? `<p class="text-secondary" style="font-size:13px; margin-top:4px;">${Utils.escapeHTML(t.description)}</p>` : ''}
                        <div class="row-gap-sm" style="margin-top:7px;">
                          ${t.dueDate ? `<span class="badge">${Utils.formatDate(t.dueDate)}${t.dueTime || ''}</span>` : ''}
                          ${t.category ? `<span class="badge">${Utils.escapeHTML(t.category)}</span>` : ''}
                          ${REC_TEXT[t.recurrence] ? `<span class="badge badge-purple">↻ ${REC_TEXT[t.recurrence]}</span>` : ''}
                          ${(t.tags || []).map((tag) => `<span class="badge">#${Utils.escapeHTML(tag)}</span>`).join('')}
                        </div>
                        ${subs
                          .map(
                            (s) => `
                          <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;margin-top:5px;color:var(--text-secondary);">
                            <input type="checkbox" data-sub-t="${t.id}" data-sub-id="${s.id}" ${s.done ? 'checked' : ''} style="accent-color:var(--accent);">
                            <span style="${s.done ? 'text-decoration:line-through;' : ''}">${Utils.escapeHTML(s.title)}</span>
                          </label>
                        `
                          )
                          .join('')}
                      </div>
                      <div class="row-gap-sm" style="flex-direction:column;">
                        <button type="button" class="icon-btn-sm" data-edit-t="${t.id}">✎</button>
                        <button type="button" class="icon-btn-sm" data-del-t="${t.id}">🗑</button>
                      </div>
                    </div>
                  `;
                  })
                  .join('')
          }
        </div>
      `;

      document.getElementById('btn-new-task')?.addEventListener('click', () => this.openForm());
      container.querySelectorAll('[data-tview]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.tview; this.render(container); }));
      document.getElementById('t-search')?.addEventListener('input', (e) => { search = e.target.value; this.render(container); });
      document.getElementById('t-prio')?.addEventListener('change', (e) => { prio = e.target.value; this.render(container); });

      container.querySelectorAll('[data-toggle-t]').forEach((b) => b.addEventListener('click', () => this.toggleTask(b.dataset.toggleT)));
      container.querySelectorAll('[data-sub-t]').forEach((chk) =>
        chk.addEventListener('change', async () => {
          const t = await DB.get('tasks', chk.dataset.subT);
          if (!t) return;
          t.subtasks = (t.subtasks || []).map((s) => (s.id === chk.dataset.subId ? { ...s, done: chk.checked } : s));
          await DB.put('tasks', t);
          Nav.renderCurrentView();
        })
      );
      container.querySelectorAll('[data-edit-t]').forEach((b) =>
        b.addEventListener('click', async () => {
          const t = await DB.get('tasks', b.dataset.editT);
          if (t) this.openForm(t);
        })
      );
      container.querySelectorAll('[data-del-t]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (await Nav.confirm('Excluir tarefa', 'Remover esta tarefa?')) {
            await DB.delete('tasks', b.dataset.delT);
            Nav.toast('Tarefa excluída.');
            Nav.renderCurrentView();
          }
        })
      );
    },

    async toggleTask(id) {
      const t = await DB.get('tasks', id);
      if (!t) return;
      t.completed = !t.completed;
      t.completedAt = t.completed ? new Date().toISOString() : null;
      await DB.put('tasks', t);

      if (t.completed && t.recurrence && t.recurrence !== 'none' && t.dueDate) {
        const days = t.recurrence === 'daily' ? 1 : t.recurrence === 'weekly' ? 7 : 30;
        await DB.put('tasks', {
          ...t,
          id: Utils.uid('task'),
          dueDate: Utils.addDays(t.dueDate, days),
          completed: false,
          completedAt: null,
          subtasks: (t.subtasks || []).map((s) => ({ ...s, done: false })),
          createdAt: new Date().toISOString()
        });
      }
      Nav.toast(t.completed ? 'Tarefa concluída!' : 'Tarefa reaberta.');
      Nav.renderCurrentView();
    },

    openForm(existing = null) {
      const isEdit = Boolean(existing);
      const t = existing || {
        title: '', description: '', priority: 'Média', dueDate: Utils.todayISO(),
        dueTime: '', category: 'Pessoal', tags: [], subtasks: [], recurrence: 'none'
      };

      const body = Nav.openModal(
        isEdit ? 'Editar Tarefa' : 'Nova Tarefa',
        `
        <form id="tf-form" class="form-stack">
          <div class="form-group"><label for="tf-title">Título *</label><input type="text" id="tf-title" class="input" required value="${Utils.escapeHTML(t.title)}"></div>
          <div class="form-group"><label for="tf-desc">Descrição</label><textarea id="tf-desc" class="input">${Utils.escapeHTML(t.description)}</textarea></div>
          <div class="form-row">
            <div class="form-group">
              <label for="tf-prio">Prioridade</label>
              <select id="tf-prio" class="input">
                ${['Baixa', 'Média', 'Alta', 'Urgente'].map((p) => `<option value="${p}" ${t.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label for="tf-cat">Categoria</label><input type="text" id="tf-cat" class="input" value="${Utils.escapeHTML(t.category)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label for="tf-date">Data</label><input type="date" id="tf-date" class="input" value="${Utils.escapeHTML(t.dueDate)}"></div>
            <div class="form-group"><label for="tf-time">Horário</label><input type="time" id="tf-time" class="input" value="${Utils.escapeHTML(t.dueTime)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="tf-rec">Recorrência</label>
              <select id="tf-rec" class="input">
                <option value="none" ${t.recurrence === 'none' ? 'selected' : ''}>Nenhuma</option>
                <option value="daily" ${t.recurrence === 'daily' ? 'selected' : ''}>Diária</option>
                <option value="weekly" ${t.recurrence === 'weekly' ? 'selected' : ''}>Semanal</option>
                <option value="monthly" ${t.recurrence === 'monthly' ? 'selected' : ''}>Mensal</option>
              </select>
            </div>
            <div class="form-group"><label for="tf-tags">Etiquetas (vírgula)</label><input type="text" id="tf-tags" class="input" value="${Utils.escapeHTML((t.tags || []).join(', '))}"></div>
          </div>
          <div class="form-group"><label for="tf-subs">Subtarefas (uma por linha)</label><textarea id="tf-subs" class="input">${Utils.escapeHTML((t.subtasks || []).map((s) => s.title).join('\n'))}</textarea></div>
          <button type="submit" class="btn btn-primary btn-block">Salvar Tarefa</button>
        </form>
      `
      );

      body.querySelector('#tf-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = body.querySelector('#tf-title').value.trim();
        if (!title) return;
        const prevSubs = Array.isArray(t.subtasks) ? t.subtasks : [];
        const subtasks = body
          .querySelector('#tf-subs')
          .value.split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((line, i) => {
            const old = prevSubs.find((s) => s.title === line);
            return { id: old ? old.id : Utils.uid(`sub_${i}`), title: line, done: old ? old.done : false }; });  await DB.put('tasks', { ...t, id: isEdit ? t.id : Utils.uid('task'), title, description: body.querySelector('#tf-desc').value.trim(), priority: body.querySelector('#tf-prio').value, category: body.querySelector('#tf-cat').value.trim() \vert{}\vert{} 'Pessoal', dueDate: body.querySelector('#tf-date').value, dueTime: body.querySelector('#tf-time').value, recurrence: body.querySelector('#tf-rec').value, tags: body.querySelector('#tf-tags').value.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean), subtasks, completed: isEdit ? Boolean(t.completed) : false, createdAt: t.createdAt \vert{}\vert{} new Date().toISOString() }); Nav.closeModal(); Nav.toast('Tarefa salva!'); Nav.renderCurrentView(); }); } };  window.LifeOS.Tasks = Tasks; })(); ```  ---  #### 3. Nome do arquivo: `js/calendar.js` ```javascript window.LifeOS = window.LifeOS \vert{}\vert{} {};  (function () { const { DB, Prefs, Utils, Nav } = window.LifeOS; let mode = 'month'; let selectedDate = Utils.todayISO();  const toMin = (t) => { if (!t \vert{}\vert{} !t.includes(':')) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };  const getConflicts = (list) => { const ids = new Set(); for (let i = 0; i < list.length; i++) { for (let j = i + 1; j < list.length; j++) { const a1 = toMin(list[i].startTime); const a2 = Math.max(a1 + 15, toMin(list[i].endTime \vert{}\vert{} list[i].startTime)); const b1 = toMin(list[j].startTime); const b2 = Math.max(b1 + 15, toMin(list[j].endTime \vert{}\vert{} list[j].startTime)); if (a1 < b2 && b1 < a2) { ids.add(list[i].id); ids.add(list[j].id); } } } return ids; };  const Calendar = { async render(container) { const events = await DB.getAll('events'); const today = Utils.todayISO(); const [y, m] = selectedDate.split('-').map(Number); const weekStart = Number(Prefs.get('weekStart')) \vert{}\vert{} 0; const baseDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']; const daysHeader = weekStart === 1 ? [...baseDays.slice(1), baseDays[0]] : baseDays;  const dayEvents = events .filter((e) => e.startDate === selectedDate) .sort((a, b) => (a.startTime \vert{}\vert{} '').localeCompare(b.startTime \vert{}\vert{} '')); const conflicts = getConflicts(dayEvents);  let gridHTML = ''; if (mode === 'month') { const firstOffset = (new Date(y, m - 1, 1).getDay() - weekStart + 7) \% 7; const totalDays = new Date(y, m, 0).getDate(); const cells = Array(firstOffset).fill('<div class="cal-day other-month"></div>'); for (let d = 1; d <= totalDays; d++) { const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const has = events.some((e) => e.startDate === iso);
          cells.push(`
            <button type="button" class="cal-day ${iso === today ? 'today' : ''} ${iso === selectedDate ? 'selected' : ''}" data-cdate="${iso}">
              <span>${d}</span>${has ? '<span class="cal-dot"></span>' : ''}
            </button>
          `);
        }
        gridHTML = `
          <div class="card">
            <div class="row-between" style="margin-bottom:10px;">
              <button type="button" class="icon-btn-sm" id="cal-prev">‹</button>
              <strong>${String(m).padStart(2, '0')}/${y}</strong>
              <button type="button" class="icon-btn-sm" id="cal-next">›</button>
            </div>
            <div class="cal-grid">${daysHeader.map((w) => `<div class="cal-weekday">${w}</div>`).join('')}${cells.join('')}</div>
          </div>
        `;
      } else if (mode === 'week') {
        const [sy, sm, sd] = selectedDate.split('-').map(Number);
        const diff = (new Date(sy, sm - 1, sd).getDay() - weekStart + 7) % 7;
        const startISO = Utils.addDays(selectedDate, -diff);
        const cells = [];
        for (let i = 0; i < 7; i++) {
          const iso = Utils.addDays(startISO, i);
          cells.push(`
            <button type="button" class="cal-day ${iso === today ? 'today' : ''} ${iso === selectedDate ? 'selected' : ''}" data-cdate="${iso}">
              <span>${iso.slice(8, 10)}</span>
            </button>
          `);
        }
        gridHTML = `
          <div class="card">
            <div class="cal-grid">${daysHeader.map((w) => `<div class="cal-weekday">${w}</div>`).join('')}${cells.join('')}</div>
          </div>
        `;
      }

      container.innerHTML = `
        <div class="section-heading">
          <h2>Calendário</h2>
          <button type="button" id="btn-new-evt" class="btn btn-primary btn-sm">+ Compromisso</button>
        </div>

        <div class="row-between">
          <div class="chip-row">
            <button type="button" class="chip ${mode === 'month' ? 'active' : ''}" data-cmode="month">Mensal</button>
            <button type="button" class="chip ${mode === 'week' ? 'active' : ''}" data-cmode="week">Semanal</button>
            <button type="button" class="chip ${mode === 'day' ? 'active' : ''}" data-cmode="day">Diário</button>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="cal-today">Hoje</button>
        </div>

        ${gridHTML}

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">${Utils.formatDate(selectedDate)}</h3>${conflicts.size ? `<span class="badge badge-warning">⚠ Conflito de horário</span>` : `<span class="badge">${dayEvents.length} evento(s)</span>`}
          </div>
          ${
            dayEvents.length === 0
              ? `<div class="empty-state"><p class="text-secondary">Nenhum compromisso neste dia.</p></div>`
              : `<div class="timeline">
                  ${dayEvents
                    .map(
                      (ev) => `
                    <div class="timeline-item">
                      <div class="timeline-time">${Utils.escapeHTML(ev.startTime)}<br><span class="text-muted" style="font-size:10px;">${Utils.escapeHTML(ev.endTime || '')}</span></div>
                      <div class="timeline-card ${conflicts.has(ev.id) ? 'conflict' : ''}">
                        <div class="row-between">
                          <strong>${Utils.escapeHTML(ev.title)}</strong>
                          <div class="row-gap-sm">
                            <button type="button" class="icon-btn-sm" data-edit-ev="${ev.id}">✎</button>
                            <button type="button" class="icon-btn-sm" data-del-ev="${ev.id}">🗑</button>
                          </div>
                        </div>
                        <div class="row-gap-sm" style="margin-top:5px;">
                          <span class="badge">${Utils.escapeHTML(ev.category \vert{}\vert{} 'Pessoal')}</span>${ev.location ? `<span class="kpi-sub">📍 ${Utils.escapeHTML(ev.location)}</span>` : ''}
                        </div>
                        ${ev.description ? `<p class="text-secondary" style="font-size:12.5px; margin-top:5px;">${Utils.escapeHTML(ev.description)}</p>` : ''}
                      </div>
                    </div>
                  `
                    )
                    .join('')}
                </div>`
          }
        </div>
      `;

      document.getElementById('btn-new-evt')?.addEventListener('click', () => this.openForm(null, selectedDate));
      document.getElementById('cal-today')?.addEventListener('click', () => { selectedDate = Utils.todayISO(); this.render(container); });
      container.querySelectorAll('[data-cmode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.cmode; this.render(container); }));
      container.querySelectorAll('[data-cdate]').forEach((b) => b.addEventListener('click', () => { selectedDate = b.dataset.cdate; this.render(container); }));

      document.getElementById('cal-prev')?.addEventListener('click', () => {
        const d = new Date(y, m - 2, 1);
        selectedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
        this.render(container);
      });
      document.getElementById('cal-next')?.addEventListener('click', () => {
        const d = new Date(y, m, 1);
        selectedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
        this.render(container);
      });

      container.querySelectorAll('[data-edit-ev]').forEach((b) =>
        b.addEventListener('click', async () => {
          const ev = await DB.get('events', b.dataset.editEv);
          if (ev) this.openForm(ev);
        })
      );
      container.querySelectorAll('[data-del-ev]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (await Nav.confirm('Excluir compromisso', 'Remover este compromisso?')) {
            await DB.delete('events', b.dataset.delEv);
            Nav.toast('Compromisso excluído.');
            Nav.renderCurrentView();
          }
        })
      );
    },

    openForm(existing = null, defaultDate = null) {
      const isEdit = Boolean(existing);
      const ev = existing || {
        title: '', startDate: defaultDate || selectedDate, startTime: '09:00',
        endTime: '10:00', location: '', category: 'Pessoal', description: ''
      };

      const body = Nav.openModal(
        isEdit ? 'Editar Compromisso' : 'Novo Compromisso',
        `
        <form id="ev-form" class="form-stack">
          <div class="form-group"><label for="ef-title">Título *</label><input type="text" id="ef-title" class="input" required value="${Utils.escapeHTML(ev.title)}"></div>
          <div class="form-row">
            <div class="form-group"><label for="ef-date">Data *</label><input type="date" id="ef-date" class="input" required value="${Utils.escapeHTML(ev.startDate)}"></div>
            <div class="
