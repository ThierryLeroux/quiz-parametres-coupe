Attribute VB_Name = "modRapport"
Option Explicit

Public collListOutilOp As Collection
Public rwtop As Long
Public cltop As Long


'Remise à zéro du rapport
Sub zeroRapport()

    shRapport.Unprotect pwd
    
    Dim ws As Worksheet
    Set ws = shRapport
    
    'Effacer prénom, nom, matricule, Numéro et Code Moodle
    ws.Range("C7").Value = vbNullString
    ws.Range("C8").Value = vbNullString
    ws.Range("C9").Value = vbNullString
    ws.Range("C5").Value = vbNullString
    ws.Range("H5").Value = vbNullString
    
    'Effacer version quiz
    ws.Range("C4").Value = vbNullString
    
    'Effacer la date de début de l'exercice
    ws.Range("H7").Value = vbNullString
    'Effacer la date de réussite de l'exercice
    ws.Range("H8").Value = vbNullString
    
    'Effacer le nombre de bonnes réponses
    ws.Range("H9").Value = vbNullString
    
    'Effacer le code QR
    Call DeleteSpecificOLEObject(ws, "QRCode1")
    
    'Adresse de la cellule en haut à gauche de la liste
    rwtop = 20
    cltop = 1
    
    Dim rgTopLeft As Range
    Set rgTopLeft = ws.Cells(rwtop, cltop)
    
    'Déterminer le numéro de la dernière ligne de contenu dans la liste du rapport
    Dim lwRwEnd As Long
    
    'lwRwEnd = rgTopLeft.CurrentRegion.Rows.Count - 1 + rwtop
    lwRwEnd = ws.Cells.Columns(1).Find(What:="*", _
                                        After:=Range("A1"), _
                                        LookAt:=xlPart, _
                                        LookIn:=xlFormulas, _
                                        SearchOrder:=xlByColumns, _
                                        SearchDirection:=xlPrevious, _
                                        MatchCase:=False).Row
        
        'Assurer que rwtop est plus haut que lwRwEnd
        If lwRwEnd < rwtop Then lwRwEnd = rwtop
        
    'Effacer toutes les lignes du rapport
    ws.Range(ws.Cells(rwtop, cltop), ws.Cells(lwRwEnd, cltop)).EntireRow.Delete
    
    'Mise en forme des titres de colonnes si mode vitesse de coupe seulement ou paramètres de coupe complet
    '15921906
    Dim rgColTitre As Range
    Set rgColTitre = Union(shRapport.Range("H13"), shRapport.Range("J13"), shRapport.Range("L13"))

    If shOutil.OLEObjects("CheckBox2").Object.Value = True Then
        rgColTitre.Font.Color = rgColTitre.Interior.Color
    Else
        rgColTitre.Font.Color = 1
    End If

    
    
End Sub


'Insertion des identifiants étudiants dans le rapport
Public Sub insIdEtudiantRap(ByVal oEtudiantTemp As clsEtudiant)

    'Insertion des identifiants étudiants dans le rapport
    With shRapport
        .Range("C7").NumberFormat = "@"
        .Range("C7").Value = oEtudiantTemp.Prenom

        .Range("C8").NumberFormat = "@"
        .Range("C8").Value = oEtudiantTemp.Nom

        .Range("C9").NumberFormat = "@"
        .Range("C9").Value = oEtudiantTemp.Matricule

        .Range("C5").NumberFormat = "@"
        .Range("C5").Value = oEtudiantTemp.NumMoodle

        .Range("H5").NumberFormat = "@"
        .Range("H5").Value = oEtudiantTemp.CodeMoodle

    End With

    Set oEtudiantTemp = New clsEtudiant

End Sub


'Inscrire la date de début du quiz au rapport
Public Sub dateDebutRapport()

    With shRapport.Range("H7")
    .Value = Now
    .NumberFormat = "yyyy/mm/dd"
    End With
    
End Sub


'Inscrire la date de réussite du quiz au rapport
Public Sub dateReussiteRapport()

    With shRapport.Range("H8")
    .Value = Now
    .NumberFormat = "yyyy/mm/dd"
    End With
    
End Sub


'Inscrire la version du quiz au rapport
Public Sub versionRapport()
    
    Dim ver As String
    
    ver = shOutil.TextBox1.Value
    shRapport.Range("C4").Value = "'" & ver

End Sub



Public Sub ListOp()
    Dim nbOutilTotal As Long
    Dim nbCol As Long
    Dim lastCol As Long
    Dim rgTypeOp As Range
    Dim rgSucces As Range
    Dim i As Long
    Dim op As String
    Dim singleOp As String
    Dim collshAvance As Collection
    Dim tbl As ListObject
    Dim rng As Range
    Dim collTemp As Collection
    Dim countOp As Long
    Dim j As Long

    ' Find the last column with data in the sheet
    lastCol = shOutil.Cells(1, shOutil.Columns.Count).End(xlToLeft).Column

    ' Loop through each column to check if there is any data
    nbCol = 0
    For i = 1 To lastCol
        If Application.WorksheetFunction.CountA(shOutil.Columns(i)) > 0 Then
            nbCol = nbCol + 1
        End If
    Next i

    ' Set the ranges based on the number of columns with data
    With shOutil
        Set rgTypeOp = .Range(.Cells(6, 1), .Cells(6, nbCol))
        Set rgSucces = .Range(.Cells(3, 1), .Cells(3, nbCol))
    End With

    Set collListOutilOp = New Collection
    For i = 1 To nbCol
        If rgSucces(i).Value > 0 Then
            op = rgTypeOp(i).Value
            If IsInCollection(collListOutilOp, op) = False Then
                collListOutilOp.Add op
            End If
        End If
    Next i

    Set tbl = shAvance.ListObjects("tblAvance")
    Set rng = tbl.ListColumns(1).DataBodyRange
    Set collshAvance = ReadRangeRowsToCollection(rng)

    Set collTemp = New Collection
    countOp = collshAvance.Count

    For j = 1 To countOp
        singleOp = collshAvance.Item(j)
        If IsInCollection(collListOutilOp, singleOp) = True Then
            collTemp.Add (singleOp)
        End If
    Next j

    Set collListOutilOp = collTemp
End Sub


'Insertion au rapport des types d'opérations
Public Sub insertTypeOp()

        'Adresse de la cellule en haut à gauche de la liste
    rwtop = 20
    cltop = 1
    
    'Insérer les type d'opération à partir de la ligne rwtop cltop
    Dim i As Long
    Dim c As Range
    
    For i = 1 To collListOutilOp.Count
        
        With shRapport
        
            Set c = shRapport.Cells(rwtop + i - 1, cltop)
            c.Value = collListOutilOp.Item(i)
                    
            'Mise en forme du nom de type d'opération
            Set c = .Range(.Cells(rwtop + i - 1, cltop), .Cells(rwtop + i - 1, cltop + 11))
            c.Font.Bold = True
            c.Font.Size = 10
            .Rows(rwtop + i - 1).RowHeight = 20
            
        End With

        With c.Borders(xlEdgeBottom)
            .LineStyle = xlContinuous
            .ColorIndex = 0
            .TintAndShade = 0
            .Weight = xlThin
        End With
    

    Next
End Sub


'Ajouter une réponse au rapport
Public Sub AjoutReponse(ByVal oQROperation As clsQROperation)
    
    Dim ws As Worksheet
    Set ws = shRapport
    
    'Adresse de la cellule en haut à gauche de la liste
    rwtop = 20
    cltop = 1
    
    Dim rgTopLeft As Range
    Set rgTopLeft = ws.Cells(rwtop, cltop)
    
    'Déterminer le numéro de la dernière ligne de contenu dans la liste du rapport
    Dim lRwEnd As Long
    lRwEnd = ws.Cells.Columns(1).Find(What:="*", _
                                        After:=Range("A1"), _
                                        LookAt:=xlPart, _
                                        LookIn:=xlFormulas, _
                                        SearchOrder:=xlByColumns, _
                                        SearchDirection:=xlPrevious, _
                                        MatchCase:=False).Row
    
    'Créer un range de la premiere colonne de la liste de oQROperation
    Dim rgListOp As Range
    Set rgListOp = ws.Range(ws.Cells(rgTopLeft.Row, rgTopLeft.Column), ws.Cells(lRwEnd, rgTopLeft.Column))

    'Trouver la ligne au dessous de laquelle insérer les deux lignes de l'objet oQROperation
    Dim nocol As Long
    nocol = shQuiz.Label6.Caption 'Référence du no de colonne de l'outil
    Dim operation As String
    operation = shOutil.Cells(6, nocol).text 'Trouver l'opération que fait l'outil
    
        'Trouver la ligne où apparaît le nom de l'opération
    Dim rang As Long
    rang = rgListOp.Find(What:=operation, _
                           After:=rgListOp.Cells(rgListOp.Cells.Count), _
                           LookIn:=xlValues, _
                           LookAt:=xlPart, _
                           SearchOrder:=xlByColumns, _
                           SearchDirection:=xlNext, _
                           MatchCase:=False, _
                           SearchFormat:=False).Row
    
        'Ajouter le QROperation sous le titre du type d'opération
    Dim rgCoinHG As Range
    Set rgCoinHG = ws.Cells(rang, 1)
    
    Call oQROperation.InsOpRapport(rgCoinHG)
    
End Sub

'Procédure de retrait d'une ou d'un groupe de réponse
Sub retraitQR(ByVal nocol As Long)

    
    Dim ws As Worksheet
    Set ws = shRapport
    
    'Adresse de la cellule en haut à gauche de la liste
    rwtop = 20
    cltop = 1
    
    Dim rgTopLeft As Range
    Set rgTopLeft = ws.Cells(rwtop, cltop)
    
    'Déterminer le numéro de la dernière ligne de contenu dans la liste du rapport
    Dim lRwEnd As Long
    lRwEnd = ws.Cells.Columns(1).Find(What:="*", _
                                        After:=Range("A1"), _
                                        LookAt:=xlPart, _
                                        LookIn:=xlFormulas, _
                                        SearchOrder:=xlByColumns, _
                                        SearchDirection:=xlPrevious, _
                                        MatchCase:=False).Row
    
    'Créer un range sur la colonne NoCol (titre vide) de la liste de oQROperation
    Dim rgListOp As Range
    Set rgListOp = ws.Range(ws.Cells(rgTopLeft.Row, rgTopLeft.Column + 8), ws.Cells(lRwEnd, rgTopLeft.Column + 8))

    'Passer les lignes du range et effacer celles ayant le NoCol ou le Nom d'outil du call
    Dim i As Long
    Dim rwHaut As Long
    Dim rwBas As Long
    Dim rgEffQR As Range
    
    Dim strNomOutil As String
    strNomOutil = shOutil.Cells(1, nocol).text 'Nom de l'outil à effacer selon le call
    
    Dim strNomOutilList As String
    
    For i = 1 To rgListOp.Rows.Count
        
        'Rechercher le nom de l'outil d'après la feuille outil
        If Not rgListOp.Cells(i, 1) = "" Then
            strNomOutilList = shOutil.Cells(1, rgListOp.Cells(i, 1).Value).text
            Else
            strNomOutilList = vbNullString
        End If



        If rgListOp.Cells(i, 1) = nocol Or strNomOutilList = strNomOutil Then  'Condition pour effacer une opération
            
            'Deux lignes QR
            rwHaut = rgListOp.Cells(i - 1, 1).Row
            rwBas = rgListOp.Cells(i, 1).Row
            
            'Effacer les deux lignes QR
            ws.Range(ws.Cells(rwHaut, 1), ws.Cells(rwBas, 1)).EntireRow.Delete
            
            i = i - 2 'Recul de deux ligne en arrière
            
            'Remettre la bordure au bas du titre d'opération
            With ws.Range(ws.Cells(rwtop - 1 + i, cltop), ws.Cells(rwtop - 1 + i, cltop + 11)).Borders(xlEdgeBottom)
                .LineStyle = xlContinuous
                .ColorIndex = 0
                .TintAndShade = 0
                .Weight = xlThin
            End With
            
        End If
    Next
    
End Sub


''Procedure d'insertion de codeQR
'Sub qrCode()
'
''On Error Resume Next
'
'    Dim ws As Worksheet
'    Set ws = shRapport
'    Dim rgQR As Range
'    Set rgQR = ws.Range("K6")
'    Dim rgVersion As Range
'    Set rgVersion = ws.Range("C4")
'
'    'Recréer l'objet étudiant d'après le rapport
'    Dim oEtudiant As New clsEtudiant
'
'    'Assembler le texte à coder
'    Dim QRtxt As String
'    With oEtudiant
'        QRtxt = rgVersion.Value & " " & _
'        .Matricule & " " & .Prenom & " " & .Nom & _
'        " " & .Debutquiz & " au " & .Reussitequiz & _
'        " (" & .cumulRep & " reponses)" & " " & _
'        .NumMoodle & " " & .CodeMoodle
'    End With
'
'    'Corriger le texte à coder s'il contient des caractères spéciaux et créer un invite à URL data
'    QRtxt = GenerateQRCodeDataURL(QRtxt)
'
'    'Créer le code QR
'    Call GenerateAndPositionQRCode(QRtxt, "QRCode1", rgQR)
'
'End Sub

Sub CopyAndCleanURL(URL As String)
    Dim CleanedURL As String

'    ' Remove the quotation marks from the beginning and end
'    CleanedURL = Mid(URL, 2, Len(URL) - 2)

    ' Copy the cleaned URL to clipboard (For Excel 2010 and later)
    Dim DataObj As New MSForms.DataObject
    'DataObj.SetText CleanedURL
    DataObj.SetText URL
    DataObj.PutInClipboard

End Sub


'Function to URL-encode the text
Function URLEncode(text As String) As String
    Dim i As Integer
    Dim char As String
    Dim encodedText As String
    encodedText = ""
    For i = 1 To Len(text)
        char = Mid(text, i, 1)
        Select Case Asc(char)
            Case 48 To 57, 65 To 90, 97 To 122 ' 0-9, A-Z, a-z
                encodedText = encodedText & char
            Case Else
                encodedText = encodedText & "%" & Hex(Asc(char))
        End Select
    Next i
    URLEncode = encodedText
    
    Debug.Print "URL-encoded text:"
    Debug.Print encodedText
    
End Function

'Procedure d'insertion de codeQR
Sub qrCode()

    'On Error Resume Next
    
    Dim ws As Worksheet
    Set ws = shRapport
    Dim rgQR As Range
    Set rgQR = ws.Range("K6")
'    Dim rgVersion As Range
'    Set rgVersion = ws.Range("C4")
    
    'Recréer l'objet étudiant d'après le rapport
    Dim oEtudiant As New clsEtudiant
    
    'Assembler le texte à coder
    Dim QRtxt As String
    With oEtudiant
        QRtxt = URLEncode(.QuizVersion) & ";" & _
                URLEncode(.NumMoodle) & ";" & _
                URLEncode(.CodeMoodle) & ";" & _
                URLEncode(.Prenom) & ";" & _
                URLEncode(.Debutquiz) & ";" & _
                URLEncode(.Nom) & ";" & _
                URLEncode(.Reussitequiz) & ";" & _
                URLEncode(.Matricule) & ";" & _
                URLEncode(.cumulRep)
    End With
        
    Debug.Print "Plain string:"
    Debug.Print QRtxt
    
    'Encrypt the text
    Dim QRtxtCrypt As String
    QRtxtCrypt = EncryptString(QRtxt)
    
    'Create the URL with the encrypted text as a query parameter
    Dim URL As String
    URL = "https://thierryleroux.github.io/tgm-fab/?data=" & QRtxtCrypt
    
    'Generate the QR code with the URL
    Call GenerateAndPositionQRCode(URL, "QRCode1", rgQR)
        
    Call CopyAndCleanURL(URL) 'Copier coller dans le presse papier l'adresse URL
    
End Sub




