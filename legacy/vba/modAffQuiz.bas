Attribute VB_Name = "modAffQuiz"
Option Explicit


'Remet à zéro le quiz
Public Sub zeroQuiz()

    Dim ws As Worksheet
    Set ws = shQuiz
    
    'Vider les textboxs et labels
    Dim i As Long
    Dim j As Long
    Dim k As Long
    Dim m As Long
    
    With ws

        For i = 1 To 13
            .OLEObjects("Label" & i).Object.Caption = vbNullString
        Next i
        
        For j = 17 To 19
            .OLEObjects("Label" & j).Object.Caption = vbNullString
        Next j
                
        For k = 1 To 5
            .OLEObjects("TextBox" & k).Object.Value = 0
            .OLEObjects("TextBox" & k).Object.BackColor = RGB(255, 255, 255)
        Next k
        
        For m = 6 To 10
            .OLEObjects("TextBox" & m).Object.Value = 0
            .OLEObjects("TextBox" & m).Visible = False
        Next m
        
    End With

    'Effacer l'image outil
    Dim Sh As Shape
            
    For Each Sh In ws.Shapes
        If Sh.TopLeftCell.Address = ws.Range("C6").Address Then Sh.Delete
    Next

    'Mettre la couleur matériau blanc
            'Lettre ISO
        ws.OLEObjects("Label7").Object.BackColor = RGB(90, 90, 90)
        
            'Numéro VDI
        ws.OLEObjects("Label8").Object.BackColor = RGB(90, 90, 90)


    'Mettre à jour le graphique de progression
    Call delChartDataFull 'Effacer toutes les données graphiques
    Call affGraph

End Sub


'Réinitialise complètement le quiz
Public Sub resetQuiz()
   
    Dim ws As Worksheet
    Set ws = shQuiz
    
    'Affiche le quiz selon le mode vitesse de coupe seulement ou paramètres de coupe complets
    Call affQuizMode
    
    'Vider les textboxs et labels
    Dim i As Long
    Dim k As Long
    Dim m As Long
    Dim n As Long
    
    With ws

        For i = 1 To 22
            .OLEObjects("Label" & i).Object.Caption = vbNullString
        Next i
        
        For k = 1 To 5
            .OLEObjects("TextBox" & k).Object.Value = 0
            .OLEObjects("TextBox" & k).Object.BackColor = RGB(255, 255, 255)
        Next k
        
        For m = 6 To 10
            .OLEObjects("TextBox" & m).Object.Value = 0
            .OLEObjects("TextBox" & m).Visible = False
        Next m
        
        For n = 11 To 16
            .OLEObjects("TextBox" & n).Visible = False
        Next n
        
    End With

    'Effacer l'image outil
    Dim Sh As Shape
            
    For Each Sh In ws.Shapes
        If Sh.TopLeftCell.Address = ws.Range("C6").Address Then Sh.Delete
    Next

    'Mettre la couleur matériau blanc
            'Lettre ISO
        ws.OLEObjects("Label7").Object.BackColor = RGB(90, 90, 90)
        
            'Numéro VDI
        ws.OLEObjects("Label8").Object.BackColor = RGB(90, 90, 90)

    'Effacer le rapport
    Call zeroRapport
    
    'Efface toutes les données graphiques
    Call delChartDataFull
    
End Sub
     

'Ajuster l'affichage du quiz selon qu'il est en mode vitesse de coupe seulement ou paramètres de coupe complets
Sub affQuizMode()

    Dim tb2 As OLEObject
    Dim tb4 As OLEObject
    Dim tb5 As OLEObject
    Dim tb7 As OLEObject
    Dim tb9 As OLEObject
    Dim tb10 As OLEObject
    Dim shp As Shape

    ' Set references to the textboxes and shape
    Set tb2 = shQuiz.OLEObjects("TextBox2")
    Set tb4 = shQuiz.OLEObjects("TextBox4")
    Set tb5 = shQuiz.OLEObjects("TextBox5")
    Set tb7 = shQuiz.OLEObjects("TextBox7")
    Set tb9 = shQuiz.OLEObjects("TextBox9")
    Set tb10 = shQuiz.OLEObjects("TextBox10")
    Set shp = shQuiz.Shapes("Freeform: Shape 9")

    ' Check if CheckBox2 is checked
    If shOutil.OLEObjects("CheckBox2").Object.Value = True Then
        ' Show the shape on shQuiz
        shp.Visible = msoTrue

        ' Make TextBox2, TextBox4, TextBox5, TextBox7, TextBox9, and TextBox10 invisible
        tb2.Visible = False
        tb4.Visible = False
        tb5.Visible = False
        tb7.Visible = False
        tb9.Visible = False
        tb10.Visible = False
    Else
        ' Hide the shape on shQuiz
        shp.Visible = msoFalse

        ' Make TextBox2, TextBox4, TextBox5, TextBox7, TextBox9, and TextBox10 visible
        tb2.Visible = True
        tb4.Visible = True
        tb5.Visible = True
        tb7.Visible = True
        tb9.Visible = True
        tb10.Visible = True
    End If

End Sub


'Insertion des identifiants étudiants dans le quiz
Public Sub insIdEtudiantQuiz(ByVal oEtudiantTemp As clsEtudiant)

    'Insertion des identifiants étudiants dans le quiz
    With shQuiz
          .Label14.Caption = oEtudiantTemp.Nom
          .Label15.Caption = oEtudiantTemp.Prenom
          .Label16.Caption = oEtudiantTemp.Matricule
          .Label22.Caption = oEtudiantTemp.NumMoodle
    End With

    Set oEtudiantTemp = New clsEtudiant

End Sub


'Affichage dans le quiz de la version
Public Sub versionQuiz()

    '***Inscrire le numéro de version de quiz au questionnaire
    Dim ver As String
    ver = shOutil.TextBox1.Value
    shQuiz.OLEObjects("Label20").Object.Caption = ver
    
End Sub


''Affiche dans le quiz les caractéristiques de l'outil
'Sub toQzOutil()
'
'    'Désignation de l'outil
'    shQuiz.Label1.Caption = oOutil.IdOutil
'
'    'Matériau coupant
'    shQuiz.Label2.Caption = oOutil.Matoutil
'    shQuiz.Label2.ForeColor = oOutil.Couleur
'
'    'Commentaires
'    shQuiz.Label3.Caption = "*** " & oOutil.Commentaires
'
'    'Vitesse maximale de broche
'    shQuiz.Label4.Caption = "Broche de machine-outil limitée à " & vbCrLf & Format(oOutil.LimitRpm, "# ###") & " révolutions / minute"
'
'    'Type d'opération d'usinage
'    shQuiz.Label5.Visible = True
'    shQuiz.Label5.Caption = "Opération d'usinage: " & LCase(oOutil.operation)
'
'    'Numéro de colonne de la feuille outil
'    shQuiz.Label6.Caption = oOutil.nocol
'    shQuiz.Label6.Visible = False
'
'    'Nombre de dents de l'outil
'    shQuiz.Label17.Caption = oOutil.NbDent
'    shQuiz.Label17.Visible = False
'
'    'Diamètre
'    shQuiz.Label18.Caption = oOutil.Dia
'    shQuiz.Label18.Visible = False
'
'    'Pas
'    shQuiz.Label19.Caption = oOutil.Pas
'    shQuiz.Label19.Visible = False
'
'    'On Error Resume Next
'
'    With oOutil
'
'        'Effacer l'image qui aurait l'adresse de cellule inscrite
'        Dim ws As Worksheet
'        Set ws = shQuiz
'
'        Dim Sh As Shape
'
'        For Each Sh In ws.Shapes
'            If Sh.TopLeftCell.Address = ws.Range("C6").Address Then Sh.Delete
'        Next
'
'        'Insérer l'image dans le questionnaire
'        On Error Resume Next 'L'opération .PasteSpecial plante régulièrement
'        Application.CutCopyMode = False
'        oOutil.ImageOutil.Copy
'        ws.Range("C6").PasteSpecial
'        Application.CutCopyMode = False
'
'        'Corriger le nom de l'image
'        GetShape(ws.Range("C6")).Name = "Picture 1"
'
'        'Attribuer une variable à l'objet image outil
'        Dim pic As Shape
'        Set pic = shQuiz.Shapes("Picture 1")
'
'        With pic
'
'        'Adapter la couleur glow à celle de la matière de l'outil
'            With .Glow
'                .Color = oOutil.Couleur
'                .Radius = 20
'                .Transparency = 0.75
'            End With
'
'        'Amener à l'avant plan l'image outil
'            .ZOrder msoBringForward
'
'        End With
'
'        'Mettre le focus sur autre chose que l'image outil
'        shQuiz.Range("A1").Select
'
'        'Mettre le curseur dans la première TextBox et sélectionner le contenu
'        shQuiz.TextBox1.Activate
'        With shQuiz.TextBox1
'            .SelStart = 0
'            .SelLength = Len(.text)
'        End With
'
'
'    End With
'
'End Sub

Sub toQzOutil()
    ' Désignation de l'outil
    shQuiz.Label1.Caption = oOutil.IdOutil
    
    ' Matériau coupant
    shQuiz.Label2.Caption = oOutil.Matoutil
    shQuiz.Label2.ForeColor = oOutil.Couleur
    
    ' Commentaires
    shQuiz.Label3.Caption = "*** " & oOutil.Commentaires
    
    ' Vitesse maximale de broche
    shQuiz.Label4.Caption = "Broche de machine-outil limitée à " & vbCrLf & Format(oOutil.LimitRpm, "# ###") & " révolutions / minute"
    
    ' Type d'opération d'usinage
    shQuiz.Label5.Visible = True
    shQuiz.Label5.Caption = "Opération d'usinage: " & LCase(oOutil.operation)
    
    ' Numéro de colonne de la feuille outil
    shQuiz.Label6.Caption = oOutil.nocol
    shQuiz.Label6.Visible = False

    ' Nombre de dents de l'outil
    shQuiz.Label17.Caption = oOutil.NbDent
    shQuiz.Label17.Visible = False

    ' Diamètre
    shQuiz.Label18.Caption = oOutil.Dia
    shQuiz.Label18.Visible = False
    
    ' Pas
    shQuiz.Label19.Caption = oOutil.Pas
    shQuiz.Label19.Visible = False
    
    On Error GoTo ErrorHandler
    
    With oOutil
        ' Effacer l'image qui aurait l'adresse de cellule inscrite
        Dim ws As Worksheet
        Set ws = shQuiz
        
        Dim Sh As Shape
        For Each Sh In ws.Shapes
            If Sh.TopLeftCell.Address = ws.Range("C6").Address Then Sh.Delete
        Next
        
        ' Insérer l'image dans le questionnaire
'        Application.ScreenUpdating = False
        oOutil.ImageOutil.Copy
        Application.Wait (Now + TimeValue("0:00:01"))
        ws.Range("C6").PasteSpecial
        Application.CutCopyMode = False
        
        ' Corriger le nom de l'image
        GetShape(ws.Range("C6")).Name = "Picture 1"
        
        ' Attribuer une variable à l'objet image outil
        Dim pic As Shape
        Set pic = shQuiz.Shapes("Picture 1")
        
        With pic
            ' Adapter la couleur glow à celle de la matière de l'outil
            With .Glow
                .Color = oOutil.Couleur
                .Radius = 20
                .Transparency = 0.75
            End With
            
            ' Amener à l'avant plan l'image outil
            .ZOrder msoBringForward
        End With
        
        ' Mettre le focus sur autre chose que l'image outil
        shQuiz.Range("A1").Select
        
        ' Mettre le curseur dans la première TextBox et sélectionner le contenu
        shQuiz.TextBox1.Activate
        With shQuiz.TextBox1
            .SelStart = 0
            .SelLength = Len(.text)
        End With
    End With
    
'    Application.ScreenUpdating = True
    Exit Sub
    
ErrorHandler:
    MsgBox "An error occurred: " & Err.Description
    Application.ScreenUpdating = True
End Sub



'Affiche dans le quiz les informations du matériau brut
Sub toQzMat()

    
    With oMateriau
        
        'Lettre ISO
        shQuiz.Label7.Caption = .ISO
        shQuiz.Label7.BackColor = .Couleur
        
        'Numéro VDI
        shQuiz.Label8.Caption = .VDI
        shQuiz.Label8.BackColor = .Couleur

        'Matériau usiné
        shQuiz.Label9.Caption = .MatUsi

        'Exemple de matériau
        shQuiz.Label10.Caption = .MatExemple
        
        'État métallurgique
        shQuiz.Label11.Caption = .EtatMetal
        
        'Composition chimique
        shQuiz.Label12.Caption = .Composition
        
        'Dureté
        shQuiz.Label13.Caption = .DureteHB
            
    End With

End Sub


'Affiche dans le quiz la correction de la réponse
Sub toQzReponse()

    With shQuiz
    
        'Arrondir les valeurs à afficher
        If verifFiletage(.Label6.Caption) Then
            .TextBox6.Value = Round(oParamCoupe.Vc, 0)
            .TextBox7.Value = Round(oParamCoupe.Avpdent, 5)
            .TextBox8.Value = Round(oParamCoupe.Rpm, 0)
            .TextBox9.Value = Round(oParamCoupe.Avptour, 5)
            .TextBox10.Value = Round(oParamCoupe.Avpmin, 2)
        Else
            .TextBox6.Value = Round(oParamCoupe.Vc, 0)
            .TextBox7.Value = Round(oParamCoupe.Avpdent, 4)
            .TextBox8.Value = Round(oParamCoupe.Rpm, 0)
            .TextBox9.Value = Round(oParamCoupe.Avptour, 4)
            .TextBox10.Value = Round(oParamCoupe.Avpmin, 2)
        End If
        
        'Corriger le format des textbox selon le bon séparateur de décimal et le bon format
        Dim i As Integer
        Dim tb As Object
        
        For i = 6 To 10
            Set tb = shQuiz.OLEObjects("Textbox" & i).Object
            tb.Value = Format(ConvertToNumber(tb.Value), "General number")
        Next i
        
    End With
        
End Sub


'Nouvelle question, contrôle des boutons et de l'affichage du quiz
Public Sub affNouvQuestion()
       
    With shQuiz
        
        .TextBox1.Activate
        
        'Cacher les textbox réponse
        Dim X As Integer
        For X = 6 To 10
            .OLEObjects("TextBox" & X).Visible = False
            .OLEObjects("TextBox" & X).Width = 6
        Next X
        
        'Remettre les textbox en blanc
        'Inscrire la valeur 0 dans les textbox
        Dim Y As Integer
        For Y = 1 To 5
            .OLEObjects("TextBox" & Y).Object.BackColor = vbWhite
            .OLEObjects("TextBox" & Y).Object.Value = 0
        Next Y
        
        'Mettre le focus sur autre chose que l'image outil
        '.Range("A1").Select 'Arbitraire.
        
        'Mettre le curseur dans la première TextBox
        .TextBox1.Activate
        
    End With

End Sub


'Afficher les textbox réponse
Sub affVerifReponse()
   
    With shQuiz
        
        'Afficher les textbox réponse
        Dim X As Integer
        For X = 6 To 10
            .OLEObjects("TextBox" & X).Visible = True
            .OLEObjects("TextBox" & X).Width = 60
        Next X
        
        Call affQuizMode
        
    End With

End Sub


'Inscrit les bonnes réponses dans les textbox réponses pour le mode VC seulement
Sub copieReponseVCseulement()
Dim textboxValue As String
Dim numberValue As Double

If shOutil.OLEObjects("CheckBox2").Object.Value = True Then
    With shQuiz
        .TextBox2.Value = Format(ConvertToNumber(.TextBox7.Value), "General Number")
        .TextBox4.Value = Format(ConvertToNumber(.TextBox9.Value), "General Number")
        .TextBox5.Value = Format(ConvertToNumber(.TextBox10.Value), "General Number")
    End With
End If

End Sub

