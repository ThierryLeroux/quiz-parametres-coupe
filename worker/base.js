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
// journal — et la correction est notée, en un seul lot. Après la réussite (D37), le même lot annule
// l'attestation en cours (motif « identité corrigée ») et en insère une nouvelle. Une contrainte
// d'unicité refuse tout le lot : retourne 'matricule' si le nouveau matricule a déjà une séance
// pour cet exercice, 'code' si le code de la nouvelle attestation est déjà pris (l'appelant en
// tire un autre, D42), 'ok' sinon.
//   identity : { prenom, nom, matricule, nip_hache } — le NIP est haché avec le matricule, donc à refaire
//   reissue  : null, ou { ancienne: { id, code }, nouvelle: { code, enregistrement, signature } }
export async function moveSession(db, session, identity, now, reissue = null) {
  const statements = [
    db.prepare('UPDATE seances SET prenom = ?, nom = ?, matricule = ?, nip_hache = ? WHERE id = ?')
      .bind(identity.prenom, identity.nom, identity.matricule, identity.nip_hache, session.id),
    db.prepare(`
      INSERT INTO corrections_identite (seance_id, ancien_prenom, ancien_nom, ancien_matricule,
                                        nouveau_prenom, nouveau_nom, nouveau_matricule, horodatage, ancien_code, nouveau_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(session.id, session.prenom, session.nom, session.matricule, identity.prenom, identity.nom, identity.matricule, now,
        reissue?.ancienne.code ?? null, reissue?.nouvelle.code ?? null),
  ];
  if (reissue !== null) {
    statements.push(
      db.prepare("UPDATE attestations SET annulee_le = ?, annulation_motif = 'identite_corrigee' WHERE id = ? AND annulee_le IS NULL").bind(now, reissue.ancienne.id),
      db.prepare('INSERT INTO attestations (seance_id, code, enregistrement, signature, creee_le) VALUES (?, ?, ?, ?, ?)')
        .bind(session.id, reissue.nouvelle.code, JSON.stringify(reissue.nouvelle.enregistrement), reissue.nouvelle.signature, now),
    );
  }
  try {
    await db.batch(statements);
    return 'ok';
  } catch (error) {
    const message = String(error?.message);
    if (/UNIQUE/i.test(message)) return /attestations\.code/.test(message) ? 'code' : 'matricule';
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

// Le journal des corrections d'une séance, dans l'ordre chronologique, colonnes JSON décodées : de
// quoi composer la liste des questions réussies de l'attestation (D41).
export async function listCorrections(db, seanceId) {
  const { results } = await db.prepare('SELECT * FROM corrections WHERE seance_id = ? ORDER BY id').bind(seanceId).all();
  return results.map((row) => ({ ...row, question: JSON.parse(row.question), reponses: JSON.parse(row.reponses), resultat: JSON.parse(row.resultat) }));
}

// --- Attestations (D31, D35) -------------------------------------------------------------------------------

function decodeAttestation(row) {
  return row === null ? null : { ...row, enregistrement: JSON.parse(row.enregistrement) };
}

// L'attestation en cours d'une séance (la plus récente non annulée), ou null.
export async function findCurrentAttestation(db, seanceId) {
  return decodeAttestation(await db.prepare('SELECT * FROM attestations WHERE seance_id = ? AND annulee_le IS NULL ORDER BY id DESC LIMIT 1').bind(seanceId).first());
}

export async function findAttestationByCode(db, code) {
  return decodeAttestation(await db.prepare('SELECT * FROM attestations WHERE code = ?').bind(code).first());
}

// Crée l'attestation d'une séance, seulement si elle n'en a pas déjà une en cours : deux requêtes
// qui constatent la réussite en même temps n'en créent qu'une. Retourne false si rien n'a été
// écrit — attestation déjà là, ou code déjà pris (l'appelant en tire un autre).
//   a : { seance_id, code, enregistrement (objet), signature, creee_le }
export async function createAttestation(db, a) {
  try {
    const { meta } = await db.prepare(`
      INSERT INTO attestations (seance_id, code, enregistrement, signature, creee_le)
      SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM attestations WHERE seance_id = ? AND annulee_le IS NULL)`)
      .bind(a.seance_id, a.code, JSON.stringify(a.enregistrement), a.signature, a.creee_le, a.seance_id)
      .run();
    return meta.changes === 1;
  } catch (error) {
    if (/UNIQUE/i.test(String(error?.message))) return false;
    throw error;
  }
}

// --- Espace professeur (D34, D35) ------------------------------------------------------------------------------

// Une ligne au journal des actions d'enseignant.
//   entry : { horodatage, enseignant (ou null), seance_id (ou null), action, details (ou null) }
export async function addTeacherLog(db, entry) {
  await db.prepare('INSERT INTO journal_enseignant (horodatage, enseignant, seance_id, action, details) VALUES (?, ?, ?, ?, ?)')
    .bind(entry.horodatage, entry.enseignant ?? null, entry.seance_id ?? null, entry.action, entry.details ?? null).run();
}

// Toutes les séances, pour le tableau des réussites : qui, quel exercice, quand, réussie ou en
// cours, questions réussies, code de l'attestation en cours. Ni NIP, ni jeton, ni question.
export async function listSessions(db) {
  const { results } = await db.prepare(`
    SELECT s.id, s.exercice_id, s.prenom, s.nom, s.matricule, s.debut, s.derniere_activite, s.reussite_le,
           json_extract(s.compteurs, '$.totalReussies') AS total_reussies,
           (SELECT code FROM attestations a WHERE a.seance_id = s.id AND a.annulee_le IS NULL ORDER BY a.id DESC LIMIT 1) AS code
    FROM seances s ORDER BY s.derniere_activite DESC`).all();
  return results;
}

// Remise à zéro d'une séance (D35) : la progression repart de zéro, la séance reste (matricule, NIP,
// jeton), l'attestation en cours est annulée, l'action est journalisée — en un seul lot.
//   compteurs : les compteurs vides (seance.js) ; entry : la ligne du journal (addTeacherLog)
export async function resetSession(db, seanceId, compteurs, now, entry) {
  await db.batch([
    db.prepare(`
      UPDATE seances SET compteurs = ?, question_courante = NULL, derniere_correction = NULL,
                         reussite_le = NULL, version_exercice_reussite = NULL
      WHERE id = ?`).bind(JSON.stringify(compteurs), seanceId),
    db.prepare("UPDATE attestations SET annulee_le = ?, annulation_motif = 'remise_a_zero' WHERE seance_id = ? AND annulee_le IS NULL").bind(now, seanceId),
    db.prepare('INSERT INTO journal_enseignant (horodatage, enseignant, seance_id, action, details) VALUES (?, ?, ?, ?, ?)')
      .bind(entry.horodatage, entry.enseignant, seanceId, entry.action, entry.details ?? null),
  ]);
}

// Réinitialisation du NIP (D38) : nip_hache nul — le prochain NIP présenté à la reprise devient le
// nouveau —, essais et verrou effacés, l'action journalisée, en un seul lot. Le jeton en cours reste.
//   cleared : NIP_CLEARED (seance.js) ; entry : la ligne du journal
export async function resetNip(db, seanceId, cleared, entry) {
  await db.batch([
    db.prepare('UPDATE seances SET nip_hache = NULL, essais_nip = ?, essais_nip_debut = ?, verrou_nip_jusqua = ? WHERE id = ?')
      .bind(cleared.essais_nip, cleared.essais_nip_debut, cleared.verrou_nip_jusqua, seanceId),
    db.prepare('INSERT INTO journal_enseignant (horodatage, enseignant, seance_id, action, details) VALUES (?, ?, ?, ?, ?)')
      .bind(entry.horodatage, entry.enseignant, seanceId, entry.action, entry.details ?? null),
  ]);
}

// Suppression d'une séance (D45) : la séance disparaît avec son journal des corrections et ses
// corrections d'identité (ON DELETE CASCADE) ; ses attestations restent, l'attestation en cours
// annulée « séance supprimée » avec la date (leur seance_id passe à NULL par la base) ; l'action est
// journalisée sans lien vers la séance, qui n'existe plus — en un seul lot.
//   entry : la ligne du journal (addTeacherLog), dont les détails nomment l'étudiant et la séance
export async function deleteSession(db, seanceId, now, entry) {
  await db.batch([
    db.prepare("UPDATE attestations SET annulee_le = ?, annulation_motif = 'seance_supprimee' WHERE seance_id = ? AND annulee_le IS NULL").bind(now, seanceId),
    db.prepare('INSERT INTO journal_enseignant (horodatage, enseignant, seance_id, action, details) VALUES (?, ?, NULL, ?, ?)')
      .bind(entry.horodatage, entry.enseignant, entry.action, entry.details ?? null),
    db.prepare('DELETE FROM seances WHERE id = ?').bind(seanceId),
  ]);
}

// Le journal des corrections d'identité, la plus récente en premier, avec la séance telle qu'elle
// est aujourd'hui (exercice, matricule actuel).
export async function listIdentityCorrections(db) {
  const { results } = await db.prepare(`
    SELECT c.id, c.seance_id, c.horodatage, c.ancien_prenom, c.ancien_nom, c.ancien_matricule,
           c.nouveau_prenom, c.nouveau_nom, c.nouveau_matricule, c.ancien_code, c.nouveau_code, s.exercice_id, s.matricule
    FROM corrections_identite c JOIN seances s ON s.id = c.seance_id
    ORDER BY c.id DESC`).all();
  return results;
}

// --- Limites de débit et verrous par adresse (D34, D36) ------------------------------------------------------

export async function findLock(db, portee, adresse) {
  return db.prepare('SELECT * FROM verrous WHERE portee = ? AND adresse = ?').bind(portee, adresse).first();
}

//   lock : { echecs, jusqua }
export async function setLock(db, portee, adresse, lock) {
  await db.prepare(`
    INSERT INTO verrous (portee, adresse, echecs, jusqua) VALUES (?, ?, ?, ?)
    ON CONFLICT (portee, adresse) DO UPDATE SET echecs = excluded.echecs, jusqua = excluded.jusqua`)
    .bind(portee, adresse, lock.echecs, lock.jusqua).run();
}

export async function clearLock(db, portee, adresse) {
  await db.prepare('DELETE FROM verrous WHERE portee = ? AND adresse = ?').bind(portee, adresse).run();
}

// Note une valeur vue par une adresse dans une tranche horaire, efface les tranches passées, et
// retourne { nouvelle, distinctes } : la valeur était-elle inconnue de cette tranche, et combien de
// valeurs distinctes la tranche compte maintenant pour cette adresse.
export async function countDistinct(db, portee, adresse, tranche, valeur) {
  const [, insert, count] = await db.batch([
    db.prepare('DELETE FROM debit WHERE tranche < ?').bind(tranche),
    db.prepare('INSERT OR IGNORE INTO debit (portee, adresse, tranche, valeur) VALUES (?, ?, ?, ?)').bind(portee, adresse, tranche, valeur),
    db.prepare('SELECT COUNT(*) AS n FROM debit WHERE portee = ? AND adresse = ? AND tranche = ?').bind(portee, adresse, tranche),
  ]);
  return { nouvelle: insert.meta.changes === 1, distinctes: count.results[0].n };
}

// Oublie une valeur refusée : elle ne compte pas parmi les valeurs vues, et sera refusée de nouveau.
export async function forgetDistinct(db, portee, adresse, tranche, valeur) {
  await db.prepare('DELETE FROM debit WHERE portee = ? AND adresse = ? AND tranche = ? AND valeur = ?').bind(portee, adresse, tranche, valeur).run();
}
