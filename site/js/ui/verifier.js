// Page de vérification d'une attestation, publique et sans connexion (décision D33 ; UI §3.7).
// Deux entrées : l'adresse du QR (la page s'ouvre avec ses paramètres et vérifie d'elle-même), ou la
// saisie du code court — ou d'une adresse collée entière. Le serveur répond valide, annulée,
// aucune ou invalide (attestation-data.js décide des textes) ; ici, on construit le DOM.

import { verifyAttestation } from '../api.js';
import { claimsFromInput, hasQuestions, verificationOutcome } from './attestation-data.js';
import { factsGrid, operationsTable, questionsTable } from './attestation-screen.js';
import { el, showScreen } from './dom.js';
import { serverErrorMessage } from './text.js';

const main = document.querySelector('#app');

const result = el('div', { class: 'verify-slot', 'aria-live': 'polite' });
const status = el('div', { class: 'server-message', role: 'status' });
const input = el('input', {
  id: 'code',
  name: 'code',
  type: 'text',
  autocomplete: 'off',
  spellcheck: 'false',
  placeholder: 'XXXXX-XXXXX',
  'aria-describedby': 'code-note',
});
const button = el('button', { class: 'button', type: 'submit' }, 'Vérifier');

// Le résultat : titre et explication selon l'issue, puis l'enregistrement complet s'il y en a un.
function showResult(response) {
  const { tone, title, text } = verificationOutcome(response);
  const record = response.attestation;
  result.replaceChildren(el('section', { class: `panel panel--${tone} verify-result` }, [
    el('div', { class: 'eyebrow' }, 'Résultat'),
    el('h2', {}, title),
    el('p', { class: 'small' }, text),
    ...(record ? [factsGrid(record), el('h3', { class: 'attestation-subtitle' }, 'Opérations effectuées'), el('div', { class: 'table-wrap' }, operationsTable(record))] : []),
    // La liste des questions réussies (D41), complète, telle que le serveur la détient ; absente d'une attestation figée avant cette version.
    ...(record && hasQuestions(record) ? [el('h3', { class: 'attestation-subtitle' }, `Questions réussies qui comptent (${record.questions.length})`), el('div', { class: 'table-wrap' }, questionsTable(record))] : []),
  ]));
}

async function verify(claims) {
  button.disabled = true;
  status.textContent = '';
  try {
    showResult(await verifyAttestation(claims));
  } catch (error) {
    result.replaceChildren();
    status.textContent = serverErrorMessage(error);
  } finally {
    button.disabled = false;
  }
}

function submit(event) {
  event.preventDefault();
  const claims = claimsFromInput(input.value);
  if (claims === null) {
    status.textContent = 'Entre le code de 10 caractères inscrit sous le code QR (par exemple ABCDE-FGHJK), ou colle l’adresse du QR.';
    input.focus();
    return;
  }
  verify(claims);
}

const screen = el('div', { class: 'screen' }, [
  el('section', { class: 'panel' }, [
    el('div', { class: 'eyebrow' }, 'Attestation de réussite'),
    el('h1', { tabindex: '-1' }, 'Vérifier une attestation'),
    el('p', { class: 'muted small' }, "Scanne le code QR de l'attestation, ou entre le code inscrit dessous. Le serveur de correction dit si l'attestation est authentique, et montre ce qu'il en détient."),
    el('form', { class: 'verify-form', novalidate: true, onsubmit: submit }, [
      el('div', { class: 'field field--number' }, [
        el('label', { for: 'code' }, 'Code de vérification'),
        input,
        el('div', { class: 'field-note', id: 'code-note' }, '10 caractères, sans O, I, 0 ni 1 — ou l’adresse complète du QR'),
      ]),
      button,
    ]),
    status,
  ]),
  result,
]);

showScreen(main, screen, { title: "Vérification d'une attestation", aside: 'Techniques de génie mécanique' }, '#code');

// Ouverte par le QR : l'adresse porte tout, on vérifie sans rien demander.
const params = new URLSearchParams(location.search);
if (params.has('code')) {
  input.value = params.get('code');
  verify(Object.fromEntries(params));
}
