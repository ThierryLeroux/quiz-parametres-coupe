Attribute VB_Name = "modCorrection"
Option Explicit

'Note finale d'une question sur 5 (5 questions)
Public result As Long


'Sub de correction des valeurs des textbox réponses
Sub verifReponses()
On Error Resume Next 'Pour contourner l'erreur des divisions par 0 à l'ouverture du classeur

    result = 0
    
    With shQuiz
    
        Dim marge As Double
        Dim Rt As Double
        Dim Re As Double
        Dim Rtmin As Double
        Dim Rtmax As Double
        Dim ecart As Double

        
        'Vitesse de coupe
        '*********************************
            'La réponse doit être EXACTE
        Rt = .TextBox6.Value 'réponse théorique
        Re = .TextBox1.Value 'réponse utilisateur
        
        If Rt = Re Then
            .TextBox1.BackColor = vbGreen
            result = result + 1
        Else
            .TextBox1.BackColor = vbRed
        End If
        
        'Avance par dent
        '*******************************
           'FILETAGE - marge de 0,1%
        If verifFiletage(.Label6.Caption) Then
            
            marge = 0.001 'coefficient de marge d'erreur
            Rt = ConvertToNumber(.TextBox7.Value) 'réponse théorique
            Re = ConvertToNumber(.TextBox2.Value) 'réponse utilisateur
            
            Rtmin = Rt * (1 - marge)
            Rtmax = Rt * (1 + marge)
            
            If Rtmin <= Re And Re <= Rtmax Then
                .TextBox2.BackColor = vbGreen
                result = result + 1
            Else
                .TextBox2.BackColor = vbRed
            End If
            
            'Avance FIXE - réponse exacte
        ElseIf Not verifProp(.Label6.Caption) Then
            
            Rt = .TextBox7.Value 'réponse théorique
            Re = .TextBox2.Value 'réponse utilisateur
            
            If Rt = Re Then 'Réponse exact tirée du tableau seulement
                .TextBox2.BackColor = vbGreen
                result = result + 1
            Else
                .TextBox2.BackColor = vbRed
            End If
            
            'Avance PROPORTIONNELLE - marge 25% ou écart .001po
        Else
            marge = 0.25 'coefficient de marge d'erreur
            ecart = 0.001 'écart max en po admissible
            
            Rt = .TextBox7.Value 'réponse théorique
            Re = .TextBox2.Value 'réponse utilisateur
            
            Rtmax = Rt * (1 + marge)
            If Rtmax > Rt + ecart Then Rtmax = Rt + ecart 'Si marge max > écart max = écart max
            
            Rtmin = Rt * (1 - marge)
            If Rtmin < Rt - ecart Then Rtmin = Rt - ecart 'Si marge min < écart min = écart min
            
            If Rtmin <= Re And Re <= Rtmax Then
                .TextBox2.BackColor = vbGreen
                result = result + 1
            Else
                .TextBox2.BackColor = vbRed
            End If

        End If
        
        'Vitesse de révolution ajustée
        '********************************************
        Rt = .TextBox8.Value 'réponse théorique
        Re = .TextBox3.Value 'réponse utilisateur
        
        
            'FILETAGE - marge(+0, - 90%) - marge 0.1% avec rev/min
        If verifFiletage(.Label6.Caption) Then
            
            marge = 0.001 'coefficient de marge d'erreur
            
            Rtmin = Rt * (0.1 - marge) ' -90%
            Rtmax = Rt * (1 + marge)
            
            If Rtmin <= Re And Re <= Rtmax Then
                .TextBox3.BackColor = vbGreen
                result = result + 1
            Else
                .TextBox3.BackColor = vbRed
            End If
        
        Else 'Autre qu'un FILETAGE
            marge = 0.05 'coefficient de marge d'erreur
    
            Rtmin = Rt * (1 - marge)
            Rtmax = Rt * (1 + marge)
    
            If Rtmin <= Re And Re <= Rtmax Then
                .TextBox3.BackColor = vbGreen
                result = result + 1
            Else
                .TextBox3.BackColor = vbRed
            End If
    
        End If

        'Avance par révolution
        '*************************************
            'FILETAGE
        If verifFiletage(.Label6.Caption) Then
    
            marge = 0.001 'coefficient de marge d'erreur
            Rt = .TextBox9.Value 'réponse théorique
            Re = .TextBox4.Value 'réponse utilisateur
    
            Rtmin = Rt * (1 - marge)
            Rtmax = Rt * (1 + marge)
    
            If Rtmin <= Re And Re <= Rtmax Then
                .TextBox4.BackColor = vbGreen
                result = result + 1
            Else
                .TextBox4.BackColor = vbRed
            End If
                    
            'Avance FIXE
        ElseIf Not verifProp(.Label6.Caption) Then
        
            marge = 0.001 'coefficient de marge d'erreur
            
            Rtmin = Rt * (1 - marge)
            Rtmax = Rt * (1 + marge)
    
            If Rtmin <= Re And Re <= Rtmax Then
                .TextBox4.BackColor = vbGreen
                result = result + 1
            Else
                .TextBox4.BackColor = vbRed
            End If
        
        Else 'Avance PROPORTIONNELLE au diamètre outil
            marge = 0.2 'coefficient de marge d'erreur
            
            Rt = .TextBox9.Value 'réponse théorique
            Re = .TextBox4.Value 'réponse utilisateur
            
            Rtmax = Rt * (1 + marge)
            Rtmin = Rt * (1 - marge)
            
            If Rtmin <= Re And Re <= Rtmax Then
                .TextBox4.BackColor = vbGreen
                result = result + 1
            Else
                .TextBox4.BackColor = vbRed
            End If
        
        End If
        
        'Avance d'usinage
        '*********************************
            'FILETAGE
        If verifFiletage(.Label6.Caption) Then
            
'            Rt = .TextBox10.Value 'réponse théorique
            Re = .TextBox5.Value 'réponse utilisateur

            Dim avpmRe As Double
            avpmRe = .TextBox3.Value * .TextBox4.Value
            
            ecart = 0.005  'coefficient d'ecart d'erreur
            
            Rtmin = avpmRe * (1 - ecart)
            Rtmax = avpmRe * (1 + ecart)

            If Re <= Rtmax And Re >= Rtmin Then
                .TextBox5.BackColor = vbGreen
                result = result + 1
            Else
                .TextBox5.BackColor = vbRed
            End If
            
            'Avance FIXE
        ElseIf Not verifProp(.Label6.Caption) Then
            
            marge = 0.051 'coefficient de marge d'erreur
            Rt = .TextBox10.Value 'réponse théorique
            Re = .TextBox5.Value 'réponse utilisateur
            
            Rtmin = Rt * (1 - marge)
            Rtmax = Rt * (1 + marge)
            
            If Rtmin <= Re And Re <= Rtmax Then
                .TextBox5.BackColor = vbGreen
                result = result + 1
            Else
                .TextBox5.BackColor = vbRed
            End If
                
            'Avance PROPORTIONNELLE au diamètre outil
        Else
            marge = 0.25 'coefficient de marge d'erreur
            Rt = .TextBox10.Value 'réponse théorique
            Re = .TextBox5.Value 'réponse utilisateur
            
            Rtmin = Rt * (1 - marge)
            Rtmax = Rt * (1 + marge)
            
            If Rtmin <= Re And Re <= Rtmax Then
                .TextBox5.BackColor = vbGreen
                result = result + 1
            Else
                .TextBox5.BackColor = vbRed
            End If
                
        End If
        

    End With
    
    ''Vérification si 5 bonnes réponses
    '**********************************
        'Créer un object oQROperation
    Dim oQROperation As clsQROperation
    Set oQROperation = New clsQROperation
    
    oQROperation.RecOpQuiz 'Récupérer les données du Quiz

    If result = 5 Then 'Vérification
       'Si toutes les réponses bonnes:
       
       Call AjoutReponse(oQROperation) 'Ajouter la réponse au rapport
       
       Dim cumulRep As Long 'Incrémenter le cumul des bonnes réponse
       cumulRep = shRapport.Range("H9").Value
       cumulRep = cumulRep + 1
       shRapport.Range("H9").Value = cumulRep
       
    Else
       'Si certaines réponses ne sont pas bonnes:
       
       'Appèle de la sub trouvant la cellule en haut à gauche du range à effacer
       'd'après une recherche listant tout les outils ayant le même numéro de colonne
       Call retraitQR(oQROperation.nocol)
    
    End If


End Sub


'Calculer le code de réussite Moodle
Public Function calcCodeM(verMd As Double) As Double

    Dim oEtudiant As clsEtudiant
    Set oEtudiant = New clsEtudiant
    
    If oEtudiant.NumMoodle = vbNullString Then GoTo numVide 'S'il n'y a pas de numéro d'exercice Moodle
    
    Dim num As Double
    num = oEtudiant.NumMoodle
    
    Dim a As Double, b As Double, c As Double, d As Double, e As Double
    a = Mid(num, 1, 1)
    b = Mid(num, 2, 1)
    c = Mid(num, 3, 1)
    d = Mid(num, 4, 1)
    e = Mid(num, 5, 1)
    
    'Équation Moodle: fmod(54126*(pow({a},{e})+pow({b},{d})+pow({c},{c})+pow({d},{b})+pow({e},{a})),88888)+11111
    
    Dim som As Double
    som = a ^ e + b ^ d + c ^ c + d ^ b + e ^ a
    
    Dim prod As Double
    prod = verMd * som
    
    Dim md As Double
    
    md = Modulus(prod, 88888) + 11111
    
    calcCodeM = md
    
    Exit Function
    
numVide:

    calcCodeM = 0

End Function

'Vérifier si l'outil usine un filetage
Public Function verifFiletage(nocol As Long) As Boolean
    
    Dim tba As ListObject 'Table des avances
    Set tba = shAvance.ListObjects("tblAvance")
    
    Dim rw As Long 'Numéro de rangé dans la table des avances
    Dim tbHeader As Long 'Numéro de la rangée d'entêtes
    
    Dim lstOperation As Range 'Colonne des opérations d'usinage de la table
    Set lstOperation = tba.ListColumns(1).DataBodyRange
    
        'Trouver le numéro de ligne de feuille excel des entêtes
        tbHeader = tba.DataBodyRange.Rows(1).Row
    
    With lstOperation
    
        'Trouver le numéro de ligne de feuille excel de l'opération d'usinage de la table d'avance
        Dim operation As String
        operation = shOutil.Cells(6, nocol).text 'Trouver l'opération que fait l'outil
        
        rw = .Find(What:=operation, _
                   LookIn:=xlValues, _
                   LookAt:=xlPart, _
                   SearchOrder:=xlByColumns, _
                   SearchDirection:=xlNext, _
                   MatchCase:=False, _
                   SearchFormat:=False, _
                   After:=.Cells(.Cells.Count)).Row - tbHeader + 1

    End With
    
        'Assigner la valeur du tableau d'avance à la variable
    Dim boPas As Boolean
    Dim boDia As Boolean
            
    boPas = tba.DataBodyRange.Cells(rw, 4).Value
    
    verifFiletage = boPas

End Function

'Vérifier si l'opération est à avance proportionnelle au diamètre de l'outil
Public Function verifProp(nocol As Long) As Boolean
    
    Dim tba As ListObject 'Table des avances
    Set tba = shAvance.ListObjects("tblAvance")
    
    Dim rw As Long 'Numéro de rangé dans la table des avances
    Dim tbHeader As Long 'Numéro de la rangée d'entêtes
    
    Dim lstOperation As Range 'Colonne des opérations d'usinage de la table
    Set lstOperation = tba.ListColumns(1).DataBodyRange
    
        'Trouver le numéro de ligne de feuille excel des entêtes
        tbHeader = tba.DataBodyRange.Rows(1).Row

    With lstOperation
    
        'Trouver le numéro de ligne de feuille excel de l'opération d'usinage de la table d'avance
        Dim operation As String
        operation = shOutil.Cells(6, nocol).text 'Trouver l'opération que fait l'outil

        
        rw = .Find(What:=operation, _
                   LookIn:=xlValues, _
                   LookAt:=xlPart, _
                   SearchOrder:=xlByColumns, _
                   SearchDirection:=xlNext, _
                   MatchCase:=False, _
                   SearchFormat:=False, _
                   After:=.Cells(.Cells.Count)).Row - tbHeader + 1

    End With
    
        'Assigner la valeur du tableau d'avance à la variable
    Dim boDia As Boolean
            
    boDia = tba.DataBodyRange.Cells(rw, 5).Value
    
    verifProp = boDia

End Function


'Vérifier si le quiz est complété
Public Function verifQuizReussi() As Boolean

    Dim coll As Collection
    Set coll = collNoColValide()

    'Vérification si la collection de no valides est vide
    If coll.Count = 0 Then
        verifQuizReussi = True
    Else
        verifQuizReussi = False
    End If

End Function

