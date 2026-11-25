window.LifeOS = window.LifeOS || {};

(function () {
  const { DB, Prefs, Utils, Nav } = window.LifeOS;

  const Backup = {
    async exportJSON() {
      const data = {};
      for (const store of DB.STORES) {
        data[store] = await DB.getAll(store);
      }
      const payload = {
        app: 'LifeOS',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        prefs: Prefs.getAll(),
        data
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifeos-backup-${Utils.todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      Nav.toast('Backup exportado!');
    },

    importJSON(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(String(reader.result || '{}'));
          if (!parsed || parsed.app !== 'LifeOS' || !parsed.data) {
            Nav.toast('Arquivo de backup inválido.', 'error');
            return;
          }
          const ok = await Nav.confirm('Restaurar Backup', 'Isso substituirá os dados atuais pelos dados do arquivo. Continuar?');
          if (!ok) return;

          await DB.clearAll();
          for (const store of DB.STORES) {
            const list = Array.isArray(parsed.data[store]) ? parsed.data[store] : [];
            for (const item of list) {
              await DB.put(store, item);
            }
          }
          if (parsed.prefs) {
            Object.entries(parsed.prefs).forEach(([k, v]) => Prefs.set(k, v));
          }
          Nav.toast('Backup restaurado com sucesso!');
          window.LifeOS.App?.refreshShell();
          Nav.renderCurrentView();
        } catch {
          Nav.toast('Erro ao ler o arquivo JSON.', 'error');
        }
      };
      reader.readAsText(file);
    }
  };

  window.LifeOS.Backup = Backup;
})();
