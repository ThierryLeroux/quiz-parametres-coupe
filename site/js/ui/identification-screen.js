// Écran Identification (UI §3.2) : prénom, nom, matricule à 7 chiffres. Rien d'autre (D16).
// Les règles et les messages viennent de studentErrors (session.js) : l'écran ne fait que les afficher.

import { el, showScreen } from './dom.js';
import { studentErrors } from '../session.js';

const FIELDS = [
  { name: 'prenom', label: 'Prénom', note: '' },
  { name: 'nom', label: 'Nom', note: '' },
  { name: 'matricule', label: 'Matricule', note: '7 chiffres', number: true },
];

//   actions : { onBack, onStart(student) } — onStart reçoit { prenom, nom, matricule } déjà valide
export function renderIdentification(main, { exercise }, actions) {
  const inputs = {};
  const notes = {};
  // Un message d'erreur n'apparaît sous une case qu'une fois la case quittée (ou le formulaire
  // envoyé) : pas de rouge dès la première lettre. Ensuite il se met à jour à chaque frappe.
  const touched = new Set();

  const readStudent = () => Object.fromEntries(FIELDS.map(({ name }) => [name, inputs[name].value]));

  function refresh() {
    const errors = studentErrors(readStudent());
    for (const { name, note } of FIELDS) {
      const message = touched.has(name) ? errors[name] : null;
      inputs[name].setAttribute('aria-invalid', message === null ? 'false' : 'true');
      notes[name].textContent = message ?? note;
    }
    return errors;
  }

  function submit(event) {
    event.preventDefault();
    FIELDS.forEach(({ name }) => touched.add(name));
    const errors = refresh();
    const firstInvalid = FIELDS.find(({ name }) => errors[name] !== null);
    if (firstInvalid) inputs[firstInvalid.name].focus();
    else actions.onStart(readStudent());
  }

  const fields = FIELDS.map(({ name, label, note, number }) => {
    inputs[name] = el('input', {
      id: name,
      name,
      type: 'text',
      inputmode: number ? 'numeric' : null,
      autocomplete: 'off', // postes partagés du labo : ne pas proposer le nom de l'étudiant précédent
      autocapitalize: number ? null : 'words',
      spellcheck: 'false',
      'aria-describedby': `${name}-note`,
      oninput: refresh,
      onblur: () => { touched.add(name); refresh(); },
    });
    notes[name] = el('div', { class: 'field-note', id: `${name}-note`, 'aria-live': 'polite' }, note);
    return el('div', { class: number ? 'field field--number' : 'field' }, [el('label', { for: name }, label), inputs[name], notes[name]]);
  });

  const screen = el('div', { class: 'screen screen--narrow' }, el('section', { class: 'panel' }, [
    el('div', { class: 'eyebrow' }, 'Identification'),
    el('h1', { tabindex: '-1' }, "Qui fait l'exercice ?"),
    el('p', { class: 'muted small' }, 'Ces informations apparaîtront sur ton rapport de réussite, que tu remettras sur Léa.'),
    el('form', { novalidate: true, onsubmit: submit }, [
      el('div', { class: 'form-grid' }, fields),
      el('div', { class: 'form-actions' }, [
        el('button', { class: 'button-link', type: 'button', onclick: actions.onBack }, '← Retour'),
        el('button', { class: 'button', type: 'submit' }, "Commencer l'exercice"),
      ]),
    ]),
  ]));

  showScreen(main, screen, { title: exercise.titre, aside: `version ${exercise.version}` }, '#prenom');
}
