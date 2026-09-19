Attribute VB_Name = "clsMateriau"
Attribute VB_Base = "0{FCFB3D2A-A0FA-1068-A738-08002B3371B5}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = False
'Class module: clsMateriau

'****************************************************************************
'Member variable
'****************************************************************************
Option Explicit
Private m_ISO As String
Private m_Couleur As String
Private m_VDI As Long
Private m_MatUsi As String
Private m_Composition As String
Private m_EtatMetal As String
Private m_DureteHB As String
Private m_MatExemple As String
Private m_Vc As Long

'****************************************************************************
'Property
'****************************************************************************

'Iso
Public Property Get ISO() As String
    ISO = m_ISO
End Property

Public Property Let ISO(ByVal vNewValue As String)
    m_ISO = vNewValue
End Property

'Couleur
Public Property Get Couleur() As String
    Couleur = m_Couleur
End Property

Public Property Let Couleur(ByVal vNewValue As String)
    m_Couleur = vNewValue
End Property

'VDI
Public Property Get VDI() As Long
    VDI = m_VDI
End Property

Public Property Let VDI(ByVal vNewValue As Long)
    m_VDI = vNewValue
End Property

'MatUsi
Public Property Get MatUsi() As String
    MatUsi = m_MatUsi
End Property

Public Property Let MatUsi(ByVal vNewValue As String)
    m_MatUsi = vNewValue
End Property

'Composition
Public Property Get Composition() As String
    Composition = m_Composition
End Property

Public Property Let Composition(ByVal vNewValue As String)
    m_Composition = vNewValue
End Property

'EtatMetal
Public Property Get EtatMetal() As String
    EtatMetal = m_EtatMetal
End Property

Public Property Let EtatMetal(ByVal vNewValue As String)
    m_EtatMetal = vNewValue
End Property

'DureteHB
Public Property Get DureteHB() As String
    DureteHB = m_DureteHB
End Property

Public Property Let DureteHB(ByVal vNewValue As String)
    m_DureteHB = vNewValue
End Property

'MatExemple
Public Property Get MatExemple() As String
    MatExemple = m_MatExemple
End Property

Public Property Let MatExemple(ByVal vNewValue As String)
    m_MatExemple = vNewValue
End Property


'****************************************************************************
'Event
'****************************************************************************
Private Sub Class_Initialize()
 
   
    Dim ws As Worksheet
    Set ws = shOutil
    
    'Attribution du numéro de colonne de l'objet oOutil.NoCol
    Dim numcoloutil As Long
    numcoloutil = modNouvQuestion.oOutil.nocol
    
    'Attibution des valeurs du tableau excel
    '****************************************
    'rassembler en collection les choix utilisateur 1, 2, 3...
    Dim collGrMat As Collection
    Set collGrMat = New Collection
    
    'Array Groupe Matériau
    Dim arGrMat As Variant
    arGrMat = Range(ws.Cells(21, numcoloutil), ws.Cells(40, numcoloutil)).Value
    
    
    Dim i As Long
    
    For i = 1 To 20
        
        Dim temp As String
    
        If arGrMat(i, 1) <> vbNullString Then
            temp = arGrMat(i, 1)
            temp = Mid(temp, InStr(temp, " - ") + 3) 'extraire le nom du sous-groupe de matériau
            collGrMat.Add temp
    End If
    
    Next
    
    'choisir au hasard un des sous-groupe
    Dim randGrMatNo As Long
    Dim randGrMat As String
    
    randGrMatNo = randInt(1, collGrMat.Count)
    randGrMat = collGrMat.Item(randGrMatNo)
    
    'créer une collection des VDI du sous-groupe
    Set ws = shVitesse
    Dim tb As ListObject
    Set tb = ws.ListObjects("tblVitesse")

    'Champ VDI
    Dim rgVDI As Range
    Set rgVDI = tb.ListColumns(2).DataBodyRange
    Dim rgMatUsi As Range
    Set rgMatUsi = tb.ListColumns(3).DataBodyRange

    Dim collVDI As Collection
    Set collVDI = New Collection

    For i = 1 To tb.DataBodyRange.Rows.Count
    
        Dim tempVDI As Long
    
        If rgMatUsi(i) = randGrMat Then
            
            tempVDI = tb.DataBodyRange.Cells(i, 2)
            collVDI.Add (tempVDI)
        
        End If
        
    Next

    'choisir au hasard un matériau dans cet collection de VDI
    Dim randVDIitem As Long
    Dim randVDI As Long
    
    randVDIitem = randInt(1, collVDI.Count)
    randVDI = collVDI.Item(randVDIitem)
        
    Dim rMatUsiAll As Variant
    
    rMatUsiAll = tb.DataBodyRange.Value
        
    'DIN ISO 513
    m_ISO = rMatUsiAll(randVDI, 1)

    'Couleur
    m_Couleur = tb.DataBodyRange(randVDI, 1).Interior.Color

    'VDI 3323
    m_VDI = rMatUsiAll(randVDI, 2)
    
    'Matériau usiné
    m_MatUsi = rMatUsiAll(randVDI, 3)
    
    'Composition
    m_Composition = rMatUsiAll(randVDI, 4)
    
    'État métallurgique
    m_EtatMetal = rMatUsiAll(randVDI, 5)
    
    'Dureté Brinell(HB)
        'Vérifier si le format est uniquement numérique pour ajouter " HB"
    Dim isnum As Boolean
        isnum = IsNumeric(rMatUsiAll(randVDI, 6))
    
    If isnum = True Then
        m_DureteHB = rMatUsiAll(randVDI, 6) & " HB"
    Else
        m_DureteHB = rMatUsiAll(randVDI, 6)
    End If
    
    'Exemple AISI/SAE
    m_MatExemple = rMatUsiAll(randVDI, 7)

End Sub

