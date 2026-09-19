Attribute VB_Name = "modAffControlBouton"
Option Explicit

'******************************************************************
'Gestion du bouton de contrôle
'******************************************************************
'État du quiz

'10 - Édition de la liste d'outil
'20 - Initialisé
'30 - En quiz, aucune question posée
'40 - En quiz, question posée
'50 - En quiz, question corrigée
'60 - Quiz complété
'70 - Rapport généré

'Action suivant l'évènement click
Sub TextBox101A_Click()

    'Assure que le zoom est à 100% pour éviter les glitch de copy/paste/delete image outil
    shQuiz.Application.ActiveWindow.Zoom = 100
    ActiveWindow.ScrollRow = 1
    ActiveWindow.ScrollColumn = 1
    DoEvents

Dim etatQuiz As Long
    etatQuiz = shQuiz.Label21.Caption

    Select Case etatQuiz 'Liste des actions
        
        Case 10 '10 - Édition de la liste d'outil

        
        Case 20 '20 - Initialisé

        
        Case 30 '30 - En quiz, aucune question posée
                
            OptiMode True
            shQuiz.Unprotect pwd
            
            'État du quiz
            shQuiz.Label21.Caption = 40
            modAffControlBouton.ControlButton (40)
                
            'Mettre à jour le graphique de progression
            Call affGraph
        
            'Vérifier si le quiz est complété et diriger selon
            If verifQuizReussi() = True Then
'                ReussiQuiz.Show
            Else
                'Appeler la sub de contrôle d'affichage du quiz
                Call affNouvQuestion
            
                'Appeler la sub de création de question
                Call GenNouvQuestion
            End If
            
            OptiMode False
            shQuiz.Protect pwd
            
            shQuiz.OLEObjects("Textbox1").Activate


        Case 40 '40 - En quiz, question posée

            OptiMode True
            shQuiz.Unprotect pwd
                
            'Appeler la sub de vérif de format de contenu des textbox
            Call valNumTextBox
            
            'Faire la correction
            Call verifReponses
            
            'État du quiz
            shQuiz.Label21.Caption = 50
            modAffControlBouton.ControlButton (50)
                
            'Appeler la sub de contrôle d'affichage du quiz
            Call affVerifReponse
            
            'Mettre à jour le graphique de progression
            'OptiMode False
            Call affGraph
            
        '    OptiMode False
        '    shQuiz.Protect pwd
                
            'Vérifier si le quiz est complété
            If verifQuizReussi() = True Then
                    
                'État du quiz
                shQuiz.Label21.Caption = 60
                modAffControlBouton.ControlButton (60)
        
                'Inscrire la date de réussite du quiz
                Call dateReussiteRapport
        
'                'Ouvrir la form de réussite de quiz
'                ReussiQuiz.Show
            End If
               
            OptiMode False
            shQuiz.Protect pwd

        
        Case 50 '50 - En quiz, question corrigée
            
            OptiMode True
            shQuiz.Unprotect pwd
            
            'État du quiz
            shQuiz.Label21.Caption = 40
            modAffControlBouton.ControlButton (40)
                
            'Mettre à jour le graphique de progression
            Call affGraph
        
            'Vérifier si le quiz est complété et diriger selon
            If verifQuizReussi() = True Then
'                ReussiQuiz.Show
            Else
                'Appeler la sub de contrôle d'affichage du quiz
                Call affNouvQuestion
            
                'Appeler la sub de création de question
                Call GenNouvQuestion
            End If
            
            OptiMode False
            shQuiz.Protect pwd
            
            shQuiz.OLEObjects("Textbox1").Activate

        
        Case 60 '60 - Quiz complété

            OptiMode True
            shQuiz.Unprotect pwd
        
            'État quiz
            shQuiz.Label21.Caption = 70
            modAffControlBouton.ControlButton (70)
        
            shQuiz.Protect pwd
        
            'Déverouiller la feuille Rapport
            shRapport.Unprotect pwd
            
            'Écrire le code de réussite sur la feuille rapport
            Dim codeM As Double
        '    codeM = calcCodeM(shOutil.TextBox2.Value)
            If shOutil.TextBox2.Value <> "" Then
                codeM = calcCodeM(shOutil.TextBox2.Value)
            Else
                codeM = 0
            End If
        
            
            If codeM = 0 Then
                shRapport.Range("H5").Value = vbNullString
            Else
                shRapport.Range("H5").Value = codeM
            End If
            
            'Effacer le dernier code QR s'il y a lieu
            Call DeleteSpecificOLEObject(shRapport, "QRCode1")
        
            'Générer code QR
            modRapport.qrCode
            
            'Montre la feuille Rapport
            ThisWorkbook.Unprotect pwd
            shRapport.Visible = xlSheetVisible
            ThisWorkbook.Protect pwd
            
            OptiMode False

            'Active la feuille Rapport
            shRapport.Activate
            
            'Mettre le focus sur autre chose que le codeQR
            shRapport.Range("A1").Select
            
            'Protéger la feuille Rapport
            shRapport.Protect pwd
            
            
        Case 70 '70 - Rapport généré
        
            ThisWorkbook.Unprotect pwd
            shRapport.Visible = xlSheetVisible
            ThisWorkbook.Protect pwd
            shRapport.Activate
        
        Case Else
        
    End Select

End Sub


'Exécute l'affichage du ControlBouton
Public Sub ControlButton(ByVal etatQuiz As Long)


'Dim etatQuiz As Long 'Pour test
'etatQuiz = 3

Dim cadre As Shape
Dim trapezeA As Shape
Dim trapezeB As Shape
Dim trapezeC As Shape
Dim txtb As Shape

    Set cadre = shQuiz.Shapes("Cadre 101")
    Set trapezeA = shQuiz.Shapes("Trapezoid 102")
    Set trapezeB = shQuiz.Shapes("Trapezoid 103")
    Set trapezeC = shQuiz.Shapes("Trapezoid 104")
    Set txtb = shQuiz.Shapes("TextBox 101A")

Dim coulVert As Long
Dim coulOrange As Long
Dim coulBleu As Long
Dim coulJaune As Long

    coulVert = RGB(0, 176, 80)
    coulOrange = RGB(255, 192, 0)
    coulBleu = RGB(0, 112, 192)
    coulJaune = RGB(255, 255, 0)

Dim msg As String
Dim coul As Long
Dim coulTxt As Long

    Select Case etatQuiz
        
        Case 10 '10 - Édition de la liste d'outil
        coulTxt = coulBleu
        coul = coulBleu
        msg = vbNullString

        Case 20 '20 - Initialisé
        coulTxt = coulBleu
        coul = coulBleu
        msg = vbNullString
        
        Case 30 '30 - En quiz, aucune question posée
        coulTxt = coulVert
        coul = coulVert
        msg = "Générer" & vbCrLf & "une question"
        
        Case 40 '40 - En quiz, question posée
        coulTxt = coulOrange
        coul = coulOrange
        msg = "Corriger" & vbCrLf & "les paramètres"
        
        Case 50 '50 - En quiz, question corrigée
        coulTxt = coulVert
        coul = coulVert
        msg = "Générer" & vbCrLf & "une question"
        
        Case 60 '60 - Quiz complété
        coulTxt = coulJaune
        coul = coulBleu
        msg = "Générer le rapport de réussite du quiz"

        Case 70 '70 - Rapport généré
        coulTxt = coulJaune
        coul = coulBleu
        msg = "Afficher le rapport de réussite du quiz"
        
        Case Else
        coulTxt = coulBleu
        coul = coulBleu
        msg = vbNullString

    End Select
    
'Cadre externe
    With cadre.Fill
        .Visible = msoTrue
        .GradientStops.Item(1).Color.Brightness = 1
        .GradientStops.Item(1).Color.RGB = coul
        .GradientStops.Item(1).Position = 0
        .GradientStops.Item(1).Transparency = 0
        .GradientAngle = 270
        .GradientStops.Item(1).Color.TintAndShade = -0.95
    End With
    With cadre.Line
        .Visible = msoTrue
        .ForeColor.RGB = coul
        .Transparency = 0.4
    End With

'Trapèzes, remplissage et ligne (3)
    'A
    With trapezeA.Fill
        .Visible = msoTrue
        .ForeColor.RGB = coul
        .Transparency = 0.5
        .Solid
    End With
    With trapezeA.Line
        .Visible = msoTrue
        .ForeColor.RGB = coul
        .Transparency = 0.4
    End With
    'B
    With trapezeB.Fill
        .Visible = msoTrue
        .ForeColor.RGB = coul
        .Transparency = 0.5
        .Solid
    End With
    With trapezeB.Line
        .Visible = msoTrue
        .ForeColor.RGB = coul
        .Transparency = 0.4
    End With
    'C
    With trapezeC.Fill
        .Visible = msoTrue
        .ForeColor.RGB = coul
        .Transparency = 0.5
        .Solid
    End With
    With trapezeC.Line
        .Visible = msoTrue
        .ForeColor.RGB = coul
        .Transparency = 0.4
    End With

'Couleur de texte
    With txtb.TextFrame2.TextRange.Font.Fill
        .Visible = msoTrue
        .ForeColor.RGB = coulTxt
        .Transparency = 0
        .Solid
    End With

'Texte
    With txtb
        .TextFrame2.TextRange.Characters.text = msg
    End With
        
        
End Sub


'Validation du format numérique des réponses étudiant
Private Sub valNumTextBox()
    
    Dim i As Long
    Dim tb As Object
    
    For i = 1 To 5
        
        Set tb = shQuiz.OLEObjects("Textbox" & i).Object
        
        'Si textbox est vide, inscrire la valeur 0
        If tb.text = vbNullString Then
            tb.Value = 0
        End If
    
        'Vérifier si les données écrites sont numériques
        If Not IsNumeric(ConvertToNumber(tb.text)) Then
            GoTo EarlyExit
        End If
    
        'Remplacer par le bon séparateur de décimal
        tb.Value = Format(ConvertToNumber(tb.text), "General number")
    
    Next i


Exit Sub 'Sortie normale

    'Message d'erreur de données numériques seulement
EarlyExit:
    MsgBox "Les réponses doivent contenir des caractères numériques seulement.", vbInformation + vbOKOnly, "Type de données"
    shQuiz.OLEObjects("TextBox" & i).Activate
    End
    
End Sub

