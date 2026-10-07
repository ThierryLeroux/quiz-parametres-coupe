// Un DOM minuscule pour tester les écrans sous Node (ce fichier n'est pas un test) : juste ce que dom.js (el,
// showScreen) et les écrans utilisent — createElement, attributs, enfants, écouteurs et événements qui remontent,
// textContent, querySelector pour « balise », « #id », « .classe », « [attribut="valeur"] », leurs combinaisons et le
// descendant (« .form-links button »), focus. Rien de plus, et aucune dépendance (D3) : c'est le DOM que l'écran a
// construit qu'on regarde, pas le code qui le construit. Un vrai navigateur reste le juge de la mise en page.
//
//   installDom({ url, storage }) → { document, main } : pose document, window, location et localStorage sur
//   globalThis, avec la charpente des pages (l'en-tête : le lien vers l'accueil, D87, et #header-aside ; <main id="app">).

class FakeText {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = String(text);
    this.parentNode = null;
  }
}

// Un sélecteur simple : balise, #id, .classe, [attr], [attr="valeur"], en combinaison (« a.button-link[href="/"] »).
function parseCompound(compound) {
  const match = compound.match(/^([a-z][\w-]*|\*)?((?:#[\w-]+|\.[\w-]+|\[[^\]]+\])*)$/i);
  if (!match) throw new Error(`sélecteur non pris en charge par aide-dom : ${compound}`);
  const parts = [...(match[2] ?? '').matchAll(/#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g)];
  return {
    tag: match[1] && match[1] !== '*' ? match[1].toUpperCase() : null,
    ids: parts.filter((p) => p[1]).map((p) => p[1]),
    classes: parts.filter((p) => p[2]).map((p) => p[2]),
    attrs: parts.filter((p) => p[3]).map((p) => ({ name: p[3], value: p[4] })),
  };
}

export class FakeElement {
  constructor(tagName) {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.childNodes = [];
    this.listeners = new Map();
    this.parentNode = null;
    this.style = { setProperty() {} };
  }

  get children() { return this.childNodes.filter((node) => node.nodeType === 1); }
  get id() { return this.getAttribute('id') ?? ''; }
  get className() { return this.getAttribute('class') ?? ''; }
  get classList() {
    const list = () => this.className.split(/\s+/).filter(Boolean);
    const write = (names) => this.setAttribute('class', names.join(' '));
    return {
      contains: (name) => list().includes(name),
      add: (...names) => write([...new Set([...list(), ...names])]),
      remove: (...names) => write(list().filter((name) => !names.includes(name))),
    };
  }
  get dataset() { return Object.fromEntries([...this.attributes].filter(([name]) => name.startsWith('data-')).map(([name, value]) => [name.slice(5), value])); }
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(value) { if (value) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
  // La valeur d'un champ ; celle d'une liste déroulante est l'option choisie (l'attribut selected), sinon la première.
  get value() {
    if (this.ownValue !== undefined) return this.ownValue;
    if (this.tagName === 'SELECT') {
      const options = this.querySelectorAll('option');
      return (options.find((option) => option.hasAttribute('selected')) ?? options[0])?.getAttribute('value') ?? '';
    }
    return this.getAttribute('value') ?? '';
  }
  set value(text) { this.ownValue = String(text); }
  get textContent() { return this.childNodes.map((node) => node.textContent).join(''); }
  set textContent(text) { this.replaceChildren(...(String(text) === '' ? [] : [String(text)])); }
  get isConnected() { return this.root() === globalThis.document?.documentElement; }

  root() {
    let node = this;
    while (node.parentNode) node = node.parentNode;
    return node;
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }

  adopt(node) {
    const child = typeof node === 'string' ? new FakeText(node) : node;
    if (child.parentNode) child.remove();
    child.parentNode = this;
    return child;
  }
  append(...nodes) { for (const node of nodes) this.childNodes.push(this.adopt(node)); }
  replaceChildren(...nodes) {
    for (const node of this.childNodes) node.parentNode = null;
    this.childNodes = [];
    this.append(...nodes);
  }
  remove() {
    if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter((node) => node !== this);
    this.parentNode = null;
  }
  // Insère des frères juste avant ce nœud (le bandeau du corrigé devant la rangée des boutons, question-screen.js).
  before(...nodes) {
    const parent = this.parentNode;
    if (!parent) return;
    const adopted = nodes.map((node) => parent.adopt(node));
    const at = parent.childNodes.indexOf(this);
    parent.childNodes.splice(at, 0, ...adopted);
  }
  // Insère un enfant avant un autre (les boutons des crochets et la liste des cours, la Gestion du contenu) ; sans repère, à la fin.
  insertBefore(node, reference) {
    if (reference && reference.parentNode === this) reference.before(node);
    else this.append(node);
    return node;
  }
  // Remplace ce nœud par d'autres (le badge « facteur forcé », redessiné à chaque validation).
  replaceWith(...nodes) {
    if (!this.parentNode) return;
    this.before(...nodes);
    this.remove();
  }
  scrollIntoView() {} // les panneaux de confirmation et d'aperçu s'y amènent ; rien à faire ici

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  // L'événement remonte jusqu'à la racine, comme dans un navigateur ; `event` est un Event de Node.
  dispatchEvent(event) {
    Object.defineProperty(event, 'target', { value: this, configurable: true });
    for (let node = this; node; node = event.bubbles ? node.parentNode : null) {
      Object.defineProperty(event, 'currentTarget', { value: node, configurable: true });
      for (const listener of node.listeners.get(event.type) ?? []) listener.call(node, event);
    }
    return !event.defaultPrevented;
  }
  click() { return this.dispatchEvent(new Event('click', { bubbles: true, cancelable: true })); }
  focus() { globalThis.document.activeElement = this; }

  matches(selector) {
    return selector.split(',').some((alternative) => {
      const compounds = alternative.trim().split(/\s+/);
      if (!this.matchesCompound(compounds.at(-1))) return false;
      let node = this.parentNode;
      for (let i = compounds.length - 2; i >= 0; i -= 1) {
        while (node && !(node.nodeType === 1 && node.matchesCompound(compounds[i]))) node = node.parentNode;
        if (!node) return false;
        node = node.parentNode;
      }
      return true;
    });
  }
  matchesCompound(compound) {
    const { tag, ids, classes, attrs } = parseCompound(compound);
    return (tag === null || this.tagName === tag)
      && ids.every((id) => this.id === id)
      && classes.every((name) => this.classList.contains(name))
      && attrs.every(({ name, value }) => (value === undefined ? this.hasAttribute(name) : this.getAttribute(name) === value));
  }
  closest(selector) {
    for (let node = this; node; node = node.parentNode) if (node.nodeType === 1 && node.matches(selector)) return node;
    return null;
  }
  // Les descendants, dans l'ordre du document.
  descendants() {
    const out = [];
    for (const child of this.children) out.push(child, ...child.descendants());
    return out;
  }
  querySelectorAll(selector) { return this.descendants().filter((node) => node.matches(selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

// Un localStorage en mémoire.
export function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    get length() { return map.size; },
  };
}

// Pose le DOM sur globalThis et construit la charpente commune aux cinq pages : <header> avec le lien vers l'accueil
// (le logo et le titre, D87) et #header-aside, puis <main id="app">.
export function installDom({ url = 'http://localhost/?exercice=m10-tournage-vc', storage = fakeStorage() } = {}) {
  const html = new FakeElement('html');
  const body = new FakeElement('body');
  html.append(body);

  const el = (tag, attrs = {}, children = []) => {
    const node = new FakeElement(tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    node.append(...[children].flat());
    return node;
  };
  const header = el('header', { class: 'app-header no-print' }, [
    el('a', { class: 'app-brand', href: '/', 'aria-label': 'Accueil — tous les exercices', title: 'Accueil — tous les exercices' }, [
      el('img', { class: 'app-logo', src: 'img/logo-cvm.png', alt: 'Cégep du Vieux Montréal' }),
      el('div', { class: 'app-title', id: 'header-title' }, 'Quiz — paramètres de coupe'),
    ]),
    el('div', { class: 'app-aside', id: 'header-aside' }, 'TGM-TMI'),
  ]);
  const main = el('main', { class: 'app-main', id: 'app' });
  body.append(header, main);

  const document = {
    documentElement: html,
    body,
    title: '',
    activeElement: null,
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (_namespace, tag) => new FakeElement(tag), // un <svg> construit par le DOM (qr.js, le pictogramme de démo de l'accueil)
    createTextNode: (text) => new FakeText(text),
    querySelector: (selector) => html.querySelector(selector),
    querySelectorAll: (selector) => html.querySelectorAll(selector),
    addEventListener() {},
  };
  // Posés par defineProperty : Node peut déjà déclarer certains de ces noms (localStorage) en lecture seule.
  // history.replaceState : l'onglet courant de l'espace enseignant dans le fragment de l'adresse (D95) ; ici, il change location.
  const location = new URL(url);
  const history = { replaceState: (_state, _title, next) => { location.href = new URL(next, location.href).href; } };
  const globals = { document, window: globalThis, location, history, localStorage: storage, scrollTo: () => {}, addEventListener: () => {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  return { document, main, header };
}
