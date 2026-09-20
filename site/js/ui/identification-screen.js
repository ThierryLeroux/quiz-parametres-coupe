// Écran Identification (UI §3.2) : prénom, nom, matricule à 7 chiffres, NIP de 4 à 6 chiffres.
// Un seul formulaire et un seul bouton pour la première visite comme pour la reprise : c'est le
// serveur qui sait si le matricule a déjà une séance (D19).
// Les règles et les messages viennent de studentErrors (identification.js) : l'écran ne fait que les afficher.

import { el, showScreen } from './dom.js';
import { cleanStudent, studentErrors } from '../identification.js';

const FIELDS = [
  { name: 'prenom', label: 'Prénom', note: '' },
  { name: 'nom', label: 'Nom', note: '' },
  { name: 'matricule', label: 'Matricule', note: '7 chiffres', number: true, maxlength: '7' },
  { name: 'nip', label: 'NIP', note: '4 à 6 chiffres', number: true, maxlength: '6', secret: true },
];

//   notice  : message à montrer d'entrée sous le formulaire (ex. séance expirée), ou ''
//   actions : { onSubmit(student) } — async ; reçoit { prenom, nom, matricule, nip } déjà valide et
//             nettoyé ; retourne le message à afficher si le serveur refuse, ou null si un autre
//             écran a pris la place
export function renderIdentification(main, { exercise, notice = '' }, actions) {
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

  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  const submitButton = el('button', { class: 'button', type: 'submit' }, 'Continuer');

  async function submit(event) {
    event.preventDefault();
    if (submitButton.disabled) return; // un envoi est déjà en cours (touche Entrée répétée)
    FIELDS.forEach(({ name }) => touched.add(name));
    const errors = refresh();
    const firstInvalid = FIELDS.find(({ name }) => errors[name] !== null);
    if (firstInvalid) {
      inputs[firstInvalid.name].focus();
      return;
    }
    submitButton.disabled = true;
    status.textContent = '';
    const message = await actions.onSubmit(cleanStudent(readStudent()));
    if (message === null) return;
    status.textContent = message;
    submitButton.disabled = false;
  }

  const fields = FIELDS.map(({ name, label, note, number, maxlength, secret }) => {
    inputs[name] = el('input', {
      id: name,
      name,
      // Le NIP est un champ TEXTE masqué par CSS, jamais type="password" : aucun navigateur ne doit
      // proposer de l'enregistrer sur un poste partagé (D21).
      type: 'text',
      class: secret ? 'input-secret' : null,
      inputmode: number ? 'numeric' : null,
      maxlength,
      autocomplete: 'off', // postes partagés du labo : ne rien proposer de l'étudiant précédent
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
    el('p', { class: 'muted small' }, "Choisis un NIP à ta première visite : il te servira à reprendre l'exercice sur un autre appareil."),
    el('form', { novalidate: true, onsubmit: submit }, [
      el('div', { class: 'form-grid' }, fields),
      el('div', { class: 'form-actions' }, [status, submitButton]),
    ]),
  ]));

  showScreen(main, screen, { title: exercise.titre, aside: `version ${exercise.version}` }, '#prenom');
}
