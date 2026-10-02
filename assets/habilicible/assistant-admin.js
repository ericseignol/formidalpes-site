(() => {
  const API_URL = 'https://ruvkdzcufgtyorupczzj.supabase.co/functions/v1/habilicible-assistant';
  const storageKey = 'habilicible_assistant_admin_session';
  const loginView = document.getElementById('hc-admin-login');
  const dashboard = document.getElementById('hc-admin-dashboard');
  const codeInput = document.getElementById('hc-admin-code');
  const loginButton = document.getElementById('hc-admin-connect');
  const logoutButton = document.getElementById('hc-admin-logout');
  const status = document.getElementById('hc-admin-status');
  const pending = document.getElementById('hc-admin-pending');
  const published = document.getElementById('hc-admin-published');

  let adminCode = '';

  function setStatus(message, isError = false) {
    status.textContent = message || '';
    status.classList.toggle('error', isError);
    status.hidden = !message;
  }

  async function api(body) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-habili-admin': adminCode
      },
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'request_failed');
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  function renderPending(items) {
    pending.innerHTML = '';

    if (!items.length) {
      pending.innerHTML = '<div class="hc-admin-empty">Aucune question en attente. La base est à jour.</div>';
      return;
    }

    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'hc-admin-card';
      card.innerHTML = `
        <h3></h3>
        <div class="hc-admin-meta">
          <span><strong>${item.occurrences}</strong> occurrence(s)</span>
          <span>Première : ${formatDate(item.first_seen_at)}</span>
          <span>Dernière : ${formatDate(item.last_seen_at)}</span>
        </div>
        <label>Réponse à publier</label>
        <textarea data-answer maxlength="2500" placeholder="Rédigez la réponse qui sera utilisée par l’assistant."></textarea>
        <label>Catégorie</label>
        <input data-category maxlength="80" value="autre" />
        <label>Mots-clés <span style="font-weight:400">(facultatif, séparés par des virgules)</span></label>
        <input data-keywords placeholder="ex. wordpress, iframe, intégration" />
        <div class="hc-admin-toolbar" style="margin-top:.8rem">
          <button type="button" data-publish>Publier dans l’assistant</button>
          <button type="button" class="secondary" data-ignore>Ignorer</button>
        </div>
      `;
      card.querySelector('h3').textContent = item.sample_question;

      const answer = card.querySelector('[data-answer]');
      const category = card.querySelector('[data-category]');
      const keywords = card.querySelector('[data-keywords]');
      const publishButton = card.querySelector('[data-publish]');
      const ignoreButton = card.querySelector('[data-ignore]');

      publishButton.addEventListener('click', async () => {
        const responseText = answer.value.trim();
        if (responseText.length < 8) {
          setStatus('Ajoute une réponse un peu plus complète avant de publier.', true);
          answer.focus();
          return;
        }

        publishButton.disabled = true;
        setStatus('Publication en cours…');
        try {
          await api({
            action: 'publish',
            id: item.id,
            answer: responseText,
            category: category.value.trim() || 'autre',
            keywords: keywords.value.split(',').map(v => v.trim()).filter(Boolean)
          });
          setStatus('Réponse publiée. Elle est maintenant disponible dans la base de connaissances.');
          await loadDashboard();
        } catch (error) {
          setStatus('Impossible de publier la réponse pour le moment.', true);
        } finally {
          publishButton.disabled = false;
        }
      });

      ignoreButton.addEventListener('click', async () => {
        if (!confirm('Ignorer cette question ? Elle pourra réapparaître si elle est reposée.')) return;
        ignoreButton.disabled = true;
        setStatus('Mise à jour…');
        try {
          await api({ action: 'ignore', id: item.id });
          setStatus('Question ignorée.');
          await loadDashboard();
        } catch {
          setStatus('Impossible d’ignorer cette question pour le moment.', true);
        } finally {
          ignoreButton.disabled = false;
        }
      });

      pending.appendChild(card);
    });
  }

  function renderPublished(items) {
    published.innerHTML = '';
    if (!items.length) {
      published.innerHTML = '<div class="hc-admin-empty">Aucune réponse publiée.</div>';
      return;
    }

    items.forEach(item => {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      const answer = document.createElement('p');
      const meta = document.createElement('small');

      summary.textContent = item.question;
      answer.textContent = item.answer;
      meta.textContent = [
        item.category ? 'Catégorie : ' + item.category : '',
        Array.isArray(item.keywords) && item.keywords.length ? 'Mots-clés : ' + item.keywords.join(', ') : ''
      ].filter(Boolean).join(' — ');

      details.append(summary, answer, meta);
      published.appendChild(details);
    });
  }

  async function loadDashboard() {
    const data = await api({ action: 'admin_list' });
    renderPending(Array.isArray(data.pending) ? data.pending : []);
    renderPublished(Array.isArray(data.knowledge) ? data.knowledge : []);
    document.getElementById('hc-admin-pending-count').textContent = String((data.pending || []).length);
    document.getElementById('hc-admin-published-count').textContent = String((data.knowledge || []).length);
  }

  async function connect(code) {
    adminCode = code.trim();
    if (!adminCode) return;

    loginButton.disabled = true;
    setStatus('Connexion…');

    try {
      await loadDashboard();
      sessionStorage.setItem(storageKey, adminCode);
      loginView.hidden = true;
      dashboard.hidden = false;
      setStatus('');
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setStatus('Code administrateur incorrect.', true);
      } else {
        setStatus('Le service d’administration est momentanément indisponible.', true);
      }
      adminCode = '';
    } finally {
      loginButton.disabled = false;
    }
  }

  loginButton.addEventListener('click', () => connect(codeInput.value));
  codeInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') connect(codeInput.value);
  });

  logoutButton.addEventListener('click', () => {
    sessionStorage.removeItem(storageKey);
    adminCode = '';
    dashboard.hidden = true;
    loginView.hidden = false;
    codeInput.value = '';
    setStatus('Session fermée.');
  });

  const saved = sessionStorage.getItem(storageKey);
  if (saved) connect(saved);
})();
