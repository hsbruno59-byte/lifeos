window.LifeOS = window.LifeOS || {};

(function () {
  const { DB, Prefs, Utils, Nav, Backup } = window.LifeOS;

  const Settings = {
    async render(container) {
      const prefs = Prefs.getAll();

      container.innerHTML = `
        <div class="section-heading">
          <h2>Configurações</h2>
          <span class="badge">v1.0.0 Local</span>
        </div>

        <form id="set-profile-form" class="card form-stack">
          <h3 class="card-title">Perfil &amp; Aparência</h3>
          <div class="form-group">
            <label for="st-name">Seu nome</label>
            <input type="text" id="st-name" class="input" value="${Utils.escapeHTML(prefs.userName)}" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="st-cur">Moeda</label>
              <select id="st-cur" class="input">
                <option value="BRL" ${prefs.currency === 'BRL' ? 'selected' : ''}>Real (R$)</option>
                <option value="USD" ${prefs.currency === 'USD' ? 'selected' : ''}>Dólar (US$)</option>
                <option value="EUR" ${prefs.currency === 'EUR' ? 'selected' : ''}>Euro (€)</option>
                <option value="GBP" ${prefs.currency === 'GBP' ? 'selected' : ''}>Libra (£)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="st-theme">Tema</label>
              <select id="st-theme" class="input">
                <option value="dark" ${prefs.theme === 'dark' ? 'selected' : ''}>Dark Premium</option>
                <option value="oled" ${prefs.theme === 'oled' ? 'selected' : ''}>OLED Puro</option>
                <option value="light" ${prefs.theme === 'light' ? 'selected' : ''}>Claro</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="st-week">Início da semana no calendário</label>
            <select id="st-week" class="input">
              <option value="0" ${Number(prefs.weekStart) === 0 ? 'selected' : ''}>Domingo</option>
              <option value="1" ${Number(prefs.weekStart) === 1 ? 'selected' : ''}>Segunda-feira</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Salvar Preferências</button>
        </form>

        <section class="card form-stack">
          <h3 class="card-title">Backup &amp; Dados Locais</h3>
          <p class="text-secondary" style="font-size:13px;">Seus dados ficam armazenados localmente neste dispositivo. Exporte regularmente uma cópia de segurança.</p>
          <div class="form-row">
            <button type="button" id="st-export" class="btn btn-secondary">Exportar JSON</button>
            <label class="btn btn-secondary" style="cursor:pointer;">
              Importar JSON
              <input type="file" id="st-import" accept=".json,application/json" class="hidden">
            </label>
          </div>
          <button type="button" id="st-demo" class="btn btn-secondary btn-block">Adicionar Exemplos Demonstrativos</button>
          <button type="button" id="st-reset" class="btn btn-danger-soft btn-block">Apagar Todos os Dados</button>
        </section>
      `;

      document.getElementById('set-profile-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        Prefs.set('userName', document.getElementById('st-name').value.trim() || 'Usuário');
        Prefs.set('currency', document.getElementById('st-cur').value);
        Prefs.set('theme', document.getElementById('st-theme').value);
        Prefs.set('weekStart', Number(document.getElementById('st-week').value));
        window.LifeOS.App?.refreshShell();
        Nav.toast('Preferências salvas!');
      });

      document.getElementById('st-export')?.addEventListener('click', () => Backup.exportJSON());
      document.getElementById('st-import')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) Backup.importJSON(file);
      });

      document.getElementById('st-demo')?.addEventListener('click', async () => {
        await DB.seedDemo();
        Nav.toast('Exemplos adicionados!');
      });

      document.getElementById('st-reset')?.addEventListener('click', async () => {
        const ok = await Nav.confirm('Apagar tudo', 'Todos os registros locais serão excluídos permanentemente. Continuar?');
        if (!ok) return;
        await DB.clearAll();
        Prefs.reset();
        location.reload();
      });
    }
  };

  window.LifeOS.Settings = Settings;
})();
