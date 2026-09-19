Attribute VB_Name = "clsOutil"
Attribute VB_Base = "0{FCFB3D2A-A0FA-1068-A738-08002B3371B5}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = False
' Class module: clsOutil
Option Explicit

' ****************************************************************************
' Member variable
' ****************************************************************************
Private m_NoCol As Long
Private m_NomOutil As String
Private m_Commentaires As String
Private m_IdFormat As String
Private m_IdOutil As String
Private m_Operation As String
Private m_Critere As Long
Private m_IdDia As String
Private m_Pas As Double
Private m_Dia As Double
Private m_NbDent As Long
Private m_Matoutil As String
Private m_Couleur As String
Private m_FactVc As Double
Private m_FactAv As Double
Private m_LimitRpm As Double
Private m_LimitAv As Double
Private m_ImageOutil As Shape
' ****************************************************************************
'Property
' ****************************************************************************

'NoCol
Public Property Get nocol() As Long
    nocol = m_NoCol
End Property

Public Property Let nocol(vNewValue As Long)
    m_NoCol = vNewValue
End Property

'NomOutil
Public Property Get NomOutil() As String
    NomOutil = m_NomOutil
End Property

Public Property Let NomOutil(vNewValue As String)
    m_NomOutil = vNewValue
End Property

'Commentaires
Public Property Get Commentaires() As String
    Commentaires = m_Commentaires
End Property
Public Property Let Commentaires(vNewValue As String)
    m_Commentaires = vNewValue
End Property

'IdFormat
Public Property Get IdFormat() As String
    IdFormat = m_IdFormat
End Property

Public Property Let IdFormat(vNewValue As String)
    m_IdFormat = vNewValue
End Property

'Idoutil
Public Property Get IdOutil() As String
    IdOutil = m_IdOutil
End Property

Public Property Let IdOutil(vNewValue As String)
    m_IdOutil = vNewValue
End Property

'Operation
Public Property Get operation() As String
    operation = m_Operation
End Property

Public Property Let operation(vNewValue As String)
    m_Operation = vNewValue
End Property

'Critere
Public Property Get Critere() As Long
    Critere = m_Critere
End Property

Public Property Let Critere(vNewValue As Long)
    m_Critere = vNewValue
End Property

'IdDia
Public Property Get IdDia() As String
    IdDia = m_IdDia
End Property

Public Property Let IdDia(vNewValue As String)
    m_IdDia = vNewValue
End Property

'Pas
Public Property Get Pas() As Double
    Pas = m_Pas
End Property

Public Property Let Pas(vNewValue As Double)
    m_Pas = vNewValue
End Property

'Dia
Public Property Get Dia() As Double
    Dia = m_Dia
End Property

Public Property Let Dia(vNewValue As Double)
    m_Dia = vNewValue
End Property

'NbDent
Public Property Get NbDent() As Long
    NbDent = m_NbDent
End Property

Public Property Let NbDent(vNewValue As Long)
    m_NbDent = vNewValue
End Property

'Matoutil
Public Property Get Matoutil() As String
    Matoutil = m_Matoutil
End Property

Public Property Let Matoutil(vNewValue As String)
    m_Matoutil = vNewValue
End Property

'Couleur
Public Property Get Couleur() As String
    Couleur = m_Couleur
End Property

Public Property Let Couleur(ByVal vNewValue As String)
    m_Couleur = vNewValue
End Property

'FactVc
Public Property Get FactVc() As Double
    FactVc = m_FactVc
End Property

Public Property Let FactVc(vNewValue As Double)
    m_FactVc = vNewValue
End Property

'FactAv
Public Property Get FactAv() As Double
    FactAv = m_FactAv
End Property

Public Property Let FactAv(vNewValue As Double)
    m_FactAv = vNewValue
End Property

'LimitRpm
Public Property Get LimitRpm() As Double
    LimitRpm = m_LimitRpm
End Property

Public Property Let LimitRpm(vNewValue As Double)
    m_LimitRpm = vNewValue
End Property

'LimitAv
Public Property Get LimitAv() As Double
    LimitAv = m_LimitAv
End Property

Public Property Let LimitAv(vNewValue As Double)
    m_LimitAv = vNewValue
End Property

'ImageOutil
Public Property Get ImageOutil() As Shape
    Set ImageOutil = m_ImageOutil
End Property

Public Property Set ImageOutil(vNewValue As Shape)
    Set m_ImageOutil = vNewValue
End Property

'****************************************************************************
'Event
'****************************************************************************
Private Sub Class_Initialize()


    Dim ws As Worksheet
    Set ws = shOutil
    
    'Trouver la dernière ligne du tableau d'outil
    Dim numLastRow As Long
    numLastRow = shOutil.Cells.Find(What:="*", _
                                After:=Range("A1"), _
                                LookAt:=xlPart, _
                                LookIn:=xlFormulas, _
                                SearchOrder:=xlByRows, _
                                SearchDirection:=xlPrevious, _
                                MatchCase:=False).Row
    
    'Sélection d'un numéro d'outil valide
    '************************************
    
    'Appel de fonction de création de collection d'outils valides
    Dim coll As Collection
    Set coll = collNoColValide()
    
    'Choix random dans la collection de no valides
    Dim numCollOutil As Long
    numCollOutil = randInt(1, coll.Count)
    
    'Vérification si la collection de no valides est vide
    If coll.Count = 0 Then
        MsgBox "Il n`y a pas d`outils à évaluer."
        End 'Sortie
    End If
    
    m_NoCol = coll.Item(numCollOutil) '******************
    

    'Attibution des valeurs du tableau excel
    '****************************************
    'Array outil
    Dim arOutil As Variant
    
    arOutil = Range(ws.Cells(1, m_NoCol), ws.Cells(numLastRow, m_NoCol)).Value
    
    'Nom d'outil
    m_NomOutil = arOutil(1, 1)
    
    'Critère de réussite
    m_Critere = arOutil(3, 1)
            
    'IdFormat
    m_IdFormat = arOutil(4, 1)

    'Commentaires
    m_Commentaires = arOutil(5, 1)
    
    'Opération d'usinage
    m_Operation = arOutil(6, 1)
    
    'Facteur d'ajustement du Vc
    m_FactVc = ConvertToNumber((arOutil(7, 1)))
    
    'Facteur d'ajustement de l'avance
    m_FactAv = ConvertToNumber((arOutil(8, 1)))
     
    'Limite de RPM
    m_LimitRpm = ConvertToNumber((arOutil(9, 1)))
    
    'Limite d'avance
    m_LimitAv = ConvertToNumber((arOutil(10, 1)))
    
    'Nombre de dents sur l'outil
    Dim NbDent As Long
    Dim NbDentmin As Long
    Dim NbDentmax As Long
    
    NbDentmin = arOutil(11, 1)
    NbDentmax = arOutil(12, 1)
    
    NbDent = randInt(NbDentmin, NbDentmax)
    
    m_NbDent = NbDent
    
    'Diamètre et pas
    Dim collIdDia As Collection
    Dim collDia As Collection
    Set collIdDia = New Collection
    Set collDia = New Collection
    Dim d As Variant
    Dim idd As String
    
    Dim j As Long
    
    For j = 43 To numLastRow Step 2
        
        d = arOutil(j, 1)
        
        If d <> vbNullString Then
            collIdDia.Add d
        End If
        
        idd = arOutil(j + 1, 1)
        
        If idd <> vbNullString Then
            If IsNumeric(idd) Then
                idd = ConvertToNumber(idd)
                collDia.Add Round(idd, 6)
            Else
                collDia.Add idd
            End If
        End If

    Next
    
    
        'Choix de la méthode d'interprétation de la liste des dimensions et libellés
    Dim rdNum As Long
    rdNum = randInt(1, collIdDia.Count)
       
    Dim sDia As Variant
    sDia = collDia.Item(rdNum)
       
        'Vérifier s'il s'agit d'un outil pour usiner des filets
    If verifFiletage(m_NoCol) Then
        
        If sDia Like "*[-]*" Then 'Filet impérial
            
            'Extraire le diamètre
            m_Dia = ConvertToNumber(Left(sDia, InStr(1, sDia, "-") - 1))
            
            'Extraire le pas
            m_Pas = ConvertToNumber(Mid(sDia, InStr(1, sDia, "-") + 1))
            
        ElseIf sDia Like "*[xX]*" Then 'Filet métrique
           
            'Extraire le diamètre
            Dim sDiaTemp As String
            
            sDiaTemp = ConvertToNumber(Left(sDia, InStr(1, sDia, "x") + InStr(1, sDia, "X") - 1))
            m_Dia = sDiaTemp / 25.4
            
            'Extraire le pas
            Dim sLongFilet As String
            Dim dLongFilet As Double
            
            sLongFilet = Mid(sDia, InStr(1, sDia, "x") + InStr(1, sDia, "X") + 1)
            dLongFilet = ConvertToNumber(sLongFilet)
            m_Pas = 1 / dLongFilet * 25.4
        
        End If
            
    Else
        'Diamètre d'outil en po
        m_Dia = ConvertToNumber(sDia)
    
    End If
    
    m_IdDia = collIdDia.Item(rdNum)
    'm_Dia = collDia.Item(rdNum)
    
'    If IsNumeric(collIdDia.Item(rdNum)) Then
'        m_Pas = collIdDia.Item(rdNum)
'    End If
                             
    
    'Matériau de l'outil
    Dim collMatOutil As Collection
    Set collMatOutil = New Collection
        
    Dim k As Long
    
    For k = 13 To 22 Step 1
        
        If arOutil(k, 1) <> vbNullString Then
            collMatOutil.Add arOutil(k, 1)
        End If
    Next
    
    rdNum = randInt(1, collMatOutil.Count)
    
    m_Matoutil = collMatOutil.Item(rdNum)
    
    
    'Couleur (hss, sc, insert...)
    Dim tb As ListObject
    Set tb = shVitesse.ListObjects("tblVitesse")

    m_Couleur = tb.HeaderRowRange(tb.ListColumns(m_Matoutil).Index).Interior.Color
    
    
    'Ajout de l'image à l'objet oOutil
    
    Dim rgImageAddr As Range
    Dim shpImage As Shape
    
    Set rgImageAddr = ws.Cells(2, m_NoCol)
    Set m_ImageOutil = GetShape(rgImageAddr)
    
    'Appel de la sub de création d'identifiant d'outil
    Call instIdOutil

End Sub

'****************************************************************************
'Method
'****************************************************************************

'Création de l'identifiant de l'outil tel que dans le questionnaire
Private Sub instIdOutil()

    
    Dim IdOutil As String
    Dim tempA As String
    Dim tempB As String
    Dim locA As Long
    locA = 1
    Dim locB As Long
    locB = 1
    
    Dim sIdFormat As String
    sIdFormat = m_IdFormat 'Syntaxe de nomenclature de l'outil selon la feuille outil
        
    Do While Not Len(sIdFormat) = 0
        
        locA = InStr(1, sIdFormat, "[")
        If locA = 0 Then locA = Len(sIdFormat) + 1
        tempA = Left(sIdFormat, locA - 1)
        
        IdOutil = IdOutil & tempA
        sIdFormat = Mid(sIdFormat, locA + 1)
        If Len(sIdFormat) = 0 Then Exit Do

        locB = InStr(1, sIdFormat, "]")
        tempB = Left(sIdFormat, locB - 1)

        Select Case tempB
            Case "NoCol"
            tempB = m_NoCol
            Case "NomOutil"
            tempB = m_NomOutil
            Case "Commentaires"
            tempB = m_Commentaires
'            Case "IdFormat"
'            tempB = m_IdFormat
'            Case "IdOutil"
'            tempB = m_IdOutil
            Case "Operation"
            tempB = m_Operation
            Case "Critere"
            tempB = m_Critere
            Case "IdDia"
            tempB = m_IdDia
            Case "Pas"
            tempB = m_Pas
            Case "Dia"
            tempB = m_Dia
            Case "NbDent"
            tempB = m_NbDent
            Case "Matoutil"
            tempB = m_Matoutil
            Case "Couleur"
            tempB = m_Couleur
            Case "FactVc"
            tempB = m_FactVc
            Case "FactAv"
            tempB = m_FactAv
            Case "LimitRpm"
            tempB = m_LimitRpm
            Case "LimitAv"
            tempB = m_LimitAv
        
        End Select
    
        IdOutil = IdOutil & tempB
        
        sIdFormat = Mid(sIdFormat, locB + 1)
        
    Loop
    
    m_IdOutil = IdOutil
    
End Sub
