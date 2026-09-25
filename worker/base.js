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

// Crée la séance d'un couple (exercice, matricule), épinglée à la version publiée du moment
// (version_id, D47). Retourne false si elle existait déjà (deux premières identifications en même temps).
export async function createSession(db, s) {
  const { meta } = await db.prepare(`
    INSERT INTO seances (exercice_id, matricule, prenom, nom, nip_hache, jeton_hache, jeton_expire_le,
                         debut, derniere_activite, version_exercice, version_id, compteurs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (exercice_id, matricule) DO NOTHING`)
    .bind(s.exercice_id, s.matricule, s.prenom, s.nom, s.nip_hache, s.jeton_hache, s.jeton_expire_le, s.debut, s.debut, s.version_exercice, s.version_id, JSON.stringify(s.compteurs))
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

// --- Effacement des données des étudiants (D46) ---------------------------------------------------------------

// Ce qu'il y a à effacer : { seances, corrections, corrections_identite, attestations, debit, verrous }.
export async function countStudentData(db) {
  return db.prepare(`
    SELECT (SELECT COUNT(*) FROM seances) AS seances, (SELECT COUNT(*) FROM corrections) AS corrections,
           (SELECT COUNT(*) FROM corrections_identite) AS corrections_identite, (SELECT COUNT(*) FROM attestations) AS attestations,
           (SELECT COUNT(*) FROM debit) AS debit, (SELECT COUNT(*) FROM verrous) AS verrous`).first();
}

// Le journal des actions, tel quel : { id, action, details } — pour l'anonymiser à l'effacement.
export async function listTeacherLog(db) {
  const { results } = await db.prepare('SELECT id, action, details FROM journal_enseignant ORDER BY id').all();
  return results;
}

// Efface toutes les séances, journaux de corrections, corrections d'identité et attestations, les
// compteurs de débit et les verrous ; anonymise les détails du journal des actions — qui reste, ses
// lignes détachées des séances (ON DELETE SET NULL) — et y inscrit l'action ; en un seul lot. Les
// exercices et le catalogue ne sont pas en base : jamais touchés.
//   anonymized : [{ id, details }] — les lignes du journal à réécrire (acces.js, anonymizedDetails)
//   entry      : la ligne du journal (addTeacherLog), dont les détails donnent les nombres effacés
export async function purgeStudentData(db, anonymized, entry) {
  await db.batch([
    ...anonymized.map((row) => db.prepare('UPDATE journal_enseignant SET details = ? WHERE id = ?').bind(row.details, row.id)),
    db.prepare('DELETE FROM attestations'),
    db.prepare('DELETE FROM corrections_identite'),
    db.prepare('DELETE FROM corrections'),
    db.prepare('DELETE FROM seances'),
    db.prepare('DELETE FROM debit'),
    db.prepare('DELETE FROM verrous'),
    db.prepare('INSERT INTO journal_enseignant (horodatage, enseignant, seance_id, action, details) VALUES (?, ?, NULL, ?, ?)')
      .bind(entry.horodatage, entry.enseignant, entry.action, entry.details ?? null),
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

// --- Exercices, versions, banque d'outils, tables de référence (jalon 7, D47 à D49) ----------------------------
// Les colonnes JSON sont décodées à la lecture. Une version publiée est immuable ; le brouillon d'un
// exercice et un outil de la banque portent un numéro de révision : une écriture doit présenter
// celui qu'elle a lu, sinon elle est refusée (contrôle optimiste, D48).

const decodeJson = (row, keys) => (row === null ? null : { ...row, ...Object.fromEntries(keys.map((key) => [key, JSON.parse(row[key])])) });

export async function findTables(db, id) {
  return decodeJson(await db.prepare('SELECT * FROM tables_reference WHERE id = ?').bind(id).first(), ['materiaux', 'operations']);
}

// La version des tables de référence la plus récente : celle que prend une publication.
export async function findLatestTables(db) {
  return decodeJson(await db.prepare('SELECT * FROM tables_reference ORDER BY creee_le DESC, id DESC LIMIT 1').first(), ['materiaux', 'operations']);
}

export async function listTables(db) {
  const { results } = await db.prepare('SELECT * FROM tables_reference ORDER BY creee_le, id').all();
  return results.map((row) => decodeJson(row, ['materiaux', 'operations']));
}

export async function findExercise(db, id) {
  return decodeJson(await db.prepare('SELECT * FROM exercices WHERE id = ?').bind(id).first(), ['brouillon']);
}

export async function findVersionById(db, id) {
  return decodeJson(await db.prepare('SELECT * FROM versions_exercice WHERE id = ?').bind(id).first(), ['contenu']);
}

export async function findVersion(db, exerciceId, numero) {
  return decodeJson(await db.prepare('SELECT * FROM versions_exercice WHERE exercice_id = ? AND numero = ?').bind(exerciceId, numero).first(), ['contenu']);
}

// La dernière version publiée d'un exercice, ou null s'il n'a jamais été publié.
export async function findLatestVersion(db, exerciceId) {
  return decodeJson(await db.prepare('SELECT * FROM versions_exercice WHERE exercice_id = ? ORDER BY numero DESC LIMIT 1').bind(exerciceId).first(), ['contenu']);
}

// Les versions d'un exercice, la plus récente en premier, sans leur contenu, avec le nombre de séances épinglées à chacune.
export async function listVersions(db, exerciceId) {
  const { results } = await db.prepare(`
    SELECT v.id, v.numero, v.tables_id, v.publiee_le, (SELECT COUNT(*) FROM seances s WHERE s.version_id = v.id) AS seances
    FROM versions_exercice v WHERE v.exercice_id = ? ORDER BY v.numero DESC`).bind(exerciceId).all();
  return results;
}

// Tous les exercices, pour la liste de l'éditeur : la fiche, le brouillon, le contenu de la dernière
// version et le nombre de séances (toutes versions confondues). Les versions détaillées : listVersions.
export async function listExercises(db) {
  const { results } = await db.prepare(`
    SELECT e.id, e.brouillon, e.revision, e.brouillon_modifie_le, e.publie_le, e.archive_le, e.cree_le, e.rang,
           (SELECT MAX(numero) FROM versions_exercice v WHERE v.exercice_id = e.id) AS derniere_version,
           (SELECT contenu FROM versions_exercice v WHERE v.exercice_id = e.id ORDER BY numero DESC LIMIT 1) AS contenu_publie,
           (SELECT COUNT(*) FROM seances s WHERE s.exercice_id = e.id) AS seances
    FROM exercices e ORDER BY e.rang, e.id`).all();
  return results.map((row) => ({ ...row, brouillon: JSON.parse(row.brouillon), contenu_publie: row.contenu_publie === null ? null : JSON.parse(row.contenu_publie) }));
}

// Les exercices publiés (archivés compris : l'appelant filtre), avec le contenu de leur dernière version.
export async function listPublishedExercises(db) {
  const { results } = await db.prepare(`
    SELECT e.id, e.archive_le, v.id AS version_id, v.numero, v.contenu, v.tables_id
    FROM exercices e JOIN versions_exercice v ON v.exercice_id = e.id
    WHERE v.numero = (SELECT MAX(numero) FROM versions_exercice w WHERE w.exercice_id = e.id)
    ORDER BY e.rang, e.id`).all();
  return results.map((row) => ({ ...row, contenu: JSON.parse(row.contenu) }));
}

function teacherLogStatement(db, entry) {
  return db.prepare('INSERT INTO journal_enseignant (horodatage, enseignant, seance_id, action, details) VALUES (?, ?, NULL, ?, ?)')
    .bind(entry.horodatage, entry.enseignant, entry.action, entry.details ?? null);
}

// Crée un exercice (brouillon seul, jamais publié), au dernier rang (D51), et journalise. Retourne false si l'identifiant est déjà pris.
export async function createExercise(db, { id, brouillon, now }, entry) {
  try {
    await db.batch([
      db.prepare('INSERT INTO exercices (id, brouillon, brouillon_modifie_le, cree_le, rang) SELECT ?, ?, ?, ?, COALESCE(MAX(rang), 0) + 1 FROM exercices').bind(id, JSON.stringify(brouillon), now, now),
      teacherLogStatement(db, entry),
    ]);
    return true;
  } catch (error) {
    if (/UNIQUE/i.test(String(error?.message))) return false;
    throw error;
  }
}

// Enregistre le brouillon, seulement si sa révision est encore celle qu'on a lue (D48), puis
// journalise. Retourne false si quelqu'un a enregistré entre-temps : rien n'est écrit, rien n'est journalisé.
export async function saveDraft(db, id, revision, brouillon, now, entry) {
  const { meta } = await db.prepare('UPDATE exercices SET brouillon = ?, revision = revision + 1, brouillon_modifie_le = ? WHERE id = ? AND revision = ?').bind(JSON.stringify(brouillon), now, id, revision).run();
  if (meta.changes !== 1) return false;
  await addTeacherLog(db, entry);
  return true;
}

// Publie un contenu comme version `numero` de l'exercice, seulement si la révision du brouillon est
// encore celle qu'on a lue, et si ce numéro n'est pas déjà pris (deux publications en même temps :
// une seule passe, UNIQUE) ; la version et la ligne du journal vont dans le même lot. Retourne false sinon.
export async function publishVersion(db, { id, revision, numero, contenu, tablesId, now }, entry) {
  const { meta } = await db.prepare('UPDATE exercices SET publie_le = ? WHERE id = ? AND revision = ?').bind(now, id, revision).run();
  if (meta.changes !== 1) return false;
  try {
    await db.batch([
      db.prepare('INSERT INTO versions_exercice (exercice_id, numero, contenu, tables_id, publiee_le) VALUES (?, ?, ?, ?, ?)').bind(id, numero, JSON.stringify(contenu), tablesId, now),
      teacherLogStatement(db, entry),
    ]);
    return true;
  } catch (error) {
    if (/UNIQUE/i.test(String(error?.message))) return false;
    throw error;
  }
}

// Réécrit les rangs des exercices, 1 à n dans l'ordre donné (D51), et journalise — en un seul lot.
// L'appelant a vérifié que le rang de l'exercice déplacé est encore celui que l'écran a vu.
export async function renumberExercises(db, orderedIds, entry) {
  await db.batch([
    ...orderedIds.map((id, i) => db.prepare('UPDATE exercices SET rang = ? WHERE id = ?').bind(i + 1, id)),
    teacherLogStatement(db, entry),
  ]);
}

// Archive (date) ou rétablit (null) un exercice, et journalise.
export async function archiveExercise(db, id, archiveLe, entry) {
  await db.batch([db.prepare('UPDATE exercices SET archive_le = ? WHERE id = ?').bind(archiveLe, id), teacherLogStatement(db, entry)]);
}

// Supprime un exercice et ses versions — l'appelant a vérifié qu'aucune séance ne s'y rattache.
export async function deleteExercise(db, id, entry) {
  await db.batch([
    db.prepare('DELETE FROM versions_exercice WHERE exercice_id = ?').bind(id),
    db.prepare('DELETE FROM exercices WHERE id = ?').bind(id),
    teacherLogStatement(db, entry),
  ]);
}

export async function countSessionsOfExercise(db, exerciceId) {
  return (await db.prepare('SELECT COUNT(*) AS n FROM seances WHERE exercice_id = ?').bind(exerciceId).first()).n;
}

// Une séance créée par l'ancien serveur, entre la migration et le déploiement, n'a pas de version :
// on l'épingle à la première venue.
export async function pinSessionVersion(db, seanceId, versionId) {
  await db.prepare('UPDATE seances SET version_id = ? WHERE id = ? AND version_id IS NULL').bind(versionId, seanceId).run();
}

// --- Banque d'outils ---

export async function listBankTools(db) {
  const { results } = await db.prepare('SELECT * FROM banque_outils ORDER BY rang, id').all();
  return results.map((row) => decodeJson(row, ['outil']));
}

export async function findBankTool(db, id) {
  return decodeJson(await db.prepare('SELECT * FROM banque_outils WHERE id = ?').bind(id).first(), ['outil']);
}

// Crée un outil de la banque, au dernier rang, et journalise. Retourne false si l'identifiant est déjà pris.
export async function createBankTool(db, { id, outil, now }, entry) {
  try {
    await db.batch([
      db.prepare('INSERT INTO banque_outils (id, outil, rang, modifie_le) SELECT ?, ?, COALESCE(MAX(rang), 0) + 1, ? FROM banque_outils').bind(id, JSON.stringify(outil), now),
      teacherLogStatement(db, entry),
    ]);
    return true;
  } catch (error) {
    if (/UNIQUE/i.test(String(error?.message))) return false;
    throw error;
  }
}

// Enregistre un outil de la banque, seulement si sa révision est encore celle qu'on a lue (D48), puis journalise.
export async function saveBankTool(db, id, revision, outil, now, entry) {
  const { meta } = await db.prepare('UPDATE banque_outils SET outil = ?, revision = revision + 1, modifie_le = ? WHERE id = ? AND revision = ?').bind(JSON.stringify(outil), now, id, revision).run();
  if (meta.changes !== 1) return false;
  await addTeacherLog(db, entry);
  return true;
}

export async function archiveBankTool(db, id, archiveLe, entry) {
  await db.batch([db.prepare('UPDATE banque_outils SET archive_le = ? WHERE id = ?').bind(archiveLe, id), teacherLogStatement(db, entry)]);
}

// --- Images (jalon 7b, D56) : photos d'outils et pictogrammes, en blob ---

const IMAGE_COLUMNS = 'id, nom, usage, type, taille, empreinte, creee_le, archivee_le';

// Les fiches de toutes les images (sans le contenu), par usage puis par nom.
export async function listImages(db) {
  const { results } = await db.prepare(`SELECT ${IMAGE_COLUMNS} FROM images ORDER BY usage, nom, id`).all();
  return results;
}

// Une image avec son contenu (BLOB : ArrayBuffer sur D1, Uint8Array sur node:sqlite — images.js, toBytes).
export async function findImage(db, id) {
  return db.prepare('SELECT * FROM images WHERE id = ?').bind(id).first();
}

export async function findImageMeta(db, id) {
  return db.prepare(`SELECT ${IMAGE_COLUMNS} FROM images WHERE id = ?`).bind(id).first();
}

// L'image qui a déjà cette empreinte, ou null : un doublon exact n'est pas stocké deux fois.
export async function findImageByHash(db, empreinte) {
  return db.prepare(`SELECT ${IMAGE_COLUMNS} FROM images WHERE empreinte = ? ORDER BY creee_le, id LIMIT 1`).bind(empreinte).first();
}

// Enregistre une image et journalise, en un lot. Retourne false si l'identifiant est déjà pris.
//   image : { id, nom, usage, type, taille, empreinte, contenu (ArrayBuffer), creee_le, archivee_le }
export async function createImage(db, image, entry) {
  try {
    await db.batch([
      db.prepare('INSERT INTO images (id, nom, usage, type, taille, empreinte, contenu, creee_le, archivee_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(image.id, image.nom, image.usage, image.type, image.taille, image.empreinte, image.contenu, image.creee_le, image.archivee_le ?? null),
      teacherLogStatement(db, entry),
    ]);
    return true;
  } catch (error) {
    if (/UNIQUE/i.test(String(error?.message))) return false;
    throw error;
  }
}

// Archive (date) ou rétablit (null) une image, et journalise.
export async function archiveImage(db, id, archiveeLe, entry) {
  await db.batch([db.prepare('UPDATE images SET archivee_le = ? WHERE id = ?').bind(archiveeLe, id), teacherLogStatement(db, entry)]);
}

// Renomme une image (le nom lisible seulement : l'identifiant et le contenu ne changent jamais), et journalise.
export async function renameImage(db, id, nom, entry) {
  await db.batch([db.prepare('UPDATE images SET nom = ? WHERE id = ?').bind(nom, id), teacherLogStatement(db, entry)]);
}

// Supprime une image — l'appelant a vérifié qu'elle n'est utilisée nulle part —, et journalise.
export async function deleteImage(db, id, entry) {
  await db.batch([db.prepare('DELETE FROM images WHERE id = ?').bind(id), teacherLogStatement(db, entry)]);
}

// Toutes les versions publiées avec leur contenu, pour savoir où une image est utilisée.
export async function listVersionContents(db) {
  const { results } = await db.prepare('SELECT exercice_id, numero, contenu FROM versions_exercice ORDER BY exercice_id, numero').all();
  return results.map((row) => ({ ...row, contenu: JSON.parse(row.contenu) }));
}

// Toutes les images avec leur contenu, pour l'export.
export async function listImagesWithContent(db) {
  const { results } = await db.prepare('SELECT * FROM images ORDER BY usage, nom, id').all();
  return results;
}

// --- Sauvegarde : export complet, import par fusion (D49) ---

// Tout ce que l'éditeur gère : tables de référence, banque, exercices avec toutes leurs versions.
export async function exportEditorData(db) {
  const tables = await listTables(db);
  const banque = await listBankTools(db);
  const exercices = await listExercises(db);
  const { results: versions } = await db.prepare('SELECT exercice_id, numero, contenu, tables_id, publiee_le FROM versions_exercice ORDER BY exercice_id, numero').all();
  return {
    tables_reference: tables.map(({ id, materiaux, operations, creee_le }) => ({ id, materiaux, operations, creee_le })),
    banque: banque.map(({ id, outil, rang, archive_le }) => ({ id, outil, rang, archive_le })),
    exercices: exercices.map(({ id, brouillon, archive_le, cree_le, publie_le, rang }) => ({
      id, brouillon, archive_le, cree_le, publie_le, rang,
      versions: versions.filter((v) => v.exercice_id === id).map(({ numero, contenu, tables_id, publiee_le }) => ({ numero, contenu: JSON.parse(contenu), tables_id, publiee_le })),
    })),
  };
}

// Applique un plan d'import (editeur.js, importPlan) en un seul lot : tables et versions ajoutées,
// brouillons remplacés, banque remplacée. Jamais de suppression de version ; jamais les séances ni les attestations.
export async function applyImport(db, plan, now, entry) {
  const statements = [];
  for (const t of plan.tables_ajoutees) statements.push(db.prepare('INSERT INTO tables_reference (id, materiaux, operations, creee_le) VALUES (?, ?, ?, ?)').bind(t.id, JSON.stringify(t.materiaux), JSON.stringify(t.operations), t.creee_le ?? now));
  statements.push(db.prepare('DELETE FROM banque_outils'));
  plan.banque.forEach((b, i) => statements.push(db.prepare('INSERT INTO banque_outils (id, outil, rang, modifie_le, archive_le) VALUES (?, ?, ?, ?, ?)').bind(b.id, JSON.stringify(b.outil), b.rang ?? i + 1, now, b.archive_le ?? null)));
  // Un exercice ajouté prend le dernier rang, dans l'ordre de l'export ; un exercice remplacé garde le sien (l'ordre est celui de la base).
  for (const e of plan.exercices_ajoutes) statements.push(db.prepare('INSERT INTO exercices (id, brouillon, brouillon_modifie_le, publie_le, archive_le, cree_le, rang) SELECT ?, ?, ?, ?, ?, ?, COALESCE(MAX(rang), 0) + 1 FROM exercices').bind(e.id, JSON.stringify(e.brouillon), now, e.publie_le ?? null, e.archive_le ?? null, e.cree_le ?? now));
  for (const e of plan.exercices_remplaces) statements.push(db.prepare('UPDATE exercices SET brouillon = ?, revision = revision + 1, brouillon_modifie_le = ?, archive_le = ? WHERE id = ?').bind(JSON.stringify(e.brouillon), now, e.archive_le ?? null, e.id));
  for (const v of plan.versions_ajoutees) {
    statements.push(db.prepare('INSERT INTO versions_exercice (exercice_id, numero, contenu, tables_id, publiee_le) VALUES (?, ?, ?, ?, ?)').bind(v.exercice_id, v.numero, JSON.stringify(v.contenu), v.tables_id, v.publiee_le ?? now));
    statements.push(db.prepare('UPDATE exercices SET publie_le = MAX(COALESCE(publie_le, ?), ?) WHERE id = ?').bind(v.publiee_le ?? now, v.publiee_le ?? now, v.exercice_id));
  }
  // Les fiches d'images (nom, état d'archivage) : le contenu, lui, a voyagé à part (D59) et ne change jamais.
  for (const i of plan.images_modifiees ?? []) statements.push(db.prepare('UPDATE images SET nom = ?, archivee_le = ? WHERE id = ?').bind(i.nom, i.archivee_le, i.id));
  statements.push(teacherLogStatement(db, entry));
  await db.batch(statements);
}
