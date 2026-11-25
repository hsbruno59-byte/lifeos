window.LifeOS = window.LifeOS || {};

(function () {
  const { DB, Utils, Nav } = window.LifeOS;
  const STATUSES = ['Planejamento', 'Em andamento', 'Pausado', 'Concluído'];
  let layout = 'list';

  const Projects = {
    async render(container) {
      const projects = await DB.getAll('projects');

      const renderCard = (p) => {
        const tasks = Array.isArray(p.tasks) ? p.tasks : [];
        const done = tasks.filter((t) => t.done).length;
        const pct = tasks.length ? Math.round((done / tasks.length) * 100) : p.status === 'Concluído' ? 100 : 0;
        return `
          <div class="card">
            <div class="row-between" style="margin-bottom:6px;">
              <div>
                <span class="badge ${p.status === 'Concluído' ? 'badge-accent' : 'badge-info'}">${Utils.escapeHTML(p.status)}</span>
                <h3 style="font-size:15.5px; margin-top:4px;">${Utils.escapeHTML(p.name)}</h3>
              </div>
              <div class="row-gap-sm">
                <button type="button" class="icon-btn-sm" data-pedit="${p.id}">✎</button>
                <button type="button" class="icon-btn-sm" data-pdel="${p.id}">🗑</button>
              </div>
            </div>
            ${p.description ? `<p class="text-secondary" style="font-size:13px; margin-bottom:8px;">${Utils.escapeHTML(p.description)}</p>` : ''}
            <div class="row-between" style="margin-bottom:4px;">
              <span class="kpi-sub">${done}/${tasks.length} etapas</span>
              <span class="badge badge-accent mono">${pct}%</span>
            </div>
            <div class="progress-track" style="margin-bottom:8px;"><div class="progress-fill" style="width:${pct}%;"></div></div>
            ${tasks
              .map(
                (t) => `
              <label style="display:flex;align-items:center;gap:7px;font-size:13px;margin-top:5px;">
                <input type="checkbox" data-ptask="${p.id}" data-ptid="${t.id}" ${t.done ? 'checked' : ''} style="accent-color:var(--accent);">
                <span style="${t.done ? 'text-decoration:line-through;' : ''}">${Utils.escapeHTML(t.title)}</span>
              </label>
            `
              )
              .join('')}
            ${p.deadline ? `<div class="kpi-sub" style="margin-top:8px;">Prazo: ${Utils.formatDate(p.deadline)}</div>` : ''}
          </div>
        `;
      };

      container.innerHTML = `
        <div class="section-heading">
          <h2>Projetos</h2>
          <div class="row-gap-sm">
            <button type="button" id="btn-pl-toggle" class="btn btn-secondary btn-sm">${layout === 'list' ? 'Kanban' : 'Lista'}</button>
            <button type="button" id="btn-new-proj" class="btn btn-primary btn-sm">+ Projeto</button>
          </div>
        </div>

        ${
          projects.length === 0
            ? `<div class="empty-state"><p class="text-secondary">Nenhum projeto criado.</p></div>`
            : layout === 'list'
            ? `<div class="item-list">${projects.map(renderCard).join('')}</div>`
            : `<div class="kanban-board">
                ${STATUSES.map((st) => {
                  const items = projects.filter((p) => p.status === st);
                  return `
                    <div class="kanban-col">
                      <div class="row-between"><strong>${st}</strong><span class="badge">${items.length}</span></div>
                      ${items.map(renderCard).join('')}
                    </div>
                  `;
                }).join('')}
              </div>`
        }
      `;

      document.getElementById('btn-pl-toggle')?.addEventListener('click', () => { layout = layout === 'list' ? 'kanban' : 'list'; this.render(container); });
      document.getElementById('btn-new-proj')?.addEventListener('click', () => this.openForm());

      container.querySelectorAll('[data-ptask]').forEach((chk) =>
        chk.addEventListener('change', async () => {
          const p = await DB.get('projects', chk.dataset.ptask);
          if (!p) return;
          p.tasks = (p.tasks || []).map((t) => (t.id === chk.dataset.ptid ? { ...t, done: chk.checked } : t));
          await DB.put('projects', p);
          Nav.renderCurrentView();
        })
      );
      container.querySelectorAll('[data-pedit]').forEach((b) =>
        b.addEventListener('click', async () => {
          const p = await DB.get('projects', b.dataset.pedit);
          if (p) this.openForm(p);
        })
      );
      container.querySelectorAll('[data-pdel]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (await Nav.confirm('Excluir projeto', 'Remover este projeto?')) {
            await DB.delete('projects', b.dataset.pdel);
            Nav.toast('Projeto excluído.');
            Nav.renderCurrentView();
          }
        })
      );
    },

    openForm(existing = null) {
      const isEdit = Boolean(existing);
      const p = existing || { name: '', description: '', status: 'Em andamento', deadline: '', tasks: [] };

      const body = Nav.openModal(
        isEdit ? 'Editar Projeto' : 'Novo Projeto',
        `
        <form id="pf-form" class="form-stack">
          <div class="form-group"><label>Nome *</label><input type="text" id="pf-n" class="input" required value="${Utils.escapeHTML(p.name)}"></div>
          <div class="form-row">
            <div class="form-group">
              <label>Status</label>
              <select id="pf-s" class="input">${STATUSES.map((s) => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Prazo</label><input type="date" id="pf-d" class="input" value="${Utils.escapeHTML(p.deadline)}"></div>
          </div>
          <div class="form-group"><label>Descrição</label><textarea id="pf-desc" class="input">${Utils.escapeHTML(p.description)}</textarea></div>
          <div class="form-group"><label>Checklist de Etapas (uma por linha)</label><textarea id="pf-t" class="input">${Utils.escapeHTML((p.tasks || []).map((t) => t.title).join('\n'))}</textarea></div>
          <button type="submit" class="btn btn-primary btn-block">Salvar Projeto</button>
        </form>
      `
      );

      body.querySelector('#pf-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = body.querySelector('#pf-n').value.trim();
        if (!name) return;
        const prev = Array.isArray(p.tasks) ? p.tasks : [];
        const tasks = body
          .querySelector('#pf-t')
          .value.split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((title, i) => {
            const old = prev.find((t) => t.title === title);
            return { id: old ? old.id : Utils.uid(`pt_${i}`), title, done: old ? old.done : false };
          });

        await DB.put('projects', {
          ...p,
          id: isEdit ? p.id : Utils.uid('proj'),
          name,
          status: body.querySelector('#pf-s').value,
          deadline: body.querySelector('#pf-d').value,
          description: body.querySelector('#pf-desc').value.trim(),
          tasks,
          createdAt: p.createdAt || new Date().toISOString()
        });
        Nav.closeModal();
        Nav.toast('Projeto salvo!');
        Nav.renderCurrentView();
      });
    }
  };

  window.LifeOS.Projects = Projects;
})();
