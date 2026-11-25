window.LifeOS = window.LifeOS || {};

(function () {
  const { DB, Utils, Nav } = window.LifeOS;
  const CATS = ['Financeiras', 'Profissionais', 'Acadêmicas', 'Pessoais', 'Saúde e bem-estar', 'Projetos'];
  let catFilter = 'all';

  const Goals = {
    async render(container) {
      const goals = await DB.getAll('goals');
      const filtered = catFilter === 'all' ? goals : goals.filter((g) => g.category === catFilter);

      const pcts = goals.map((g) => Math.min(100, Math.round((Math.max(0, Number(g.currentValue || 0)) / Math.max(1, Number(g.targetValue || 1))) * 100)));
      const done = pcts.filter((p) => p >= 100).length;
      const avg = pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : 0;

      container.innerHTML = `
        <div class="section-heading">
          <h2>Objetivos</h2>
          <button type="button" id="btn-new-goal" class="btn btn-primary btn-sm">+ Objetivo</button>
        </div>

        <div class="kpi-grid">
          <div class="kpi-box"><span class="kpi-label">Progresso Geral</span><span class="kpi-value text-accent">${avg}%</span></div>
          <div class="kpi-box"><span class="kpi-label">Concluídos</span><span class="kpi-value">${done}/${goals.length}</span></div>
        </div>

        <div class="chip-row">
          <button type="button" class="chip ${catFilter === 'all' ? 'active' : ''}" data-gc="all">Todas</button>
          ${CATS.map((c) => `<button type="button" class="chip ${catFilter === c ? 'active' : ''}" data-gc="${c}">${c}</button>`).join('')}
        </div>

        ${
          filtered.length === 0
            ? `<div class="empty-state"><p class="text-secondary">Nenhum objetivo nesta categoria.</p></div>`
            : `<div class="item-list">
                ${filtered
                  .map((g) => {
                    const target = Math.max(1, Number(g.targetValue || 1));
                    const cur = Math.max(0, Number(g.currentValue || 0));
                    const pct = Math.min(100, Math.round((cur / target) * 100));
                    return `
                    <div class="card">
                      <div class="row-between" style="margin-bottom:6px;">
                        <div>
                          <span class="badge badge-info">${Utils.escapeHTML(g.category)}</span>
                          <h3 style="font-size:16px; margin-top:4px;">${Utils.escapeHTML(g.name)}</h3>
                        </div>
                        <div class="row-gap-sm">
                          <button type="button" class="btn btn-secondary btn-sm" data-gprog="${g.id}">Evolução</button>
                          <button type="button" class="icon-btn-sm" data-gedit="${g.id}">✎</button>
                          <button type="button" class="icon-btn-sm" data-gdel="${g.id}">🗑</button>
                        </div>
                      </div>
                      ${g.description ? `<p class="text-secondary" style="font-size:13px; margin-bottom:8px;">${Utils.escapeHTML(g.description)}</p>` : ''}
                      <div class="row-between" style="margin-bottom:4px;">
                        <span class="kpi-sub mono">${cur} / ${target} ${Utils.escapeHTML(g.unit || '')}</span>
                        <strong class="text-accent mono">${pct}%</strong>
                      </div>
                      <div class="progress-track" style="margin-bottom:8px;"><div class="progress-fill" style="width:${pct}%;"></div></div>
                      <div class="row-between">
                        <span class="kpi-sub">Criado: ${Utils.formatDate(g.createdAt)}</span>
                        <span class="kpi-sub">Prazo: ${Utils.formatDate(g.deadline)}</span>
                      </div>
                      ${(g.steps || [])
                        .map(
                          (st) => `
                        <label style="display:flex;align-items:center;gap:7px;font-size:13px;margin-top:6px;">
                          <input type="checkbox" data-gstep="${g.id}" data-sid="${st.id}" ${st.done ? 'checked' : ''} style="accent-color:var(--accent);">
                          <span style="${st.done ? 'text-decoration:line-through;' : ''}">${Utils.escapeHTML(st.title)}</span>
                        </label>
                      `
                        )
                        .join('')}
                    </div>
                  `;
                  })
                  .join('')}
              </div>`
        }
      `;

      document.getElementById('btn-new-goal')?.addEventListener('click', () => this.openForm());
      container.querySelectorAll('[data-gc]').forEach((b) => b.addEventListener('click', () => { catFilter = b.dataset.gc; this.render(container); }));
      container.querySelectorAll('[data-gprog]').forEach((b) => b.addEventListener('click', () => this.openProgress(b.dataset.gprog)));
      container.querySelectorAll('[data-gstep]').forEach((chk) =>
        chk.addEventListener('change', async () => {
          const g = await DB.get('goals', chk.dataset.gstep);
          if (!g) return;
          g.steps = (g.steps || []).map((s) => (s.id === chk.dataset.sid ? { ...s, done: chk.checked } : s));
          await DB.put('goals', g);
          Nav.renderCurrentView();
        })
      );
      container.querySelectorAll('[data-gedit]').forEach((b) =>
        b.addEventListener('click', async () => {
          const g = await DB.get('goals', b.dataset.gedit);
          if (g) this.openForm(g);
        })
      );
      container.querySelectorAll('[data-gdel]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (await Nav.confirm('Excluir objetivo', 'Remover este objetivo?')) {
            await DB.delete('goals', b.dataset.gdel);
            Nav.toast('Objetivo excluído.');
            Nav.renderCurrentView();
          }
        })
      );
    },

    async openProgress(id) {
      const g = await DB.get('goals', id);
      if (!g) return;
      const hist = Array.isArray(g.history) ? g.history : [];
      const body = Nav.openModal(
        `Evolução • ${g.name}`,
        `
        <form id="gp-f" class="form-stack">
          <div class="form-group"><label>Valor atual (Meta: ${g.targetValue})</label><input type="number" id="gp-v" class="input" step="any" min="0" required value="${g.currentValue}"></div>
          <div class="form-group"><label>Observação</label><input type="text" id="gp-n" class="input" placeholder="Ex: Novo avanço"></div>
          <button type="submit" class="btn btn-primary btn-block">Registrar Progresso</button>
        </form>
        <div class="item-list" style="margin-top:14px;">
          ${hist
            .slice()
            .reverse()
            .map((h) => `<div class="card-subtle row-between"><span>${h.value} ${Utils.escapeHTML(g.unit || '')} — ${Utils.escapeHTML(h.note || '')}</span><span class="badge">${Utils.formatDate(h.date)}</span></div>`)
            .join('')}
        </div>
      `
      );
      body.querySelector('#gp-f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const val = Math.max(0, Number(body.querySelector('#gp-v').value) || 0);
        g.currentValue = val;
        g.history = [...hist, { date: Utils.todayISO(), value: val, note: body.querySelector('#gp-n').value.trim() }];
        await DB.put('goals', g);
        Nav.closeModal();
        Nav.toast('Progresso atualizado!');
        Nav.renderCurrentView();
      });
    },

    openForm(existing = null) {
      const isEdit = Boolean(existing);
      const g = existing || {
        name: '', description: '', category: 'Pessoais', createdAt: Utils.todayISO(),
        deadline: Utils.addDays(Utils.todayISO(), 90), targetValue: 100, currentValue: 0, unit: '%', steps: [], history: [], notes: ''
      };
      const body = Nav.openModal(
        isEdit ? 'Editar Objetivo' : 'Novo Objetivo',
        `
        <form id="gf-f" class="form-stack">
          <div class="form-group"><label>Nome *</label><input type="text" id="gf-n" class="input" required value="${Utils.escapeHTML(g.name)}"></div>
          <div class="form-row">
            <div class="form-group"><label>Categoria</label><select id="gf-c" class="input">${CATS.map((c) => `<option value="${c}" ${g.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
            <div class="form-group"><label>Prazo</label><input type="date" id="gf-d" class="input" value="${Utils.escapeHTML(g.deadline)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Meta *</label><input type="number" id="gf-t" class="input" step="any" min="1" required value="${g.targetValue}"></div>
            <div class="form-group"><label>Atual</label><input type="number" id="gf-cur" class="input" step="any" min="0" value="${g.currentValue}"></div>
          </div>
          <div class="form-group"><label>Unidade</label><input type="text" id="gf-u" class="input" value="${Utils.escapeHTML(g.unit)}"></div>
          <div class="form-group"><label>Descrição</label><textarea id="gf-desc" class="input">${Utils.escapeHTML(g.description)}</textarea></div>
          <div class="form-group"><label>Etapas (uma por linha)</label><textarea id="gf-st" class="input">${Utils.escapeHTML((g.steps || []).map((s) => s.title).join('\n'))}</textarea></div>
          <button type="submit" class="btn btn-primary btn-block">Salvar Objetivo</button>
        </form>
      `
      );
      body.querySelector('#gf-f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = body.querySelector('#gf-n').value.trim();
        if (!name) return;
        const prev = Array.isArray(g.steps) ? g.steps : [];
        const steps = body
          .querySelector('#gf-st')
          .value.split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((title, i) => {
            const old = prev.find((s) => s.title === title);
            return { id: old ? old.id : Utils.uid(`gs_${i}`), title, done: old ? old.done : false };
          });
        const currentValue = Math.max(0, Number(body.querySelector('#gf-cur').value) || 0);
        await DB.put('goals', {
          ...g,
          id: isEdit ? g.id : Utils.uid('goal'),
          name,
          category: body.querySelector('#gf-c').value,
          createdAt: g.createdAt || Utils.todayISO(),
          deadline: body.querySelector('#gf-d').value,
          targetValue: Math.max(1, Number(body.querySelector('#gf-t').value) || 1),
          currentValue,
          unit: body.querySelector('#gf-u').value.trim(),
          description: body.querySelector('#gf-desc').value.trim(),
          steps,
          history: Array.isArray(g.history) && g.history.length ? g.history : [{ date: Utils.todayISO(), value: currentValue, note: 'Início' }]
        });
        Nav.closeModal();
        Nav.toast('Objetivo salvo!');
        Nav.renderCurrentView();
      });
    }
  };

  window.LifeOS.Goals = Goals;
})();
