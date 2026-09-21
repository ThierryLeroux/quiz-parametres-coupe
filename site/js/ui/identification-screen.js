// Écrans d'identification (UI §3.2, décision D23) — en deux temps, pour que rien ne se décide en silence :
//   1/2  le matricule seul ; le serveur dit s'il a une séance pour cet exercice
//   2/2  séance trouvée → le NIP, « Reprendre » ; aucune séance → prénom, nom, NIP choisi, « Commencer »
// et « Corriger mon identité », ouvert depuis la séance : prénom, nom, matricule, NIP exigé.
// Les règles et les messages viennent d'identification.js : les écrans ne font que les afficher.

import { el, showScreen } from './dom.js';
import { matriculeError, nipError, studentErrors } from '../identification.js';
import { newSessionNotice, sessionFoundNotice } from './text.js';

const FIELDS = {
  prenom: { label: 'Prénom', note: '' },
  nom: { label: 'Nom', note: '' },
  matricule: { label: 'Matricule', note: '7 chiffres', number: true, maxlength: '7' },
  nip: { label: 'NIP', note: '4 à 6 chiffres', number: true, maxlength: '6', secret: true },
};

// Un écran-formulaire. Tous les écrans de ce fichier sont faits ainsi.
//   fields   : noms des champs, dans l'ordre — clés de FIELDS ; labels : libellés à remplacer
//   values   : valeurs de départ, { nom: 'Tremblay' }
//   validate : (values) → { [champ]: message ou null }
//   onSubmit : async (values sans espaces autour) → message à afficher si le serveur refuse, ou
//              null si un autre écran a pris la place
//   links    : [{ label, onclick }] — liens sous le formulaire (« Ce n'est pas moi », « Annuler »)
function formScreen(main, exercise, { eyebrow, title, intro, fields, labels = {}, values = {}, notice = '', submitLabel, validate, onSubmit, links = [] }) {
  const inputs = {};
  const notes = {};
  // Un message d'erreur n'apparaît sous une case qu'une fois la case quittée (ou le formulaire
  // envoyé) : pas de rouge dès la première lettre. Ensuite il se met à jour à chaque frappe.
  const touched = new Set();

  const read = () => Object.fromEntries(fields.map((name) => [name, inputs[name].value.trim()]));

  function refresh() {
    const errors = validate(read());
    for (const name of fields) {
      const message = touched.has(name) ? errors[name] : null;
      inputs[name].setAttribute('aria-invalid', message === null ? 'false' : 'true');
      notes[name].textContent = message ?? FIELDS[name].note;
    }
    return errors;
  }

  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  const submitButton = el('button', { class: 'button', type: 'submit' }, submitLabel);

  async function submit(event) {
    event.preventDefault();
    if (submitButton.disabled) return; // un envoi est déjà en cours (touche Entrée répétée)
    fields.forEach((name) => touched.add(name));
    const errors = refresh();
    const firstInvalid = fields.find((name) => errors[name] !== null);
    if (firstInvalid) {
      inputs[firstInvalid].focus();
      return;
    }
    submitButton.disabled = true;
    status.textContent = '';
    const message = await onSubmit(read());
    if (message === null) return;
    status.textContent = message;
    submitButton.disabled = false;
  }

  const boxes = fields.map((name) => {
    const { label, note, number, maxlength, secret } = FIELDS[name];
    inputs[name] = el('input', {
      id: name,
      name,
      // Le NIP est un champ TEXTE masqué par CSS, jamais type="password" : aucun navigateur ne doit
      // proposer de l'enregistrer sur un poste partagé (D21).
      type: 'text',
      class: secret ? 'input-secret' : null,
      inputmode: number ? 'numeric' : null,
      maxlength,
      value: values[name] ?? '',
      autocomplete: 'off', // postes partagés du labo : ne rien proposer de l'étudiant précédent
      autocapitalize: number ? null : 'words',
      spellcheck: 'false',
      'aria-describedby': `${name}-note`,
      oninput: refresh,
      onblur: () => { touched.add(name); refresh(); },
    });
    notes[name] = el('div', { class: 'field-note', id: `${name}-note`, 'aria-live': 'polite' }, note);
    return el('div', { class: number ? 'field field--number' : 'field' }, [el('label', { for: name }, labels[name] ?? label), inputs[name], notes[name]]);
  });

  const screen = el('div', { class: 'screen screen--narrow' }, el('section', { class: 'panel' }, [
    el('div', { class: 'eyebrow' }, eyebrow),
    el('h1', { tabindex: '-1' }, title),
    ...intro,
    el('form', { novalidate: true, onsubmit: submit }, [
      el('div', { class: fields.length > 1 ? 'form-grid' : 'form-grid form-grid--single' }, boxes),
      el('div', { class: 'form-actions' }, [status, submitButton]),
    ]),
    el('div', { class: 'form-links' }, links.map(({ label, onclick }) => el('button', { class: 'button-link', type: 'button', onclick }, label))),
  ]));

  // Le titre de l'exercice reste visible dans la barre du haut : il n'y a pas d'autre moyen de le vérifier ici.
  const firstEmpty = fields.find((name) => (values[name] ?? '') === '') ?? fields[0];
  showScreen(main, screen, { title: exercise.titre, aside: `version ${exercise.version}` }, `#${firstEmpty}`);
}

// 1/2 — le matricule seul.   actions : { onSubmit(matricule) }
export function renderMatricule(main, { exercise, notice = '', matricule = '' }, actions) {
  formScreen(main, exercise, {
    eyebrow: 'Identification · 1 / 2',
    title: 'Quel est ton matricule ?',
    intro: [el('p', { class: 'muted small' }, "C'est lui qui retrouve ta séance, sur cet appareil comme sur un autre.")],
    fields: ['matricule'],
    values: { matricule },
    notice,
    submitLabel: 'Continuer',
    validate: (values) => ({ matricule: matriculeError(values.matricule) }),
    onSubmit: (values) => actions.onSubmit(values.matricule),
  });
}

// 2/2, séance trouvée — le NIP, rien d'autre.   actions : { onSubmit(nip), onBack }
export function renderResume(main, { exercise, prenom, initiale }, actions) {
  formScreen(main, exercise, {
    eyebrow: 'Identification · 2 / 2',
    title: 'Reprendre ta séance',
    intro: [el('p', { class: 'small' }, sessionFoundNotice(prenom, initiale))],
    fields: ['nip'],
    submitLabel: 'Reprendre',
    validate: (values) => ({ nip: nipError(values.nip) }),
    onSubmit: (values) => actions.onSubmit(values.nip),
    links: [{ label: "Ce n'est pas moi", onclick: actions.onBack }],
  });
}

// 2/2, aucune séance — le matricule en gros, à vérifier, puis prénom, nom et NIP choisi.
//   actions : { onSubmit({ prenom, nom, matricule, nip }), onBack }
export function renderCreate(main, { exercise, matricule }, actions) {
  formScreen(main, exercise, {
    eyebrow: 'Identification · 2 / 2',
    title: 'Nouvelle séance',
    intro: [
      el('p', { class: 'matricule-display', 'aria-hidden': 'true' }, matricule),
      el('p', { class: 'small' }, newSessionNotice(matricule)),
    ],
    fields: ['prenom', 'nom', 'nip'],
    labels: { nip: 'Choisis un NIP (4 à 6 chiffres)' },
    submitLabel: 'Commencer',
    validate: (values) => studentErrors({ ...values, matricule }),
    onSubmit: (values) => actions.onSubmit({ ...values, matricule }),
    links: [{ label: 'Mauvais matricule', onclick: actions.onBack }],
  });
}

// « Corriger mon identité », depuis la séance : prénom, nom, matricule modifiables, NIP exigé.
//   actions : { onSubmit({ prenom, nom, matricule, nip }), onBack }
export function renderIdentity(main, { exercise, seance }, actions) {
  formScreen(main, exercise, {
    eyebrow: 'Ta séance',
    title: 'Corriger mon identité',
    intro: [el('p', { class: 'muted small' }, 'Ton prénom, ton nom et ton matricule figureront sur ton rapport. Ta progression ne change pas. Entre ton NIP pour confirmer.')],
    fields: ['prenom', 'nom', 'matricule', 'nip'],
    values: seance.etudiant,
    submitLabel: 'Enregistrer',
    validate: studentErrors,
    onSubmit: actions.onSubmit,
    links: [{ label: 'Annuler', onclick: actions.onBack }],
  });
}
