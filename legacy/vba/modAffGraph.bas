Attribute VB_Name = "modAffGraph"
Option Explicit

'******************************************************************
'Gestion du graphique de progression
'******************************************************************


'Graph - Sub contrôlant les appels de fonctions propres au graphique de progression
Sub affGraph()


    'Créer une collection avec la liste des NoCol du rapport actuel
    Dim collNoColRap As Collection
    Set collNoColRap = gencollNoColRap()

    'Convertir la collection en array et ajouter l'opération correspondante
    Dim arrRap As Variant
    arrRap = CollToArray(collNoColRap)

    'Création d'un array des opérations questionnées - array colonne 0
    Dim arrOp
    arrOp = arrNoColValide()
    
    'Faire la sommation des questions réussies par opération - array colonne 1
    arrOp = addNoColtoArray(arrRap, arrOp)
    
    'Faire la sommation des seuils - array colonne 2
    arrOp = addSeuilToArray(arrOp)
    
    'Calculer le pourcentage de progression - array colonne 3
    arrOp = evalPourcentage(arrOp)
    
    'Recopier les pourcentages d'avant (pour comparaison) à la colonne AG
    Call copyPourcent
    
    'Effacer les cellules vides de la plage de donnés du graphique
    Call delChartData
    
    'Inscrit les valeurs de l'arrOp dans la feuille quiz
    insertArray (arrOp)
    
    'Ajuster les couleurs pour la nouvelle progression
    Call Color_BarChart_Categories
    
End Sub

'Graph - Créer la collection de NoCol du rapport
Function gencollNoColRap() As Collection
   
 
    'Créer collection de NoCol complétés avec le rapport actuel
    '**********************************************************
    Dim ws As Worksheet
    Set ws = shRapport
    
   'Déterminer le numéro de la dernière ligne de contenu dans la liste du rapport
    Dim lRwEnd As Long
    lRwEnd = ws.Cells.Columns(1).Find(What:="*", _
                                        After:=Range("A1"), _
                                        LookAt:=xlPart, _
                                        LookIn:=xlFormulas, _
                                        SearchOrder:=xlByColumns, _
                                        SearchDirection:=xlPrevious, _
                                        MatchCase:=False).Row

    'Créer un range de la colonne de NoCol
    Dim rgListOp As Range
    Set rgListOp = ws.Range(ws.Cells(20, 9), ws.Cells(lRwEnd, 9))
    
    'Créer une collection sans ligne vide à partir du range
    Dim collNoColRap As Collection
    Set collNoColRap = New Collection
    Dim cell As Range
        
    For Each cell In rgListOp
        If Not cell.Value = "" Then collNoColRap.Add cell.Value
    Next
    
    Set gencollNoColRap = collNoColRap

End Function


'Graph - Fonction de convertir la collection en array et ajouter l'opération correspondante
Function CollToArray(coll As Collection) As Variant
 
   
    Dim arr As Variant
    Dim lgArr As Long
    
    lgArr = coll.Count

On Error Resume Next 'Dans le cas où la collection est vide

    ReDim arr(0 To lgArr - 1, 0 To 1) As Variant
    
    Dim i As Long
    Dim nocol As Long
    
    For i = LBound(arr) + 1 To UBound(arr) + 1
        
        If Not coll.Item(i) = "" Then
           nocol = coll.Item(i)
           arr(i - 1, 0) = coll.Item(i)
           arr(i - 1, 1) = shOutil.Cells(6, nocol).Value
        End If
    Next
    
    CollToArray = arr

End Function


'Graph - Fonction créant un array des opérations questionnées
Function arrNoColValide() As Variant
 
   
    'Numéro de la dernière colonne d'outil
    Dim lastCol As Long
    lastCol = shOutil.UsedRange.Columns.Count   'Compte le nombre de type d'outil
    
    'Collection des NoCol questionnés
    Dim coll As Collection
    Set coll = New Collection
    
    Dim nbTheor As Long
    Dim i As Long
    Dim sOperation As String
    
    For i = 1 To lastCol 'Pour tous les numéros de colonne outil
        
        nbTheor = shOutil.Cells(3, i).Value 'Nb de réussites consécutives prescrites
        sOperation = shOutil.Cells(6, i).Value 'Type d'opération de la colonne outil
        
        If nbTheor > 0 And Not IsInCollection(coll, sOperation) Then 'Si le seuil > 0 et sans doublons
            coll.Add sOperation 'Ajouter le nom de l'opération à la collection
        End If
    Next
    
    'Conversion de la collection en array
    Dim arr As Variant
    Dim j As Long
    
    On Error GoTo ErrorHandler
    
    ReDim arr(0 To coll.Count - 1, 0 To 3) As Variant
    
    On Error GoTo 0
    
    For j = LBound(arr) To UBound(arr)
        arr(j, 0) = coll.Item(j + 1)
    Next
    
    arrNoColValide = arr
Exit Function

ErrorHandler:
    MsgBox "Il semble qu`aucun outil n`ait au moins une réussite consécutive à atteindre dans le quiz à initialiser." & vbCrLf & _
    "" & vbCrLf & _
    "Ajouter au moins une réussite consécutive à au moins un outils.", vbExclamation
    End

End Function


'Graph - Fonction additionnant les questions (NoCol) réussies (+1) aux opérations
Function addNoColtoArray(arrActuel As Variant, arrOp As Variant) As Variant


    'Numéro de la dernière colonne d'outil
    Dim lastCol As Long
    lastCol = shOutil.UsedRange.Columns.Count   'Compte le nombre de type d'outil

    Dim sOperation As String
    Dim iArrPos As Long

    'Pour chaque item de l'array "actuel" provenant du rapport
    Dim i As Long
    
On Error Resume Next 'Quand l'array est vide

    For i = LBound(arrActuel) To UBound(arrActuel)
        
        sOperation = arrActuel(i, 1) 'Nom de l'opération d'usinage
        iArrPos = IsInArray(sOperation, arrOp) 'Position de l'opération
        'dans l'array des opérations questionnées
        
        If Not iArrPos = -1 Then 'Si l'op.actuel est dans op. questionnées
            arrOp(iArrPos, 1) = arrOp(iArrPos, 1) + 1 'Additionner 1 à la colonne suivante
        End If
    Next i
    
    addNoColtoArray = arrOp

End Function


'Graph - Fonction additionnant les seuils aux opérations
Function addSeuilToArray(arrOp As Variant) As Variant


    'Numéro de la dernière colonne d'outil
    Dim lastCol As Long
    lastCol = shOutil.UsedRange.Columns.Count   'Compte le nombre de type d'outil

    'Pour chaque item de l'array opérations questionnées
    Dim i As Long
    Dim j As Long
    Dim sOperation As String
    Dim iArrPos As Long
    
    For i = LBound(arrOp) To UBound(arrOp)
        
        sOperation = arrOp(i, 0) 'Nom de l'opération d'usinage de l'array des op. quest.
        iArrPos = IsInArray(sOperation, arrOp) 'Position de l'opération dans l'array
                                               'des opérations questionnées
        
'        If Not iArrPos = -1 Then 'Si l'opération actuel est dans opér. questionnées
            
            For j = 1 To lastCol
                
                If Not shOutil.Cells(3, j) = 0 And shOutil.Cells(6, j) = sOperation Then
                    arrOp(i, 2) = arrOp(i, 2) + shOutil.Cells(3, j)
                End If
            Next j
            'arrOp(iArrPos, 1) = arrOp(iArrPos, 1) + 1 'Additionner 1 à la colonne suivante
'        End If
    Next i

    addSeuilToArray = arrOp

End Function


'Graph - Fonction calculant le pourcentage
Function evalPourcentage(arrOp As Variant) As Variant


    Dim i As Long
    
    For i = LBound(arrOp) To UBound(arrOp)
        If Not arrOp(i, 2) = "" Then
            arrOp(i, 3) = arrOp(i, 1) / arrOp(i, 2)
        Else
            arrOp(i, 3) = 0
        End If
    Next i
    
    evalPourcentage = arrOp
    
End Function


'Graph - recopier les pourcentages d'avant la question
Sub copyPourcent()

    Dim lRow As Long
    
    lRow = Cells.Find(What:="*", _
            After:=Cells(1, 26 + 2), _
            LookAt:=xlPart, _
            LookIn:=xlFormulas, _
            SearchOrder:=xlByColumns, _
            SearchDirection:=xlPrevious, _
            MatchCase:=False).Row 'Dernière ligne de contenu de la colonne
            
    shQuiz.Range(shQuiz.Cells(1, 26 + 2), shQuiz.Cells(lRow, 26 + 2)).Copy _
    Range(shQuiz.Cells(1, 26 + 7), shQuiz.Cells(lRow, 26 + 7))

End Sub


'Graph - Effacer les données graphique de la dernière question
Sub delChartData()

    Dim lRow As Long
    Dim i As Long

    lRow = Cells.Find(What:="*", _
            After:=Cells(1, 26 + 2), _
            LookAt:=xlPart, _
            LookIn:=xlFormulas, _
            SearchOrder:=xlByColumns, _
            SearchDirection:=xlPrevious, _
            MatchCase:=False).Row 'Dernière ligne de contenu de la colonne

    If lRow <= 1 Then
        shQuiz.Range("AA1").Value = "aucune opération"
        shQuiz.Range("AB1:AF1").Value = 0
    Else
        shQuiz.Range(shQuiz.Cells(2, 27), shQuiz.Cells(lRow, 32)).Value = ""
    End If

End Sub

'Graph - Efface toutes les données graphique de la dernière question
Sub delChartDataFull()

    Dim lRow As Long
    Dim i As Long

    lRow = Cells.Find(What:="*", _
            After:=Cells(1, 1), _
            LookAt:=xlPart, _
            LookIn:=xlFormulas, _
            SearchOrder:=xlByRows, _
            SearchDirection:=xlPrevious, _
            MatchCase:=False).Row 'Dernière ligne de contenu de la colonne

    If lRow < 2 Then lRow = 2

    shQuiz.Range("AA2", Cells(lRow, 26 + 7)).Value = ""

    shQuiz.Range("AA1").Value = "aucune opération"
    shQuiz.Range("AB1:AG1").Value = 0

End Sub


'Graph - Inscrit un array de données de graph sur la feuille shQuiz
Sub insertArray(ByVal arr As Variant)


    Dim Y As Long
    Y = UBound(arr) - LBound(arr)
    
    Dim i As Long
    Dim j As Long
    
    For i = LBound(arr) + 1 To UBound(arr) + 1
        
            shQuiz.Cells(i, 27).Value = arr(i - 1, 0) 'Opération
            shQuiz.Cells(i, 28).Value = arr(i - 1, 3) 'Pourcentage actuel
    Next i
    

End Sub


'Graph - Sub pour contrôler les couleurs du graphique de progression
Sub Color_BarChart_Categories()

    Dim lRow As Long

    lRow = Cells.Find(What:="*", _
            After:=Cells(1, 26 + 2), _
            LookAt:=xlPart, _
            LookIn:=xlFormulas, _
            SearchOrder:=xlByColumns, _
            SearchDirection:=xlPrevious, _
            MatchCase:=False).Row 'Dernière ligne de contenu de la colonne

    'Calculer le gain
    Dim rgActuel As Range
    Set rgActuel = shQuiz.Range(shQuiz.Cells(1, 26 + 2).Address, shQuiz.Cells(lRow, 26 + 2).Address)

    Dim rgAvant As Range
    Set rgAvant = shQuiz.Range(shQuiz.Cells(1, 26 + 7).Address, shQuiz.Cells(lRow, 26 + 7).Address)
    
    Dim rgGain As Range
    Set rgGain = shQuiz.Range(shQuiz.Cells(1, 26 + 3).Address, shQuiz.Cells(lRow, 26 + 3).Address)
    
    Dim c As Range
    Dim k As Double
    Set c = Cells
    
    For Each c In rgGain
        k = rgActuel(c.Row, 1).Value - rgAvant(c.Row, 1).Value
        If k > 0 Then
            c.Value = rgActuel(c.Row, 1).Value
        Else
            c.Value = 0
        End If
    Next c

    'Calculer la perte
    Dim rgPerte As Range
    Set rgPerte = shQuiz.Range(shQuiz.Cells(1, 26 + 4).Address, shQuiz.Cells(lRow, 26 + 4).Address)
    
    Set c = Cells
    
    For Each c In rgPerte
        k = rgActuel(c.Row, 1).Value - rgAvant(c.Row, 1).Value
        If k < 0 Then
            c.Value = rgAvant(c.Row, 1).Value
        Else
            c.Value = 0
        End If
    Next c
    
        'Créer la colonne masque barre rouge
    Dim rgMask As Range
    Set rgMask = shQuiz.Range(shQuiz.Cells(1, 26 + 6).Address, shQuiz.Cells(lRow, 26 + 6).Address)
    
    Set c = Cells
    
    For Each c In rgMask
        k = rgActuel(c.Row, 1).Value - rgAvant(c.Row, 1).Value
        If k < 0 Then
            c.Value = rgActuel(c.Row, 1).Value
        Else
            c.Value = 0
        End If
    Next c


    'Calculer les réussites
    Dim rgReussi As Range
    Set rgReussi = shQuiz.Range(shQuiz.Cells(1, 26 + 5).Address, shQuiz.Cells(lRow, 26 + 5).Address)
    
    Set c = Cells
    
    For Each c In rgReussi
        k = rgAvant(c.Row, 1).Value
        If k = 1 Then
            c.Value = k
        Else
            c.Value = 0
        End If
    Next c
    
End Sub


