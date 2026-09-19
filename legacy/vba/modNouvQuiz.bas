Attribute VB_Name = "modNouvQuiz"

Option Explicit


'Débuter le quiz
Sub startNewQuiz(ByVal oEtudiant As clsEtudiant)

    
    shRapport.Unprotect pwd 'Permettre l'écriture sur la feuille rapport
        
    ThisWorkbook.Unprotect pwd
    shRapport.Visible = xlSheetVeryHidden 'Cacher le rapport
    ThisWorkbook.Protect pwd
    
    Call zeroRapport 'Remise à zéro du rapport (modRapport)
    
    Call dateDebutRapport 'Inscrire la date et l'heure de début du quiz sur le rapport
    
    Call versionRapport 'Inscrire la version de quiz sur le rapport
    
    Call versionQuiz 'Afficher la version de quiz sur le quiz
    
    shQuiz.Unprotect pwd 'Permettre l'écriture sur la feuille Quiz
    
    shOutil.Unprotect pwd 'Permettre l'écriture sur la feuille outil
    
    Call zeroQuiz 'Remise à zéro du questionnaire (AffQuiz)
    
    Call insIdEtudiantRap(oEtudiant) 'Inscrire les informations de l'étudiant sur le rapport
    
    Call insIdEtudiantQuiz(oEtudiant) 'Afficher les informations de l'étudiant sur le quiz
    
    Call ListOp 'Recenser de la feuille outil les opérations à questionner au quiz
    
    Call insertTypeOp 'Inscrire les opérations à questionner au rapport
    
    Call affVerifReponse 'Remettre l'affichage prêt pour répondre à la question
    
    Call affQuizMode 'Ajuster l'affichage du quiz selon qu'il est en mode vitesse de coupe seulement ou paramètres de coupe complets
    
    shQuiz.Protect pwd 'Verouiller le Quiz
    
    ThisWorkbook.Unprotect pwd
    shRapport.Visible = xlSheetVeryHidden 'Vraiment cacher la feuille Rapport
    ThisWorkbook.Protect pwd
    
    ThisWorkbook.Unprotect pwd
    shOutil.Visible = xlSheetHidden 'Cacher la feuille outil
    shOutil.Protect pwd 'Verouiller la feuille outil
    ThisWorkbook.Protect pwd
    
End Sub

