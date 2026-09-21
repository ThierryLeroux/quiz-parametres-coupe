// Toutes les requêtes SQL du serveur (base D1 ; schéma dans migrations/). Aucune règle du quiz
// ici : seance.js décide, base.js lit et écrit.
//
// Une séance lue par ce module a ses colonnes JSON déjà décodées (compteurs, question_courante) ;
// `question_brute` garde le texte d'origine de question_courante, pour les écritures « seulement
// si rien n'a changé entre-temps » : deux requêtes lancées en même temps ne peuvent ni compter une
// réussite deux fois, ni tirer deux questions pour en choisir une.

function decode(row) {
  if (row === null) return null;
  return {
    ...row,
    compteurs: JSON.parse(row.compteurs),
    question_courante: row.question_courante === null ? null : JSON.parse(row.question_courante),
    question_brute: row.question_courante,
  };
}

export async function findSession(db, exerciseId, matricule) {
  return decode(await db.prepare('SELECT * FROM seances WHERE exercice_id = ? AND matricule = ?').bind(exerciseId, matricule).first());
}

export async function findSessionByToken(db, tokenHash) {
  return decode(await db.prepare('SELECT * FROM seances WHERE jeton_hache = ?').bind(tokenHash).first());
}

// Crée la séance d'un couple (exercice, matricule). Retourne false si elle existait déjà (deux
// premières identifications en même temps) : l'appelant la traite alors comme une reprise.
export async function createSession(db, s) {
  const { meta } = await db.prepare(`
    INSERT INTO seances (exercice_id, matricule, prenom, nom, nip_hache, jeton_hache, jeton_expire_le,
                         debut, derniere_activite, version_exercice, compteurs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (exercice_id, matricule) DO NOTHING`)
    .bind(s.exercice_id, s.matricule, s.prenom, s.nom, s.nip_hache, s.jeton_hache, s.jeton_expire_le, s.debut, s.debut, s.version_exercice, JSON.stringify(s.compteurs))
    .run();
  return meta.changes === 1;
}

// Inscrit un essai de NIP (valeurs de countNipAttempt), seulement si personne n'en a inscrit un
// autre depuis la lecture de la séance. Retourne false sinon : l'essai n'est pas examiné.
export async function takeNipAttempt(db, session, attempt) {
  const { meta } = await db.prepare(`
    UPDATE seances SET essais_nip = ?, essais_nip_debut = ?, verrou_nip_jusqua = ?
    WHERE id = ? AND essais_nip = ? AND essais_nip_debut IS ?`)
    .bind(attempt.essais_nip, attempt.essais_nip_debut, attempt.verrou_nip_jusqua, session.id, session.essais_nip, session.essais_nip_debut)
    .run();
  return meta.changes === 1;
}

// Identification réussie : nouveau jeton (l'ancien ne vaut plus rien), essais de NIP effacés.
// nip_hache est réécrit : c'est ainsi qu'un NIP remis à zéro par l'enseignant est remplacé.
export async function openSession(db, id, { nip_hache, jeton_hache, jeton_expire_le, now, cleared }) {
  await db.prepare(`
    UPDATE seances SET nip_hache = ?, jeton_hache = ?, jeton_expire_le = ?, derniere_activite = ?,
                       essais_nip = ?, essais_nip_debut = ?, verrou_nip_jusqua = ?
    WHERE id = ?`)
    .bind(nip_hache, jeton_hache, jeton_expire_le, now, cleared.essais_nip, cleared.essais_nip_debut, cleared.verrou_nip_jusqua, id)
    .run();
}

// Chaque appel authentifié prolonge le jeton.
export async function touchSession(db, id, now, expiresAt) {
  await db.prepare('UPDATE seances SET derniere_activite = ?, jeton_expire_le = ? WHERE id = ?').bind(now, expiresAt, id).run();
}

// « Changer d'étudiant » : le jeton ne vaut plus rien.
export async function closeToken(db, id) {
  await db.prepare('UPDATE seances SET jeton_hache = NULL, jeton_expire_le = NULL WHERE id = ?').bind(id).run();
}

// Mémorise la question tirée (ou, s'il n'y a plus rien à tirer, la réussite), seulement si la
// question mémorisée est encore celle qu'on a lue. Retourne false sinon.
//   completion : null, ou { reussite_le, version_exercice_reussite }
export async function saveQuestion(db, session, question, completion) {
  const { meta } = await db.prepare(`
    UPDATE seances SET question_courante = ?, reussite_le = ?, version_exercice_reussite = ?
    WHERE id = ? AND question_courante IS ? AND reussite_le IS NULL`)
    .bind(question === null ? null : JSON.stringify(question), completion?.reussite_le ?? null, completion?.version_exercice_reussite ?? null, session.id, session.question_brute)
    .run();
  return meta.changes === 1;
}

// Enregistre une correction : une ligne au journal ET la séance mise à jour (compteurs, question
// suivante, heure de la correction, réussite), en un seul lot — tout passe, ou rien. Les deux
// requêtes ne font rien si la séance a changé depuis sa lecture (autre correction en même temps) :
// retourne false dans ce cas.
//   c : { outil_id, question, reponses, resultat, reussie, horodatage, compteurs, question_suivante, completion }
export async function recordCorrection(db, session, c) {
  const unchanged = 'id = ? AND derniere_correction IS ? AND question_courante IS ?';
  const guard = [session.id, session.derniere_correction, session.question_brute];
  const [, update] = await db.batch([
    db.prepare(`
      INSERT INTO corrections (seance_id, outil_id, question, reponses, resultat, reussie, horodatage)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM seances WHERE ${unchanged})`)
      .bind(session.id, c.outil_id, JSON.stringify(c.question), JSON.stringify(c.reponses), JSON.stringify(c.resultat), c.reussie ? 1 : 0, c.horodatage, ...guard),
    db.prepare(`
      UPDATE seances SET compteurs = ?, question_courante = ?, derniere_correction = ?, reussite_le = ?, version_exercice_reussite = ?
      WHERE ${unchanged}`)
      .bind(JSON.stringify(c.compteurs), c.question_suivante === null ? null : JSON.stringify(c.question_suivante), c.horodatage,
        c.completion?.reussite_le ?? null, c.completion?.version_exercice_reussite ?? null, ...guard),
  ]);
  return update.meta.changes === 1;
}

// « Corriger mon identité » (D23) : la séance est DÉPLACÉE — même ligne, mêmes compteurs, même
// journal — et la correction est notée, en un seul lot. Si le nouveau matricule a déjà une séance
// pour cet exercice, la contrainte d'unicité refuse tout le lot : retourne false.
//   identity : { prenom, nom, matricule, nip_hache } — le NIP est haché avec le matricule, donc à refaire
export async function moveSession(db, session, identity, now) {
  try {
    await db.batch([
      db.prepare('UPDATE seances SET prenom = ?, nom = ?, matricule = ?, nip_hache = ? WHERE id = ?')
        .bind(identity.prenom, identity.nom, identity.matricule, identity.nip_hache, session.id),
      db.prepare(`
        INSERT INTO corrections_identite (seance_id, ancien_prenom, ancien_nom, ancien_matricule,
                                          nouveau_prenom, nouveau_nom, nouveau_matricule, horodatage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(session.id, session.prenom, session.nom, session.matricule, identity.prenom, identity.nom, identity.matricule, now),
    ]);
    return true;
  } catch (error) {
    if (/UNIQUE/i.test(String(error?.message))) return false;
    throw error;
  }
}

// Après un NIP reconnu sans ouvrir de nouveau jeton (« Corriger mon identité ») : essais effacés.
export async function clearNipAttempts(db, id, cleared) {
  await db.prepare('UPDATE seances SET essais_nip = ?, essais_nip_debut = ?, verrou_nip_jusqua = ? WHERE id = ?')
    .bind(cleared.essais_nip, cleared.essais_nip_debut, cleared.verrou_nip_jusqua, id).run();
}

export async function findSessionById(db, id) {
  return decode(await db.prepare('SELECT * FROM seances WHERE id = ?').bind(id).first());
}
