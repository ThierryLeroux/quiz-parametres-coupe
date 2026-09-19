Attribute VB_Name = "ThisWorkbook"
Attribute VB_Base = "0{00020819-0000-0000-C000-000000000046}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = True
Option Explicit


Private Sub Workbook_Open()

    OptiMode True

'    Dim coll As Collection
'    Set coll = collNoColValide()
'    Dim collCount As Long
'    collCount = coll.Count
    
    'Gestion de la feuille Rapport
    '*****************************
    If Not verifQuizReussi() = True Then
'    If Not collCount = 0 Then
    
        'Cacher la feuille rapport si quiz en cours
        'shRapport.Visible = xlSheetVeryHidden
        
        'S'assurer que la feuille rapport est déverouiller si quiz en cours
        shRapport.Unprotect pwd
    
    Else
        
        'Si le quiz est complété, afficher le rapport et le verrouiller
        ThisWorkbook.Unprotect pwd
        shRapport.Visible = xlSheetVisible
        ThisWorkbook.Protect pwd
        shRapport.Protect pwd
    
    End If

    'Gestion de la réponse non complétée (ou non vérifiée)
    '*****************************************************
    Dim etatQuiz As Long
'    etatN = shQuiz.CommandButton2.Enabled 'État du bouton "Nouvelle question"
    etatQuiz = shQuiz.Label21.Caption 'État du bouton "Nouvelle question"

'    Dim etatV As Boolean
'    etatV = shQuiz.CommandButton3.Enabled 'État du bouton "Vérifier les réponses"


    'Vérification si la collection de no valides n'est pas vide et etat boutons
'    If Not verifQuizReussi() = True And etatN = False And etatV = True Then
    If Not verifQuizReussi() = True And etatQuiz = 40 Then
    
    
        'Mettre la valeur 0 dans les textbox réponses étudiant
        Dim i As Long
        With shQuiz
            For i = 1 To 5
                .OLEObjects("TextBox" & i).Object.Value = 0
            Next i
        End With
        
        'Mettre la valeur 1 dans les textbox correction
        Dim j As Long
        With shQuiz
            For j = 6 To 10
                .OLEObjects("TextBox" & j).Object.Value = 1
            Next j
        End With
        
        'Corriger les textbox réponses, tous faux
'        Call shQuiz.CommandButton3_Click
        shQuiz.Unprotect pwd 'Déverouiller pour changer l'apparence du control Bouton
        shQuiz.Label21.Caption = 40
        modAffControlBouton.ControlButton (40)
        Call TextBox101A_Click
        shQuiz.Protect pwd
        Dim k As Long
        
       'Ajuster la largeur des textbox
        With shQuiz
            For k = 6 To 10
                    .OLEObjects("TextBox" & k).Width = 6
            Next k
        End With

    End If

    
    'Gestion de l'apparence à l'ouverture
    '************************************
    OptiMode False
    
'    Dim zoomSetting As Long

    Application.ScreenUpdating = False
    
    'Feuille vitesse
    shVitesse.Activate
'    shVitesse.Range("A1:J51").Select
'    ActiveWindow.Zoom = True
'    zoomSetting = ActiveWindow.Zoom
    ActiveWindow.Zoom = 100

    'Feuille avance
    shAvance.Activate
    shAvance.Unprotect pwd
'    ActiveWindow.Zoom = zoomSetting
    ActiveWindow.Zoom = 100
    shAvance.Protect pwd
    
    'Feuille Quiz
    shQuiz.Activate
    ActiveWindow.Zoom = 100
'    ActiveWindow.Zoom = zoomSetting * 1.25


    'Feuille Outil
    ThisWorkbook.Unprotect pwd
    shOutil.Visible = xlSheetHidden
    ThisWorkbook.Protect pwd
   
    'Feuille vitesse
    If verifQuizReussi() = True Then shRapport.Activate

   Application.ScreenUpdating = True

End Sub
