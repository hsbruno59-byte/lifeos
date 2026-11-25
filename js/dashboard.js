window.LifeOS = window.LifeOS || {};

(function () {
  const { DB, Utils, Nav } = window.LifeOS;

  const Dashboard = {
    async render(container) {
      const today = Utils.todayISO();
      const month = today.slice(0, 7);
      const [tasks, events, habits, habitLogs, accounts, transactions, goals] = await Promise.all([
        DB.getAll('tasks'), DB.getAll('events'), DB.getAll('habits'),
        DB.getAll('habitLogs'), DB.getAll('accounts'), DB.getAll('transactions'), DB.getAll('goals')
      ]);

      const todayTasks = tasks.filter((t) => t.dueDate === today);
      const pendingTasks = tasks.filter((t) => !t.completed);
      const doneToday = tasks.filter((t) => t.completed && (t.dueDate === today || (t.completedAt || '').startsWith(today)));

      const wd = new Date().getDay();
      const activeHabits = habits.filter((h) => h.frequency === 'daily' || (h.daysOfWeek || []).includes(wd));
      const doneHabits = activeHabits.filter((h) => {
        const l = habitLogs.find((x) => x.habitId === h.id && x.date === today);
        return l && (l.completed || (Number(l.count) || 0) >= (Number(h.dailyTarget) || 1));
      });

      const upcoming = events.filter((e) => e.startDate >= today).sort((a, b) => `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`));
      const totalDaily = todayTasks.length + activeHabits.length;
      const doneDaily = todayTasks.filter((t) => t.completed).length + doneHabits.length;
      const dailyPct = totalDaily > 0 ? Math.round((doneDaily / totalDaily) * 100) : 0;

      const initAcc = accounts.reduce((s, a) => s + Number(a.initialBalance || 0), 0);
      const allInc = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
      const allExp = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
      const balance = initAcc + allInc - allExp;

      const mInc = transactions.filter((t) => t.type === 'income' && (t.date || '').startsWith(month)).reduce((s, t) => s + Number(t.amount || 0), 0);
      const mExpList = transactions.filter((t) => t.type === 'expense' && (t.date || '').startsWith(month));
      const mExp = mExpList.reduce((s, t) => s + Number(t.amount || 0), 0);
      const mSave = mInc - mExp;

      const catMap = {};
      mExpList.forEach((t) => { catMap[t.category || 'Outros'] = (catMap[t.category || 'Outros'] || 0) + Number(t.amount || 0); });
      const chartData = Object.entries(catMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

      const gList = goals.map((g) => ({ ...g, pct: Math.min(100, Math.round((Math.max(0, Number(g.currentValue) || 0) / Math.max(1, Number(g.targetValue) || 1)) * 100)) }));
      const activeGoals = gList.filter((g) => g.pct < 100);
      const avgGoal = gList.length > 0 ? Math.round(gList.reduce((s, g) => s + g.pct, 0) / gList.length) : 0;

      container.innerHTML = `
        <section class="card">
          <div class="card-header"><h2 class="card-title">Resumo do Dia</h2><span class="badge badge-accent mono">${dailyPct}% concluído</span></div>
          <div class="progress-track" style="margin-bottom:12px;"><div class="progress-fill" style="width:${dailyPct}%;"></div></div>
          <div class="kpi-grid-4">
            <div class="kpi-box" data-go="planning:tasks" style="cursor:pointer;"><span class="kpi-label">Pendentes</span><span class="kpi-value">${pendingTasks.length}</span><span class="kpi-sub">${todayTasks.filter((t) => !t.completed).length} hoje</span></div>
            <div class="kpi-box" data-go="planning:tasks" style="cursor:pointer;"><span class="kpi-label">Concluídas</span><span class="kpi-value text-accent">${doneToday.length}</span><span class="kpi-sub">${tasks.filter((t) => t.completed).length} total</span></div>
            <div class="kpi-box" data-go="planning:habits" style="cursor:pointer;"><span class="kpi-label">Hábitos</span><span class="kpi-value">${doneHabits.length}/${activeHabits.length}</span><span class="kpi-sub">Hoje</span></div>
            <div class="kpi-box" data-go="planning:calendar" style="cursor:pointer;"><span class="kpi-label">Agenda</span><span class="kpi-value">${events.filter((e) => e.startDate === today).length}</span><span class="kpi-sub">${upcoming.length} próximos</span></div>
          </div>
        </section>

        <section class="card">
          <div class="card-header"><h2 class="card-title">Visão Financeira</h2><button type="button" class="btn btn-secondary btn-sm" data-go="finance:overview">Detalhes</button></div>
          <div class="kpi-grid" style="margin-bottom:12px;">
            <div class="kpi-box"><span class="kpi-label">Saldo Atual</span><span class="kpi-value ${balance < 0 ? 'text-danger' : 'text-accent'}">${Utils.formatCurrency(balance)}</span></div>
            <div class="kpi-box"><span class="kpi-label">Economia Mensal</span><span class="kpi-value ${mSave < 0 ? 'text-danger' : ''}">${Utils.formatCurrency(mSave)}</span></div>
            <div class="kpi-box"><span class="kpi-label">Receitas do Mês</span><span class="kpi-value text-accent">${Utils.formatCurrency(mInc)}</span></div>
            <div class="kpi-box"><span class="kpi-label">Despesas do Mês</span><span class="kpi-value text-danger">${Utils.formatCurrency(mExp)}</span></div>
          </div>
          <div class="card-subtle"><canvas id="dash-fin-canvas" class="chart-canvas" style="height:150px;"></canvas></div>
        </section>

        <section class="card">
          <div class="card-header"><h2 class="card-title">Objetivos</h2><span class="badge mono">Geral: ${avgGoal}%</span></div>
          ${activeGoals.length === 0 ? `<div class="empty-state"><p class="text-secondary">Nenhuma meta em andamento.</p></div>` : `<div class="item-list">${activeGoals.slice(0, 3).map((g) => `<div class="card-subtle" data-go="goals" style="cursor:pointer;"><div class="row-between" style="margin-bottom:5px;"><strong>${Utils.escapeHTML(g.name)}</strong><span class="badge badge-accent mono">${g.pct}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${g.pct}%;"></div></div></div>`).join('')}</div>`}
        </section>

        <section class="card">
          <div class="card-header"><h2 class="card-title">Próximos Compromissos</h2><button type="button" class="btn btn-secondary btn-sm" data-go="planning:calendar">Calendário</button></div>
          ${upcoming.length === 0 ? `<div class="empty-state"><p class="text-secondary">Nenhum compromisso agendado.</p></div>` : `<div class="timeline">${upcoming.slice(0, 4).map((e) => `<div class="timeline-item"><div class="timeline-time">${Utils.escapeHTML(e.startTime || '00:00')}<br><span class="text-muted" style="font-size:10px;">${Utils.formatDate(e.startDate).slice(0, 5)}</span></div><div class="timeline-card"><div class="row-between"><strong>${Utils.escapeHTML(e.title)}</strong><span class="badge">${Utils.escapeHTML(e.category || 'Evento')}</span></div>${e.location ? `<div class="kpi-sub">📍 ${Utils.escapeHTML(e.location)}</div>` : ''}</div></div>`).join('')}</div>`}
        </section>
      `;

      container.querySelectorAll('[data-go]').forEach((el) => el.addEventListener('click', () => {
        const [s, sub] = el.dataset.go.split(':');
        Nav.go(s, sub || null);
      }));
      Utils.drawDonutChart(document.getElementById('dash-fin-canvas'), chartData);
    }
  };

  window.LifeOS.Dashboard = Dashboard;
})();
