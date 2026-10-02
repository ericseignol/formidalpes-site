/* HabiliCible support assistant V2 — dynamic knowledge base, no generative AI. */
(() => {
  const root = document.getElementById('habilicible-assistant');
  if (!root) return;

  const API_URL = 'https://ruvkdzcufgtyorupczzj.supabase.co/functions/v1/habilicible-assistant';

  const launcher = root.querySelector('.hc-assistant-launcher');
  const panel = root.querySelector('.hc-assistant-panel');
  const closeButton = root.querySelector('.hc-assistant-close');
  const form = root.querySelector('#hc-assistant-form');
  const input = root.querySelector('#hc-assistant-input');
  const messages = root.querySelector('#hc-assistant-messages');
  const humanHelpLink = root.querySelector('[data-human-help]');

  const environment = window.location.pathname.includes('/pr-preview/') ? 'preview' : 'production';
  const unansweredStorageKey = `habilicible_unanswered_questions_${environment}`;
  let lastQuestion = '';
  let dynamicKnowledge = [];

  const answers = {
    trial: "L'essai dure 30 jours, sans carte bancaire et sans engagement. Il sert à configurer votre espace, tester le questionnaire, vérifier la réception d'une demande et valider l'intégration avant utilisation réelle.",
    setup: "Le démarrage consiste à personnaliser le nom, le logo, la couleur et l'adresse de réception de votre organisme, puis à envoyer une demande test pour vérifier le parcours.",
    embed: "Vous pouvez intégrer HabiliCible dans votre site avec une iframe fournie lors du paramétrage. Vous pouvez aussi utiliser un lien public si vous ne souhaitez pas modifier votre site.",
    request: "L'organisme reçoit une demande structurée à partir des opérations, équipements et situations décrits par le prospect, avec les points restant à confirmer. La recommandation finale reste à valider par un professionnel.",
    price: "Après l'essai : 79 € HT par mois ou 690 € HT par an. L'offre fondateur est proposée à 490 € HT pour la première année tant qu'elle est disponible. Le paramétrage accompagné est une option séparée.",
    responsibility: "HabiliCible aide à structurer la demande. Il ne décide pas de l'habilitation, ne remplace pas l'analyse de l'organisme de formation et ne se substitue pas à la décision de l'employeur.",
    privacy: "La démonstration publique utilise des données fictives. Pour un espace organisme réel, chaque organisme accède uniquement à ses propres demandes et l'adresse de réception est vérifiée avant activation."
  };

  function normalize(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function loadDynamicKnowledge() {
    try {
      const response = await fetch(API_URL, { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (!response.ok) return;
      const payload = await response.json();
      dynamicKnowledge = Array.isArray(payload.knowledge) ? payload.knowledge : [];
    } catch {
      // La base locale reste disponible si le service distant est momentanément indisponible.
    }
  }

  function findDynamicAnswer(text) {
    const q = normalize(text);
    if (!q || !dynamicKnowledge.length) return null;

    let best = null;

    dynamicKnowledge.forEach(item => {
      const itemQuestion = normalize(item.normalized_question || item.question);
      const keywords = Array.isArray(item.keywords) ? item.keywords.map(normalize).filter(Boolean) : [];
      let score = 0;

      if (itemQuestion && (q === itemQuestion || q.includes(itemQuestion) || itemQuestion.includes(q))) {
        score += 100;
      }

      keywords.forEach(keyword => {
        if (keyword && q.includes(keyword)) score += keyword.includes(' ') ? 18 : 10;
      });

      const qTokens = new Set(q.split(' ').filter(token => token.length >= 4));
      const itemTokens = itemQuestion.split(' ').filter(token => token.length >= 4);
      const overlap = itemTokens.filter(token => qTokens.has(token)).length;
      score += overlap * 3;

      if (!best || score > best.score) {
        best = { score, answer: item.answer };
      }
    });

    return best && best.score >= 10 ? best.answer : null;
  }

  function addMessage(text, who = 'assistant') {
    const bubble = document.createElement('div');
    bubble.className = 'hc-message hc-message--' + who;
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    root.dataset.state = 'open';
    setTimeout(() => input.focus(), 0);
  }

  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    root.dataset.state = 'closed';
    launcher.focus();
  }

  function loadUnansweredQuestions() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(unansweredStorageKey) || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  async function sendUnansweredToKnowledgeBase(question) {
    if (environment !== 'production') return;

    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ action: 'unanswered', question: question.slice(0, 300) })
      });
    } catch {
      // Ne bloque jamais l'assistant si la remontée de la question échoue.
    }
  }

  function rememberUnanswered(question) {
    const cleanQuestion = question.trim().slice(0, 300);
    if (!cleanQuestion) return;

    const questions = loadUnansweredQuestions();
    if (!questions.some(item => item.question === cleanQuestion)) {
      questions.push({
        question: cleanQuestion,
        at: new Date().toISOString()
      });
    }

    try {
      sessionStorage.setItem(unansweredStorageKey, JSON.stringify(questions.slice(-10)));
    } catch {
      // L'assistant reste fonctionnel si le stockage de session est indisponible.
    }

    sendUnansweredToKnowledgeBase(cleanQuestion);

    // On mesure uniquement le nombre de questions non résolues, jamais leur texte.
    if (environment === 'production' && typeof window.gtag === 'function') {
      window.gtag('event', 'assistant_unanswered_question', {
        event_label: 'HabiliCible assistant'
      });
    }
  }

  function answerFor(text) {
    const dynamicAnswer = findDynamicAnswer(text);
    if (dynamicAnswer) return { text: dynamicAnswer, matched: true };

    const q = text.toLowerCase();
    if (/(prix|tarif|coût|cout|79|690|490|abonnement)/.test(q)) return { text: answers.price, matched: true };
    if (/(essai|30 jour|carte|engagement)/.test(q)) return { text: answers.trial, matched: true };
    if (/(param|logo|couleur|adresse|config)/.test(q)) return { text: answers.setup, matched: true };
    if (/(iframe|intégr|integr|site|lien public)/.test(q)) return { text: answers.embed, matched: true };
    if (/(reçoit|recoit|demande|prospect|résultat|resultat)/.test(q)) return { text: answers.request, matched: true };
    if (/(habilitation|br|bs|b0|bc|b2|indice|recommand)/.test(q)) return { text: answers.responsibility, matched: true };
    if (/(donnée|donnee|rgpd|confidential|supabase)/.test(q)) return { text: answers.privacy, matched: true };

    return {
      text: "Je n'ai pas encore une réponse fiable à cette question dans ma base d'aide. Utilisez « Demander une aide humaine » ci-dessous : votre question sera reprise automatiquement dans le formulaire de contact.",
      matched: false
    };
  }

  function prepareHumanHelpLink() {
    if (!humanHelpLink) return;

    const target = new URL(humanHelpLink.href);
    target.searchParams.set('objet', 'Support HabiliCible');
    target.searchParams.set('origine', 'Assistant HabiliCible');

    if (lastQuestion) {
      target.searchParams.set('question', lastQuestion.slice(0, 300));
    }

    const unanswered = loadUnansweredQuestions()
      .slice(-4)
      .map(item => item.question)
      .filter(Boolean);

    if (unanswered.length) {
      target.searchParams.set('questions_sans_reponse', unanswered.join(' || ').slice(0, 1200));
    }

    humanHelpLink.href = target.toString();

    if (environment === 'production' && typeof window.gtag === 'function') {
      window.gtag('event', 'clic_aide_humaine_habilicible', {
        event_label: 'HabiliCible assistant'
      });
    }
  }

  launcher.addEventListener('click', () => panel.hidden ? openPanel() : closePanel());
  closeButton.addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) closePanel(); });

  root.querySelectorAll('[data-question]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.question;
      const question = button.textContent.trim();
      lastQuestion = question;
      addMessage(question, 'user');
      addMessage(answers[key] || answerFor(question).text);
    });
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    lastQuestion = question;
    addMessage(question, 'user');
    input.value = '';

    const result = answerFor(question);
    addMessage(result.text);

    if (!result.matched) {
      rememberUnanswered(question);
    }
  });

  if (humanHelpLink) {
    humanHelpLink.addEventListener('click', prepareHumanHelpLink);
  }

  loadDynamicKnowledge();
})();
