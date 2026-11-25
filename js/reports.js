window.LifeOS = window.LifeOS || {};

(function () {
  const { DB, Utils } = window.LifeOS;

  const Reports = {
    async render(container) {
      const [tasks, habits, habitLogs, txs, goals, projects] = await Promise.all([
        DB.getAll('tasks'),
        DB.getAll('habits'),
        DB.getAll('habitLogs'),
        DB.getAll('transactions'),
        DB.getAll('goals'),
        DB.getAll('projects')
      ]);

      const today = Utils.todayISO();
      const month = today.slice(0, 7);

      const doneTasks = tasks.filter((t) => t.completed).length;
      const taskRate = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0;

      const incMonth = txs.filter((t) => t.type === 'income' && (t.date || '').startsWith(month)).reduce((s, t) => s + Number(t.amount || 0), 0);
      const expMonth = txs.filter((t) => t.type === 'expense' && (t.date || '').startsWith(month)).reduce((s, t) => s + Number(t.amount || 0), 0);
      const saveRate = incMonth > 0 ? Math.round(((incMonth - expMonth) / incMonth) * 100) : 0;

      const labels = [];
      const doneSeries = [];
      for (let i = 6; i >= 0; i--) {
        const d = Utils.addDays(today, -i);
        labels.push(`${d.slice(8, 10)}/${d.slice(5, 7)}`);
        const tCount = tasks.filter((t) => t.completed && (t.completedAt || '').startsWith(d)).length;
        const hCount = habitLogs.filter((l) => l.date === d && l.completed).length;
        doneSeries.push(tCount + hCount);
      }

      const goalAvg = goals.length
        ? Math.round(goals.reduce((s, g) => s + Math.min(100, (Number(g.currentValue || 0) / Math.max(1, Number(g.targetValue || 1))) * 100), 0) / goals.length)
        : 0;

      container.innerHTML = `
        <div class="section-heading">
          <h2>Relatórios &amp; Insights</h2>
          <span class="badge badge-accent">Consolidado</span>
        </div>

        <div class="kpi-grid">
          <div class="kpi-box">
            <span class="kpi-label">Taxa de Tarefas</span>
            <span class="kpi-value text-accent">${taskRate}%</span>
            <span class="kpi-sub">${doneTasks} de ${tasks.length} concluídas</span>
          </div>
          <div class="kpi-box">
            <span class="kpi-label">Taxa de Poupança</span>
            <span class="kpi-value ${saveRate < 0 ? 'text-danger' : ''}">${saveRate}%</span>
            <span class="kpi-sub">Mês atual</span>
          </div>
          <div class="kpi-box">
            <span class="kpi-label">Média de Objetivos</span>
            <span class="kpi-value">${goalAvg}%</span>
            <span class="kpi-sub">${goals.length} metas ativas</span>
          </div>
          <div class="kpi-box">
            <span class="kpi-label">Projetos Concluídos</span>
            <span class="kpi-value">${projects.filter((p) => p.status === 'Concluído').length}/${projects.length}</span>
            <span class="kpi-sub">${habits.length} hábitos monitorados</span>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Execução Diária (Tarefas + Hábitos)</h3></div>
          <canvas id="rep-chart" class="chart-canvas"></canvas>
        </div>
      `;

      Utils.drawBarChart(document.getElementById('rep-chart'), labels, doneSeries);
    }
  };

  window.LifeOS.Reports = Reports;
})();
