// Règles de l'identification (SPEC §8, décisions D19, D23) : prénom, nom, matricule à 7 chiffres et
// NIP de 4 à 6 chiffres. Rien d'autre. Selon l'écran, on en vérifie une partie : le matricule
// seul (1/2), le NIP seul (reprise), les quatre champs (nouvelle séance, correction d'identité).
//
// Le navigateur s'en sert pour vérifier la FORME des champs avant l'envoi ; le serveur revérifie
// tout, et lui seul sait si le NIP est le bon. Fonctions pures, sans DOM.

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';

// Vérifie l'identification saisie, champ par champ, pour que l'écran affiche chaque message sous
// sa case : { prenom, nom, matricule, nip }, où chaque valeur est le message d'erreur en
// français, ou null si le champ est valide.
export function studentErrors(student) {
  return {
    prenom: isText(student.prenom) ? null : 'Le prénom est requis.',
    nom: isText(student.nom) ? null : 'Le nom est requis.',
    matricule: matriculeError(student.matricule),
    nip: nipError(student.nip),
  };
}

export function matriculeError(matricule) {
  if (!isText(matricule)) return 'Le matricule est requis.';
  if (!/^\d{7}$/.test(matricule.trim())) return 'Le matricule doit avoir exactement 7 chiffres.';
  return null;
}

export function nipError(nip) {
  if (!isText(nip)) return 'Le NIP est requis.';
  if (!/^\d{4,6}$/.test(nip.trim())) return 'Le NIP doit avoir de 4 à 6 chiffres.';
  return null;
}

// Même vérification, en liste : une erreur par champ fautif (liste vide = identification valide).
export function validateStudent(student) {
  if (!isObject(student)) return ["identification : n'est pas un objet"];
  return Object.values(studentErrors(student)).filter((message) => message !== null);
}

// L'identification telle qu'on l'envoie au serveur : les quatre champs, sans les espaces autour.
// À appeler sur une identification valide (validateStudent).
export function cleanStudent(student) {
  return {
    prenom: student.prenom.trim(),
    nom: student.nom.trim(),
    matricule: student.matricule.trim(),
    nip: student.nip.trim(),
  };
}
