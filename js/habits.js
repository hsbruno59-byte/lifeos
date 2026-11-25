window.LifeOS = window.LifeOS || {};

(function () {
  const { DB, Utils, Nav } = window.LifeOS;
  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  function statsFor(habit, logs) {
    const today = Utils.todayISO();
    const target = Math.max(1, Number(habit.dailyTarget || 1));
    const doneSet = new Set(
      logs.filter((l) => l.habitId === habit.id && (l.completed || Number(l.count || 0) >= target)).map((l) => l.date)
    );

    let streak = 0;
    let cur = doneSet.has(today) ? today : Utils.addDays(today, -1);
    while (doneSet.has(cur)) {
      streak++;
      cur = Utils.addDays(cur, -1);
    }

    let best = 0, run = 0, prev = null;
    Array.from(doneSet).sort().forEach((d) => {
      run = prev && Utils.addDays(prev, 1) === d ? run + 1 : 1;
      if (run > best) best = run;
      prev = d;
    });

    let last30 = 0;
    for (let i = 0; i < 30; i++) if (doneSet.has(Utils.addDays(today, -i))) last30++;

    return { streak, best, rate: Math.round((last30 / 30) * 100) };
  }

  const Habits = {
    async render(container) {
      const [habits, logs] = await Promise.all([DB.getAll('habits'), DB.getAll('habitLogs')]);
      const today = Utils.todayISO();

      const wLabels = [], wVals = [];
      for (let i = 6; i >= 0; i--) {
        const d = Utils.addDays(today, -i);
        wLabels.push(`${d.slice(8, 10)}/${d.slice(5, 7)}`);
        wVals.push(
          habits.filter((h) => {
            const target = Math.max(1, Number(h.dailyTarget || 1));
            const l = logs.find((x) => x.habitId === h.id && x.date === d);
            return l && (l.completed || Number(l.count || 0) >= target);
          }).length
        );
      }

      container.innerHTML = `
        <div class="section-heading">
          <h2>Hábitos</h2>
          <button type="button" id="btn-new-habit" class="btn btn-primary btn-sm">+ Hábito</button>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Consistência Semanal</h3></div>
          <canvas id="hab-chart" class="chart-canvas" style="height:145px;"></canvas>
        </div>

        ${
          habits.length === 0
            ? `<div class="empty-state"><p class="text-secondary">Nenhum hábito cadastrado.</p></div>`
            : `<div class="item-list">
                ${habits
                  .map((h) => {
                    const st = statsFor(h, logs);
                    const target = Math.max(1, Number(h.dailyTarget || 1));
                    const tLog = logs.find((l) => l.habitId === h.id && l.date === today);
                    const count = tLog ? Number(tLog.count || 0) : 0;
                    const doneToday = count >= target || Boolean(tLog && tLog.completed);

                    const cells = [];
                    for (let i = 29; i >= 0; i--) {
                      const d = Utils.addDays(today, -i);
                      const l = logs.find((x) => x.habitId === h.id && x.date === d);
                      const c = l ? Number(l.count || 0) : 0;
                      const full = c >= target || Boolean(l && l.completed);
                      cells.push(`<button type="button" class="heat-cell ${full ? 'done' : c > 0 ? 'partial' : ''}" data-hlog="${h.id}" data-hdate="${d}">${d.slice(8, 10)}</button>`);
                    }

                    return `
                    <div class="card">
                      <div class="row-between" style="margin-bottom:10px;">
                        <div>
                          <strong>${Utils.escapeHTML(h.icon || '✦')} ${Utils.escapeHTML(h.name)}</strong>
                          <div class="kpi-sub">Meta: ${target} ${Utils.escapeHTML(h.unit || 'vez')}</div>
                        </div>
                        <div class="row-gap-sm">
                          <button type="button" class="btn btn-sm ${doneToday ? 'btn-primary' : 'btn-secondary'}" data-hinc="${h.id}">${doneToday ? `✓ ${count}/${target}` : `+1 (${count}/${target})`}</button>
                          <button type="button" class="icon-btn-sm" data-hedit="${h.id}">✎</button>
                          <button type="button" class="icon-btn-sm" data-hdel="${h.id}">🗑</button>
                        </div>
                      </div>
                      <div class="kpi-grid-4" style="margin-bottom:10px;">
                        <div class="kpi-box"><span class="kpi-label">Atual</span><span class="kpi-value text-accent" style="font-size:16px;">${st.streak}d</span></div>
                        <div class="kpi-box"><span class="kpi-label">Recorde</span><span class="kpi-value" style="font-size:16px;">${st.best}d</span></div>
                        <div class="kpi-box"><span class="kpi-label">Taxa 30d</span><span class="kpi-value" style="font-size:16px;">${st.rate}%</span></div>
                        <div class="kpi-box"><span class="kpi-label">Dias</span><span class="kpi-value" style="font-size:12px;">${h.frequency === 'daily' ? 'Todos' : (h.daysOfWeek || []).map((d) => DAYS[d]).join(',')}</span></div>
                      </div>
                      <div class="kpi-sub" style="margin-bottom:5px;">Histórico 30 dias (toque para corrigir):</div>
                      <div class="heatmap-grid">${cells.join('')}</div>
                    </div>
                  `;
                  })
                  .join('')}
              </div>`
        }
      `;

      Utils.drawBarChart(document.getElementById('hab-chart'), wLabels, wVals);

      document.getElementById('btn-new-habit')?.addEventListener('click', () => this.openForm());
      container.querySelectorAll('[data-hinc]').forEach((b) =>
        b.addEventListener('click', async () => {
          const h = await DB.get('habits', b.dataset.hinc);
          if (!h) return;
          const target = Math.max(1, Number(h.dailyTarget || 1));
          const id = `${h.id}_${today}`;
          const old = await DB.get('habitLogs', id);
          const next = (old ? Number(old.count || 0) : 0) >= target ? 0 : (old ? Number(old.count || 0) : 0) + 1;
          await DB.put('habitLogs', { id, habitId: h.id, date: today, count: next, note: old?.note || '', completed: next >= target });
          Nav.renderCurrentView();
        })
      );

      container.querySelectorAll('[data-hlog]').forEach((b) =>
        b.addEventListener('click', async () => {
          const h = await DB.get('habits', b.dataset.hlog);
          if (!h) return;
          const date = b.dataset.hdate;
          const id = `${h.id}_${date}`;
          const old = (await DB.get('habitLogs', id)) || { count: 0, note: '' };
          const body = Nav.openModal(
            `${h.name} • ${Utils.formatDate(date)}`,
            `
            <form id="hl-form" class="form-stack">
              <div class="form-group"><label>Quantidade realizada</label><input type="number" id="hl-c" class="input" min="0" value="${old.count}"></div>
              <div class="form-group"><label>Observação</label><textarea id="hl-n" class="input">${Utils.escapeHTML(old.note || '')}</textarea></div>
              <button type="submit" class="btn btn-primary btn-block">Salvar Registro</button>
            </form>
          `
          );
          body.querySelector('#hl-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const count = Math.max(0, Number(body.querySelector('#hl-c').value) || 0);
            await DB.put('habitLogs', {
              id, habitId: h.id, date, count,
              note: body.querySelector('#hl-n').value.trim(),
              completed: count >= Math.max(1, Number(h.dailyTarget || 1))
            });
            Nav.closeModal();
            Nav.toast('Registro atualizado!');
            Nav.renderCurrentView();
          });
        })
      );

      container.querySelectorAll('[data-hedit]').forEach((b) =>
        b.addEventListener('click', async () => {
          const h = await DB.get('habits', b.dataset.hedit);
          if (h) this.openForm(h);
        })
      );
      container.querySelectorAll('[data-hdel]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (await Nav.confirm('Excluir hábito', 'Remover este hábito?')) {
            await DB.delete('habits', b.dataset.hdel);
            Nav.toast('Hábito excluído.');
            Nav.renderCurrentView();
          }
        })
      );
    },

    openForm(existing = null) {
      const isEdit = Boolean(existing);
      const h = existing || { name: '', frequency: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], dailyTarget: 1, unit: 'vez', icon: '✦' };

      const body = Nav.openModal(
        isEdit ? 'Editar Hábito' : 'Novo Hábito',
        `
        <form id="hf-form" class="form-stack">
          <div class="form-group"><label>Nome *</label><input type="text" id="hf-name" class="input" required value="${Utils.escapeHTML(h.name)}" placeholder="Ex: Beber água, Ler, Meditar"></div>
          <div class="form-row">
            <div class="form-group"><label>Meta diária *</label><input type="number" id="hf-target" class="input" min="1" required value="${h.dailyTarget}"></div>
            <div class="form-group"><label>Unidade</label><input type="text" id="hf-unit" class="input" value="${Utils.escapeHTML(h.unit)}"></div>
          </div>
          <div class="form-group">
            <label>Frequência</label>
            <select id="hf-freq" class="input">
              <option value="daily" ${h.frequency === 'daily' ? 'selected' : ''}>Todos os dias</option>
              <option value="specific" ${h.frequency === 'specific' ? 'selected' : ''}>Dias específicos</option>
            </select>
          </div>
          <div class="chip-row">
            ${DAYS.map((d, i) => `<label class="chip"><input type="checkbox" class="hf-d" value="${i}" ${(h.daysOfWeek || []).includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}
          </div>
          <button type="submit" class="btn btn-primary btn-block">Salvar Hábito</button>
        </form>
      `
      );

      body.querySelector('#hf-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = body.querySelector('#hf-name').value.trim();
        if (!name) return;
        const days = Array.from(body.querySelectorAll('.hf-d:checked')).map((c) => Number(c.value));
        await DB.put('habits', {
          ...h,
          id: isEdit ? h.id : Utils.uid('hab'),
          name,
          dailyTarget: Math.max(1, Number(body.querySelector('#hf-target').value) || 1),
          unit: body.querySelector('#hf-unit').value.trim() || 'vez',
          frequency: body.querySelector('#hf-freq').value,
          daysOfWeek: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
          createdAt: h.createdAt || new Date().toISOString()
        });
        Nav.closeModal();
        Nav.toast('Hábito salvo!');
        Nav.renderCurrentView();
      });
    }
  };

  window.LifeOS.Habits = Habits;
})();
