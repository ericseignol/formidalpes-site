(() => {
  const root = document.getElementById('habilicible-assistant');
  if (!root) return;

  const launcher = root.querySelector('.hc-assistant-launcher');
  const panel = root.querySelector('.hc-assistant-panel');
  const closeButton = root.querySelector('.hc-assistant-close');
  const form = root.querySelector('#hc-assistant-form');
  const input = root.querySelector('#hc-assistant-input');
  const messages = root.querySelector('#hc-assistant-messages');

  const answers = {
    trial: "L'essai dure 30 jours, sans carte bancaire et sans engagement. Il sert à configurer votre espace, tester le questionnaire, vérifier la réception d'une demande et valider l'intégration avant utilisation réelle.",
    setup: "Le démarrage consiste à personnaliser le nom, le logo, la couleur et l'adresse de réception de votre organisme, puis à envoyer une demande test pour vérifier le parcours.",
    embed: "Vous pouvez intégrer HabiliCible dans votre site avec une iframe fournie lors du paramétrage. Vous pouvez aussi utiliser un lien public si vous ne souhaitez pas modifier votre site.",
    request: "L'organisme reçoit une demande structurée à partir des opérations, équipements et situations décrits par le prospect, avec les points restant à confirmer. La recommandation finale reste à valider par un professionnel.",
    price: "Après l'essai : 79 € HT par mois ou 690 € HT par an. L'offre fondateur est proposée à 490 € HT pour la première année tant qu'elle est disponible. Le paramétrage accompagné est une option séparée.",
    responsibility: "HabiliCible aide à structurer la demande. Il ne décide pas de l'habilitation, ne remplace pas l'analyse de l'organisme de formation et ne se substitue pas à la décision de l'employeur.",
    privacy: "La démonstration publique utilise des données fictives. Pour un espace organisme réel, chaque organisme accède uniquement à ses propres demandes et l'adresse de réception est vérifiée avant activation."
  };

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

  function answerFor(text) {
    const q = text.toLowerCase();
    if (/(prix|tarif|coût|cout|79|690|490|abonnement)/.test(q)) return answers.price;
    if (/(essai|30 jour|carte|engagement)/.test(q)) return answers.trial;
    if (/(param|logo|couleur|adresse|config)/.test(q)) return answers.setup;
    if (/(iframe|intégr|integr|site|lien public)/.test(q)) return answers.embed;
    if (/(reçoit|recoit|demande|prospect|résultat|resultat)/.test(q)) return answers.request;
    if (/(habilitation|br|bs|b0|bc|b2|indice|recommand)/.test(q)) return answers.responsibility;
    if (/(donnée|donnee|rgpd|confidential|supabase)/.test(q)) return answers.privacy;
    return "Je n'ai pas encore une réponse fiable à cette question dans ma base d'aide. Utilisez « Demander une aide humaine » ci-dessous : votre question nous aidera aussi à enrichir l'assistant.";
  }

  launcher.addEventListener('click', () => panel.hidden ? openPanel() : closePanel());
  closeButton.addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) closePanel(); });

  root.querySelectorAll('[data-question]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.question;
      addMessage(button.textContent.trim(), 'user');
      addMessage(answers[key] || answerFor(button.textContent));
    });
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    addMessage(question, 'user');
    input.value = '';
    addMessage(answerFor(question));
  });
})();
