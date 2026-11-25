window.LifeOS = window.LifeOS || {};

(function () {
  const { DB, Prefs, Utils, Nav } = window.LifeOS;
  let mode = 'month';
  let selectedDate = Utils.todayISO();

  const toMin = (t) => {
    if (!t || !t.includes(':')) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const getConflicts = (list) => {
    const ids = new Set();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a1 = toMin(list[i].startTime);
        const a2 = Math.max(a1 + 15, toMin(list[i].endTime || list[i].startTime));
        const b1 = toMin(list[j].startTime);
        const b2 = Math.max(b1 + 15, toMin(list[j].endTime || list[j].startTime));
        if (a1 < b2 && b1 < a2) {
          ids.add(list[i].id);
          ids.add(list[j].id);
        }
      }
    }
    return ids;
  };

  const Calendar = {
    async render(container) {
      const events = await DB.getAll('events');
      const today = Utils.todayISO();
      const [y, m] = selectedDate.split('-').map(Number);
      const weekStart = Number(Prefs.get('weekStart')) || 0;
      const baseDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const daysHeader = weekStart === 1 ? [...baseDays.slice(1), baseDays[0]] : baseDays;

      const dayEvents = events
        .filter((e) => e.startDate === selectedDate)
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      const conflicts = getConflicts(dayEvents);

      let gridHTML = '';
      if (mode === 'month') {
        const firstOffset = (new Date(y, m - 1, 1).getDay() - weekStart + 7) % 7;
        const totalDays = new Date(y, m, 0).getDate();
        const cells = Array(firstOffset).fill('<div class="cal-day other-month"></div>');
        for (let d = 1; d <= totalDays; d++) {
          const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const has = events.some((e) => e.startDate === iso);
          cells.push(`
            <button type="button" class="cal-day ${iso === today ? 'today' : ''} ${iso === selectedDate ? 'selected' : ''}" data-cdate="${iso}">
              <span>${d}</span>
              ${has ? '<span class="cal-dot"></span>' : ''}
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
            <h3 class="card-title">${Utils.formatDate(selectedDate)}</h3>
            ${conflicts.size ? `<span class="badge badge-warning">⚠ Conflito de horário</span>` : `<span class="badge">${dayEvents.length} evento(s)</span>`}
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
                          <span class="badge">${Utils.escapeHTML(ev.category || 'Pessoal')}</span>
                          ${ev.location ? `<span class="kpi-sub">📍 ${Utils.escapeHTML(ev.location)}</span>` : ''}
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
            <div class="form-group"><label for="ef-cat">Categoria</label><input type="text" id="ef-cat" class="input" value="${Utils.escapeHTML(ev.category)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label for="ef-start">Início *</label><input type="time" id="ef-start" class="input" required value="${Utils.escapeHTML(ev.startTime)}"></div>
            <div class="form-group"><label for="ef-end">Término</label><input type="time" id="ef-end" class="input" value="${Utils.escapeHTML(ev.endTime)}"></div>
          </div>
          <div class="form-group"><label for="ef-loc">Local</label><input type="text" id="ef-loc" class="input" value="${Utils.escapeHTML(ev.location)}"></div>
          <div class="form-group"><label for="ef-desc">Descrição</label><textarea id="ef-desc" class="input">${Utils.escapeHTML(ev.description)}</textarea></div>
          <button type="submit" class="btn btn-primary btn-block">Salvar Compromisso</button>
        </form>
      `
      );

      body.querySelector('#ev-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = body.querySelector('#ef-title').value.trim();
        const startDate = body.querySelector('#ef-date').value;
        if (!title || !startDate) return;
        await DB.put('events', {
          ...ev,
          id: isEdit ? ev.id : Utils.uid('evt'),
          title,
          startDate,
          startTime: body.querySelector('#ef-start').value,
          endTime: body.querySelector('#ef-end').value,
          category: body.querySelector('#ef-cat').value.trim() || 'Pessoal',
          location: body.querySelector('#ef-loc').value.trim(),
          description: body.querySelector('#ef-desc').value.trim(),
          createdAt: ev.createdAt || new Date().toISOString()
        });
        selectedDate = startDate;
        Nav.closeModal();
        Nav.toast('Compromisso salvo!');
        Nav.renderCurrentView();
      });
    }
  };

  window.LifeOS.Calendar = Calendar;
})();
