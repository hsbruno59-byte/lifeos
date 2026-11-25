window.LifeOS = window.LifeOS || {};

(function () {
  const { DB, Utils, Nav } = window.LifeOS;
  const EXP_CATS = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Assinaturas', 'Compras', 'Outros'];
  const INC_CATS = ['Salário', 'Freelance', 'Investimentos', 'Vendas', 'Outros'];
  let filterType = 'all';
  let filterMonth = Utils.todayISO().slice(0, 7);

  const Finance = {
    async render(container, sub = 'overview') {
      const [accounts, cards, txs, budgets] = await Promise.all([
        DB.getAll('accounts'),
        DB.getAll('cards'),
        DB.getAll('transactions'),
        DB.getAll('budgets')
      ]);

      const curMonth = Utils.todayISO().slice(0, 7);
      const accList = accounts.map((a) => {
        const inc = txs.filter((t) => t.type === 'income' && t.accountId === a.id).reduce((s, t) => s + Number(t.amount || 0), 0);
        const exp = txs.filter((t) => t.type === 'expense' && t.accountId === a.id && t.paymentMethod !== 'Crédito').reduce((s, t) => s + Number(t.amount || 0), 0);
        return { ...a, balance: Number(a.initialBalance || 0) + inc - exp };
      });
      const totalBal = accList.reduce((s, a) => s + a.balance, 0);

      const mTxs = txs.filter((t) => (t.date || '').startsWith(curMonth));
      const mInc = mTxs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
      const mExp = mTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);

      if (sub === 'overview') {
        const catMap = {};
        mTxs.filter((t) => t.type === 'expense').forEach((t) => {
          catMap[t.category || 'Outros'] = (catMap[t.category || 'Outros'] || 0) + Number(t.amount || 0);
        });
        const donutItems = Object.entries(catMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

        const labels = [], incArr = [], expArr = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          labels.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`);
          incArr.push(txs.filter((t) => t.type === 'income' && (t.date || '').startsWith(ym)).reduce((s, t) => s + Number(t.amount || 0), 0));
          expArr.push(txs.filter((t) => t.type === 'expense' && (t.date || '').startsWith(ym)).reduce((s, t) => s + Number(t.amount || 0), 0));
        }

        container.innerHTML = `
          <div class="section-heading">
            <h2>Finanças</h2>
            <div class="row-gap-sm">
              <button type="button" id="f-inc" class="btn btn-secondary btn-sm">+ Receita</button>
              <button type="button" id="f-exp" class="btn btn-primary btn-sm">− Despesa</button>
            </div>
          </div>
          <div class="kpi-grid">
            <div class="kpi-box"><span class="kpi-label">Saldo Total</span><span class="kpi-value ${totalBal < 0 ? 'text-danger' : 'text-accent'}">${Utils.formatCurrency(totalBal)}</span></div>
            <div class="kpi-box"><span class="kpi-label">Economia Mês</span><span class="kpi-value ${mInc - mExp < 0 ? 'text-danger' : ''}">${Utils.formatCurrency(mInc - mExp)}</span></div>
            <div class="kpi-box"><span class="kpi-label">Receitas</span><span class="kpi-value text-accent">${Utils.formatCurrency(mInc)}</span></div>
            <div class="kpi-box"><span class="kpi-label">Despesas</span><span class="kpi-value text-danger">${Utils.formatCurrency(mExp)}</span></div>
          </div>
          <div class="card"><div class="card-header"><h3 class="card-title">Receitas vs. Despesas</h3></div><canvas id="f-bar" class="chart-canvas"></canvas></div>
          <div class="card"><div class="card-header"><h3 class="card-title">Gastos por Categoria</h3></div><canvas id="f-donut" class="chart-canvas" style="height:160px;"></canvas></div>
        `;
        Utils.drawBarChart(document.getElementById('f-bar'), labels, incArr, expArr);
        Utils.drawDonutChart(document.getElementById('f-donut'), donutItems);
      } else if (sub === 'transactions') {
        const filtered = txs
          .filter((t) => (filterType === 'all' || t.type === filterType) && (!filterMonth || (t.date || '').startsWith(filterMonth)))
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        container.innerHTML = `
          <div class="section-heading">
            <h2>Movimentações</h2>
            <div class="row-gap-sm">
              <button type="button" id="f-inc" class="btn btn-secondary btn-sm">+ Receita</button>
              <button type="button" id="f-exp" class="btn btn-primary btn-sm">− Despesa</button>
            </div>
          </div>
          <div class="form-row">
            <select id="f-ftype" class="input">
              <option value="all" ${filterType === 'all' ? 'selected' : ''}>Todas</option>
              <option value="income" ${filterType === 'income' ? 'selected' : ''}>Receitas</option>
              <option value="expense" ${filterType === 'expense' ? 'selected' : ''}>Despesas</option>
            </select>
            <input type="month" id="f-fmonth" class="input" value="${Utils.escapeHTML(filterMonth)}">
          </div>
          <div class="item-list">
            ${
              filtered.length === 0
                ? `<div class="empty-state"><p class="text-secondary">Nenhum lançamento encontrado.</p></div>`
                : filtered
                    .map(
                      (t) => `
                    <div class="list-item">
                      <div style="flex:1;">
                        <div class="row-between">
                          <strong>${Utils.escapeHTML(t.description)}</strong>
                          <strong class="mono ${t.type === 'income' ? 'text-accent' : 'text-danger'}">${t.type === 'income' ? '+' : '−'} ${Utils.formatCurrency(t.amount)}</strong>
                        </div>
                        <div class="row-gap-sm" style="margin-top:5px;">
                          <span class="badge">${Utils.formatDate(t.date)}</span>
                          <span class="badge">${Utils.escapeHTML(t.category || 'Outros')}</span>
                          ${t.paymentMethod ? `<span class="badge">${Utils.escapeHTML(t.paymentMethod)}</span>` : ''}
                        </div>
                      </div>
                      <button type="button" class="icon-btn-sm" data-del-tx="${t.id}">🗑</button>
                    </div>
                  `
                    )
                    .join('')
            }
          </div>
        `;
        document.getElementById('f-ftype')?.addEventListener('change', (e) => { filterType = e.target.value; this.render(container, 'transactions'); });
        document.getElementById('f-fmonth')?.addEventListener('change', (e) => { filterMonth = e.target.value; this.render(container, 'transactions'); });
        container.querySelectorAll('[data-del-tx]').forEach((b) =>
          b.addEventListener('click', async () => {
            if (await Nav.confirm('Excluir lançamento', 'Remover esta movimentação?')) {
              await DB.delete('transactions', b.dataset.delTx);
              Nav.toast('Lançamento excluído.');
              Nav.renderCurrentView();
            }
          })
        );
      } else if (sub === 'accounts') {
        container.innerHTML = `
          <div class="section-heading">
            <h2>Contas &amp; Cartões</h2>
            <div class="row-gap-sm">
              <button type="button" id="f-add-acc" class="btn btn-secondary btn-sm">+ Conta</button>
              <button type="button" id="f-add-card" class="btn btn-primary btn-sm">+ Cartão</button>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3 class="card-title">Contas</h3><span class="badge badge-accent mono">${Utils.formatCurrency(totalBal)}</span></div>
            ${
              accList.length === 0
                ? `<div class="empty-state"><p class="text-secondary">Nenhuma conta cadastrada.</p></div>`
                : `<div class="item-list">
                    ${accList
                      .map(
                        (a) => `
                      <div class="card-subtle row-between">
                        <div><strong>${Utils.escapeHTML(a.name)}</strong><div class="kpi-sub">${Utils.escapeHTML(a.type)}</div></div>
                        <div class="row-gap-sm"><strong class="mono text-accent">${Utils.formatCurrency(a.balance)}</strong><button type="button" class="icon-btn-sm" data-del-acc="${a.id}">🗑</button></div>
                      </div>
                    `
                      )
                      .join('')}
                  </div>`
            }
          </div>
          <div class="card">
            <div class="card-header"><h3 class="card-title">Cartões</h3></div>
            ${
              cards.length === 0
                ? `<div class="empty-state"><p class="text-secondary">Nenhum cartão cadastrado.</p></div>`
                : `<div class="item-list">
                    ${cards
                      .map((c) => {
                        const spent = mTxs.filter((t) => t.type === 'expense' && t.cardId === c.id).reduce((s, t) => s + Number(t.amount || 0), 0);
                        const pct = Math.min(100, Math.round((spent / Math.max(1, Number(c.limit || 1))) * 100));
                        return `
                        <div class="card-subtle">
                          <div class="row-between" style="margin-bottom:5px;">
                            <div><strong>${Utils.escapeHTML(c.name)}</strong><div class="kpi-sub">Fecha dia ${c.closingDay} • Vence dia ${c.dueDay}</div></div>
                            <button type="button" class="icon-btn-sm" data-del-card="${c.id}">🗑</button>
                          </div>
                          <div class="progress-track" style="margin-bottom:5px;"><div class="progress-fill" style="width:${pct}%;"></div></div>
                          <div class="row-between"><span class="kpi-sub">Fatura: ${Utils.formatCurrency(spent)}</span><span class="kpi-sub">Limite: ${Utils.formatCurrency(c.limit)}</span></div>
                        </div>
                      `;
                      })
                      .join('')}
                  </div>`
            }
          </div>
        `;
        document.getElementById('f-add-acc')?.addEventListener('click', () => this.openAccountForm());
        document.getElementById('f-add-card')?.addEventListener('click', () => this.openCardForm());
        container.querySelectorAll('[data-del-acc]').forEach((b) =>
          b.addEventListener('click', async () => {
            if (await Nav.confirm('Excluir conta', 'Remover esta conta?')) { await DB.delete('accounts', b.dataset.delAcc); Nav.renderCurrentView(); }
          })
        );
        container.querySelectorAll('[data-del-card]').forEach((b) =>
          b.addEventListener('click', async () => {
            if (await Nav.confirm('Excluir cartão', 'Remover este cartão?')) { await DB.delete('cards', b.dataset.delCard); Nav.renderCurrentView(); }
          })
        );
      } else if (sub === 'budget') {
        container.innerHTML = `
          <div class="section-heading">
            <h2>Orçamento Mensal</h2>
            <button type="button" id="f-add-bud" class="btn btn-primary btn-sm">+ Limite</button>
          </div>
          ${
            budgets.length === 0
              ? `<div class="empty-state"><p class="text-secondary">Nenhum limite de orçamento definido.</p></div>`
              : `<div class="item-list">
                  ${budgets
                    .map((b) => {
                      const spent = mTxs.filter((t) => t.type === 'expense' && t.category === b.category).reduce((s, t) => s + Number(t.amount || 0), 0);
                      const lim = Math.max(1, Number(b.monthlyLimit || 1));
                      const pct = Math.min(100, Math.round((spent / lim) * 100));
                      return `
                      <div class="card">
                        <div class="row-between" style="margin-bottom:5px;">
                          <strong>${Utils.escapeHTML(b.category)} ${spent > lim ? '<span class="badge badge-danger">Excedido</span>' : ''}</strong>
                          <button type="button" class="icon-btn-sm" data-del-bud="${b.id}">🗑</button>
                        </div>
                        <div class="progress-track" style="margin-bottom:6px;"><div class="progress-fill ${spent > lim ? 'danger' : pct >= 80 ? 'warning' : ''}" style="width:${pct}%;"></div></div>
                        <div class="row-between"><span class="kpi-sub">Gasto: ${Utils.formatCurrency(spent)} / ${Utils.formatCurrency(lim)}</span><span class="kpi-sub">Restante: ${Utils.formatCurrency(lim - spent)}</span></div>
                      </div>
                    `;
                    })
                    .join('')}
                </div>`
          }
        `;
        document.getElementById('f-add-bud')?.addEventListener('click', () => this.openBudgetForm());
        container.querySelectorAll('[data-del-bud]').forEach((b) =>
          b.addEventListener('click', async () => {
            if (await Nav.confirm('Excluir orçamento', 'Remover este limite?')) { await DB.delete('budgets', b.dataset.delBud); Nav.renderCurrentView(); }
          })
        );
      }

      document.getElementById('f-inc')?.addEventListener('click', () => this.openTransactionForm('income'));
      document.getElementById('f-exp')?.addEventListener('click', () => this.openTransactionForm('expense'));
    },

    async openTransactionForm(type = 'expense') {
      const [accounts, cards] = await Promise.all([DB.getAll('accounts'), DB.getAll('cards')]);
      const isInc = type === 'income';
      const cats = isInc ? INC_CATS : EXP_CATS;

      const body = Nav.openModal(
        isInc ? 'Nova Receita' : 'Nova Despesa',
        `
        <form id="tx-f" class="form-stack">
          <div class="form-group"><label>Descrição *</label><input type="text" id="tx-d" class="input" required></div>
          <div class="form-row">
            <div class="form-group"><label>Valor *</label><input type="number" id="tx-v" class="input" step="0.01" min="0.01" required></div>
            <div class="form-group"><label>Data *</label><input type="date" id="tx-dt" class="input" required value="${Utils.todayISO()}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Categoria</label><select id="tx-c" class="input">${cats.map((c) => `<option value="${c}">${c}</option>`).join('')}</select></div>
            <div class="form-group"><label>Pagamento</label><select id="tx-m" class="input"><option>PIX</option><option>Débito</option><option>Crédito</option><option>Dinheiro</option><option>Transferência</option></select></div>
          </div>
          <div class="form-group"><label>Conta</label><select id="tx-a" class="input"><option value="">Nenhuma</option>${accounts.map((a) => `<option value="${a.id}">${Utils.escapeHTML(a.name)}</option>`).join('')}</select></div>
          ${!isInc && cards.length ? `<div class="form-group"><label>Cartão</label><select id="tx-cd" class="input"><option value="">Nenhum</option>${cards.map((c) => `<option value="${c.id}">${Utils.escapeHTML(c.name)}</option>`).join('')}</select></div>` : ''}
          <button type="submit" class="btn btn-primary btn-block">Salvar Lançamento</button>
        </form>
      `
      );

      body.querySelector('#tx-f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = body.querySelector('#tx-d').value.trim();
        const amount = parseFloat(body.querySelector('#tx-v').value);
        if (!description || isNaN(amount) || amount <= 0) return;
        await DB.put('transactions', {
          id: Utils.uid('tx'),
          type,
          description,
          amount,
          date: body.querySelector('#tx-dt').value || Utils.todayISO(),
          category: body.querySelector('#tx-c').value,
          paymentMethod: body.querySelector('#tx-m').value,
          accountId: body.querySelector('#tx-a').value || '',
          cardId: body.querySelector('#tx-cd')?.value || '',
          createdAt: new Date().toISOString()
        });
        Nav.closeModal();
        Nav.toast('Lançamento registrado!');
        Nav.renderCurrentView();
      });
    },

    openAccountForm() {
      const body = Nav.openModal(
        'Nova Conta',
        `
        <form id="ac-f" class="form-stack">
          <div class="form-group"><label>Nome *</label><input type="text" id="ac-n" class="input" required placeholder="Ex: Nubank, Carteira"></div>
          <div class="form-row">
            <div class="form-group"><label>Tipo</label><select id="ac-t" class="input"><option>Conta corrente</option><option>Dinheiro</option><option>Poupança</option><option>Outras contas</option></select></div>
            <div class="form-group"><label>Saldo inicial</label><input type="number" id="ac-b" class="input" step="0.01" value="0"></div>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Salvar Conta</button>
        </form>
      `
      );
      body.querySelector('#ac-f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = body.querySelector('#ac-n').value.trim();
        if (!name) return;
        await DB.put('accounts', { id: Utils.uid('acc'), name, type: body.querySelector('#ac-t').value, initialBalance: parseFloat(body.querySelector('#ac-b').value) || 0 });
        Nav.closeModal();
        Nav.toast('Conta criada!');
        Nav.renderCurrentView();
      });
    },

    openCardForm() {
      const body = Nav.openModal(
        'Novo Cartão',
        `
        <form id="cd-f" class="form-stack">
          <div class="form-group"><label>Nome do cartão *</label><input type="text" id="cd-n" class="input" required></div>
          <div class="form-group"><label>Limite *</label><input type="number" id="cd-l" class="input" step="0.01" min="1" required></div>
          <div class="form-row">
            <div class="form-group"><label>Fechamento (dia)</label><input type="number" id="cd-c" class="input" min="1" max="31" value="5"></div>
            <div class="form-group"><label>Vencimento (dia)</label><input type="number" id="cd-d" class="input" min="1" max="31" value="12"></div>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Salvar Cartão</button>
        </form>
      `
      );
      body.querySelector('#cd-f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = body.querySelector('#cd-n').value.trim();
        const limit = parseFloat(body.querySelector('#cd-l').value) || 0;
        if (!name || limit <= 0) return;
        await DB.put('cards', { id: Utils.uid('card'), name, limit, closingDay: Number(body.querySelector('#cd-c').value) || 5, dueDay: Number(body.querySelector('#cd-d').value) || 12 });
        Nav.closeModal();
        Nav.toast('Cartão salvo!');
        Nav.renderCurrentView();
      });
    },

    openBudgetForm() {
      const body = Nav.openModal(
        'Novo Limite de Orçamento',
        `
        <form id="bd-f" class="form-stack">
          <div class="form-group"><label>Categoria</label><select id="bd-c" class="input">${EXP_CATS.map((c) => `<option value="${c}">${c}</option>`).join('')}</select></div>
          <div class="form-group"><label>Limite mensal *</label><input type="number" id="bd-l" class="input" step="0.01" min="1" required></div>
          <button type="submit" class="btn btn-primary btn-block">Salvar Limite</button>
        </form>
      `
      );
      body.querySelector('#bd-f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const category = body.querySelector('#bd-c').value;
        const monthlyLimit = parseFloat(body.querySelector('#bd-l').value) || 0;
        if (monthlyLimit <= 0) return;
        await DB.put('budgets', { id: `budget_${category}`, category, monthlyLimit });
        Nav.closeModal();
        Nav.toast('Orçamento salvo!');
        Nav.renderCurrentView();
      });
    }
  };

  window.LifeOS.Finance = Finance;
})();
