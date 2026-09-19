Attribute VB_Name = "modNouvQuestion"
Option Explicit

'Création des objets
Public oOutil As clsOutil
Public oMateriau As clsMateriau
Public oParamCoupe As clsParamCoupe


'Sub principale de génération de nouvelle question quiz appelant les sous-routines
Sub GenNouvQuestion()
    
    
    'Initialiser random seed
    Randomize
    
    'Création d'un outil
    Set oOutil = New clsOutil
     
    'Création d'un matériau
    Set oMateriau = New clsMateriau
     
    'Création des paramètres de coupe
    Set oParamCoupe = New clsParamCoupe
     
    'Renvoie vers Excel les caractéristiques de l'outil
    Call toQzOutil
    
    'Renvoie vers Excel les informations du matériau brut
    Call toQzMat
    
    'Renvoie vers Excel les paramètres de coupe
    Call toQzReponse
     
    'Copie des réponses dans les cases questions s'il s'agit d'un quiz de vitesse de coupe seulement
    Call copieReponseVCseulement
         
End Sub


'Fonction créant une collection de NoCol d'outils valides à questionner
Function collNoColValide() As Collection
    
    'Détermine le numéro de la dernière ligne de contenu dans la liste du rapport
    Dim lRwEnd As Long
    lRwEnd = shRapport.Cells.Columns(1).Find(What:="*", _
                                        After:=Range("A1"), _
                                        LookAt:=xlPart, _
                                        LookIn:=xlFormulas, _
                                        SearchOrder:=xlByColumns, _
                                        SearchDirection:=xlPrevious, _
                                        MatchCase:=False).Row

    'Numéro de la dernière colonne d'outil
    Dim lastCol As Long
    lastCol = shOutil.UsedRange.Columns.Count   'Compte le nombre de type d'outil
    Dim i As Long
    Dim coll As Collection
    Set coll = New Collection
    Dim nbOccur As Long
    Dim nbTheor As Long
    Dim rgNoColRapport As Range 'Série des numéros de colonne du rapport
    Set rgNoColRapport = shRapport.Range(shRapport.Cells(1, 9), shRapport.Cells(lRwEnd, 9))
    
    For i = 1 To lastCol 'Pour tous les numéros de colonne outil
        
        nbOccur = Application.CountIf(rgNoColRapport, i) 'Occurences du numéro i dans le rapport
        nbTheor = shOutil.Cells(3, i).Value 'Nb de réussites consécutives prescrites
        
        If nbOccur < nbTheor Then
            coll.Add i 'Ajouter le no d'outil à la coll de no valides
        End If
    Next
    
    Set collNoColValide = coll

End Function


