window.LifeOS = window.LifeOS || {};

(function () {
  const { DB, Utils, Nav } = window.LifeOS;
  let search = '';
  let catFilter = 'all';

  const Notes = {
    async render(container) {
      const notes = await DB.getAll('notes');
      const cats = Array.from(new Set(notes.map((n) => n.category).filter(Boolean)));

      let list = notes
        .slice()
        .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));

      if (catFilter !== 'all') list = list.filter((n) => n.category === catFilter);
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(
          (n) =>
            (n.title || '').toLowerCase().includes(q) ||
            (n.content || '').toLowerCase().includes(q) ||
            (n.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      }

      container.innerHTML = `
        <div class="section-heading">
          <h2>Notas</h2>
          <button type="button" id="btn-new-note" class="btn btn-primary btn-sm">+ Nota</button>
        </div>

        <input type="search" id="n-search" class="input" placeholder="Buscar notas ou etiquetas..." value="${Utils.escapeHTML(search)}">

        ${
          cats.length
            ? `<div class="chip-row">
                <button type="button" class="chip ${catFilter === 'all' ? 'active' : ''}" data-nc="all">Todas (${notes.length})</button>
                ${cats.map((c) => `<button type="button" class="chip ${catFilter === c ? 'active' : ''}" data-nc="${Utils.escapeHTML(c)}">${Utils.escapeHTML(c)}</button>`).join('')}
              </div>`
            : ''
        }

        ${
          list.length === 0
            ? `<div class="empty-state"><p class="text-secondary">Nenhuma nota encontrada.</p></div>`
            : `<div class="item-list">
                ${list
                  .map(
                    (n) => `
                  <div class="card">
                    <div class="row-between" style="margin-bottom:6px;">
                      <strong>${n.pinned ? '📌 ' : ''}${Utils.escapeHTML(n.title)}</strong>
                      <div class="row-gap-sm">
                        <button type="button" class="icon-btn-sm" data-npin="${n.id}" title="Fixar">${n.pinned ? '★' : '☆'}</button>
                        <button type="button" class="icon-btn-sm" data-nedit="${n.id}">✎</button>
                        <button type="button" class="icon-btn-sm" data-ndel="${n.id}">🗑</button>
                      </div>
                    </div>
                    <p class="text-secondary" style="font-size:13.5px; white-space:pre-line; margin-bottom:8px;">${Utils.escapeHTML((n.content || '').slice(0, 260))}${(n.content || '').length > 260 ? '...' : ''}</p>
                    <div class="row-gap-sm">
                      ${n.category ? `<span class="badge">${Utils.escapeHTML(n.category)}</span>` : ''}
                      ${(n.tags || []).map((t) => `<span class="badge">#${Utils.escapeHTML(t)}</span>`).join('')}
                      <span class="kpi-sub">${Utils.formatDate(n.updatedAt)}</span>
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </div>`
        }
      `;

      document.getElementById('btn-new-note')?.addEventListener('click', () => this.openForm());
      document.getElementById('n-search')?.addEventListener('input', (e) => { search = e.target.value; this.render(container); });
      container.querySelectorAll('[data-nc]').forEach((b) => b.addEventListener('click', () => { catFilter = b.dataset.nc; this.render(container); }));
      container.querySelectorAll('[data-npin]').forEach((b) =>
        b.addEventListener('click', async () => {
          const n = await DB.get('notes', b.dataset.npin);
          if (!n) return;
          n.pinned = !n.pinned;
          await DB.put('notes', n);
          Nav.renderCurrentView();
        })
      );
      container.querySelectorAll('[data-nedit]').forEach((b) =>
        b.addEventListener('click', async () => {
          const n = await DB.get('notes', b.dataset.nedit);
          if (n) this.openForm(n);
        })
      );
      container.querySelectorAll('[data-ndel]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (await Nav.confirm('Excluir nota', 'Remover esta nota permanentemente?')) {
            await DB.delete('notes', b.dataset.ndel);
            Nav.toast('Nota excluída.');
            Nav.renderCurrentView();
          }
        })
      );
    },

    openForm(existing = null) {
      const isEdit = Boolean(existing);
      const n = existing || { title: '', category: 'Pessoal', tags: [], content: '', pinned: false };

      const body = Nav.openModal(
        isEdit ? 'Editar Nota' : 'Nova Nota',
        `
        <form id="nf-form" class="form-stack">
          <div class="form-group"><label>Título *</label><input type="text" id="nf-t" class="input" required value="${Utils.escapeHTML(n.title)}"></div>
          <div class="form-row">
            <div class="form-group"><label>Categoria</label><input type="text" id="nf-c" class="input" value="${Utils.escapeHTML(n.category)}"></div>
            <div class="form-group"><label>Etiquetas (vírgula)</label><input type="text" id="nf-tags" class="input" value="${Utils.escapeHTML((n.tags || []).join(', '))}"></div>
          </div>
          <div class="form-group"><label>Conteúdo *</label><textarea id="nf-body" class="input" style="min-height:150px;" required>${Utils.escapeHTML(n.content)}</textarea></div>
          <label class="checkbox-card"><input type="checkbox" id="nf-pin" ${n.pinned ? 'checked' : ''}><span>Fixar nota no topo</span></label>
          <button type="submit" class="btn btn-primary btn-block">Salvar Nota</button>
        </form>
      `
      );

      body.querySelector('#nf-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = body.querySelector('#nf-t').value.trim();
        const content = body.querySelector('#nf-body').value.trim();
        if (!title || !content) return;
        await DB.put('notes', {
          ...n,
          id: isEdit ? n.id : Utils.uid('note'),
          title,
          category: body.querySelector('#nf-c').value.trim() || 'Pessoal',
          tags: body.querySelector('#nf-tags').value.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean),
          content,
          pinned: body.querySelector('#nf-pin').checked,
          updatedAt: new Date().toISOString()
        });
        Nav.closeModal();
        Nav.toast('Nota salva!');
        Nav.renderCurrentView();
      });
    }
  };

  window.LifeOS.Notes = Notes;
})();
