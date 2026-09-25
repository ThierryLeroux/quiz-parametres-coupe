// La galerie d'images de l'éditeur (jalon 7b, décision D56 ; UI §3.9) et la préparation d'un
// téléversement : ce module touche au DOM (canvas, FileReader) ; les règles — plan de réduction,
// taille cible, filtre de la galerie — sont dans editeur-data.js (pur, testé).

import { el } from './dom.js';
import { USAGE_LABELS, filterImages, fittedSize, hasTransparency, uploadPlan } from './editeur-data.js';
import { imageUrl } from './sheets-data.js';

// Le contenu d'un fichier ou d'un blob en base64 (sans le préfixe « data:… »).
const toBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

// Prépare un fichier choisi par l'enseignant pour le téléversement : { nom, usage, type, contenu (base64) }.
// Un SVG part tel quel (le serveur l'assainit) ; une image matricielle est redessinée à la taille du
// plan (uploadPlan : 800 px en JPEG sur fond blanc pour une photo, 256 px en PNG pour un pictogramme),
// jamais agrandie. Un fichier que le navigateur ne sait pas décoder est refusé ici, avant l'envoi.
export async function prepareUpload(file, usage) {
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  if (isSvg) return { nom: file.name, usage, type: uploadPlan(usage, true).type, contenu: await toBase64(file) };
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Ce fichier n'est pas une image que le navigateur sait lire (PNG, JPEG, WebP, GIF, BMP ou SVG).");
  }
  // L'image est d'abord redessinée sans fond, à la taille d'une photo : c'est là qu'on lit si elle a de la
  // transparence (D60), ce qui décide du plan (PNG sans fond, ou JPEG sur blanc).
  const { width, height } = fittedSize(bitmap.width, bitmap.height, uploadPlan(usage, false).maxSide);
  const drawn = document.createElement('canvas');
  drawn.width = width;
  drawn.height = height;
  drawn.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const transparent = hasTransparency(drawn.getContext('2d').getImageData(0, 0, width, height).data);
  const plan = uploadPlan(usage, false, transparent);
  let canvas = drawn;
  if (plan.background !== null) {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = plan.background;
    context.fillRect(0, 0, width, height);
    context.drawImage(drawn, 0, 0);
  }
  const blob = await new Promise((resolve) => { canvas.toBlob(resolve, plan.type, plan.quality); });
  if (blob === null) throw new Error("Le navigateur n'a pas pu redessiner l'image.");
  return { nom: file.name, usage, type: blob.type || plan.type, contenu: await toBase64(blob), largeur: width, hauteur: height };
}

// La galerie : l'image en cours (vignette, nom), « Choisir… » qui déplie la galerie avec sa recherche
// par nom, « Aucune », et « Téléverser » sur place. Retourne { element, read(), setImages(list) }.
//   usage    : 'outil' ou 'operation' ; images : les fiches (id, nom, usage, archivee_le) ; value : l'identifiant choisi, ou null
//   upload   : async (file) → la fiche de l'image téléversée (l'appelant fait l'appel au serveur et tient la liste)
//   onChange : () → appelée après chaque changement (l'appelant relit read())
//   idPrefix : pour les identifiants des contrôles
export function imagePicker({ usage, images, value, upload, onChange, idPrefix, compact = false }) {
  let list = images;
  let current = value ?? null;
  const nameOf = (id) => list.find((image) => image.id === id)?.nom ?? id;

  const preview = el('img', { class: 'image-picker-preview', alt: '', onerror: () => { preview.style.visibility = 'hidden'; } });
  const caption = el('span', { class: 'muted smaller' });
  const search = el('input', { id: `${idPrefix}-recherche`, type: 'search', autocomplete: 'off', placeholder: 'Chercher par nom…' });
  const gallery = el('ul', { class: 'image-gallery' });
  const panel = el('div', { class: 'image-picker-panel', hidden: true });
  const status = el('div', { class: 'field-note field-note--multi', role: 'status' });
  const fileInput = el('input', { id: `${idPrefix}-fichier`, type: 'file', accept: 'image/*,.svg' });
  const toggle = el('button', { class: 'button-small button-small--neutral', type: 'button', 'aria-expanded': 'false' }, 'Choisir une image…');

  function refresh() {
    if (current === null) {
      preview.style.visibility = 'hidden';
      preview.removeAttribute('src');
      caption.textContent = `Aucune ${USAGE_LABELS[usage]}.`;
    } else {
      preview.style.visibility = 'visible';
      preview.src = imageUrl(current);
      caption.textContent = `${nameOf(current)} (${current})`;
    }
    if (panel.hidden) return; // la galerie n'est dessinée qu'une fois dépliée
    const shown = filterImages(list, { usage, query: search.value, current });
    gallery.replaceChildren(...shown.map((image) => el('li', {}, el('button', {
      class: 'image-choice',
      type: 'button',
      'aria-pressed': String(image.id === current),
      title: `${image.nom} (${image.id})${image.archivee_le === null ? '' : ' — archivée'}`,
      onclick: () => { current = image.id; refresh(); onChange(); },
    }, [el('img', { src: imageUrl(image.id), alt: '', loading: 'lazy' }), el('span', {}, image.nom)]))));
    if (shown.length === 0) gallery.replaceChildren(el('li', { class: 'muted small' }, 'Aucune image ne correspond.'));
  }

  search.addEventListener('input', (event) => { event.stopPropagation(); refresh(); });
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) { refresh(); search.focus(); }
  });
  fileInput.addEventListener('change', async (event) => {
    event.stopPropagation();
    const [file] = fileInput.files;
    if (!file) return;
    status.textContent = 'Réduction et envoi…';
    try {
      const image = await upload(file);
      if (!list.some((known) => known.id === image.id)) list = [...list, image];
      current = image.id;
      status.textContent = image.existante ? `Cette image était déjà dans la base : « ${image.nom} » est choisie.` : `« ${image.nom} » téléversée et choisie.`;
      refresh();
      onChange();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      fileInput.value = '';
    }
  });

  panel.append(
    el('div', { class: 'image-picker-tools' }, [
      el('label', { for: search.id, class: 'field-label-text' }, 'Galerie'), search,
      el('label', { for: fileInput.id, class: 'field-label-text' }, 'Téléverser une image'), fileInput,
    ]),
    status,
    gallery,
  );
  const element = el('div', { class: `image-picker${compact ? ' image-picker--compact' : ''}` }, [
    el('div', { class: 'image-picker-current' }, [preview, el('div', {}, [caption, el('div', { class: 'outil-actions' }, [
      toggle,
      el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => { current = null; refresh(); onChange(); } }, 'Aucune'),
    ])])]),
    panel,
  ]);
  refresh();
  return {
    element,
    read: () => current,
    setImages: (next) => { list = next; refresh(); },
  };
}
