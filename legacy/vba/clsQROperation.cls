Attribute VB_Name = "clsQROperation"
Attribute VB_Base = "0{FCFB3D2A-A0FA-1068-A738-08002B3371B5}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = False
'Class module: clsQROperation

' Member variable
Option Explicit
Private m_TypeOperation As String
Private m_ISO As String
Private m_CouleurISO As String
Private m_IdOutil As String
Private m_Matoutil As String
Private m_VDI As Long
Private m_MatUsi As String
Private m_Composition As String
Private m_EtatMetal As String
Private m_DureteHB As String
Private m_NoCol As Long
Private m_Vc As Double
Private m_Avpdent As Double
Private m_Avptour As Double
Private m_Rpm As Double
Private m_Avpmin As Double

'*****************************************************************************
'Properties
'*****************************************************************************

'Type d'opération
Public Property Get TypeOperation() As String
    TypeOperation = m_TypeOperation
End Property

Public Property Let TypeOperation(vNewValue As String)
    m_TypeOperation = vNewValue
End Property


'ISO
Public Property Get ISO() As String
     ISO = m_ISO
End Property

Public Property Let ISO(vNewValue As String)
     m_ISO = vNewValue
End Property


'Couleur ISO
Public Property Get CouleurISO() As String
    CouleurISO = m_CouleurISO
End Property

Public Property Let CouleurISO(ByVal vNewValue As String)
    m_CouleurISO = vNewValue
End Property


'ID outil
Public Property Get IdOutil() As String
    IdOutil = m_IdOutil
End Property

Public Property Let IdOutil(vNewValue As String)
    m_IdOutil = vNewValue
End Property


'Matériau outil
Public Property Get Matoutil() As String
    Matoutil = m_Matoutil
End Property

Public Property Let Matoutil(vNewValue As String)
    m_Matoutil = vNewValue
End Property


'VDI
Public Property Get VDI() As Long
    VDI = m_VDI
End Property

Public Property Let VDI(vNewValue As Long)
    m_VDI = vNewValue
End Property


'MatUsi
Public Property Get MatUsi() As String
    MatUsi = m_MatUsi
End Property

Public Property Let MatUsi(vNewValue As String)
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


'Numéro de colonne
Public Property Get nocol() As Long
    nocol = m_NoCol
End Property

Public Property Let nocol(vNewValue As Long)
    m_NoCol = vNewValue
End Property


'Vitesse de coupe
Public Property Get Vc() As Double
    Vc = m_Vc
End Property

Public Property Let Vc(vNewValue As Double)
    m_Vc = vNewValue
End Property


'Avance par dent
Public Property Get Avpdent() As Double
    Avpdent = m_Avpdent
End Property

Public Property Let Avpdent(vNewValue As Double)
    m_Avpdent = vNewValue
End Property


'Avance par tour
Public Property Get Avptour() As Double
    Avptour = m_Avptour
End Property

Public Property Let Avptour(vNewValue As Double)
    m_Avptour = vNewValue
End Property


'Vitesse de rotation
Public Property Get Rpm() As Double
    Rpm = m_Rpm
End Property

Public Property Let Rpm(vNewValue As Double)
    m_Rpm = vNewValue
End Property


'Vitesse d'avance
Public Property Get Avpmin() As Double
    Avpmin = m_Avpmin
End Property

Public Property Let Avpmin(vNewValue As Double)
    m_Avpmin = vNewValue
End Property


'****************************************************************************
'Method
'****************************************************************************

'Récupérer l'info de l'opération réussie d'un quiz
Public Sub RecOpQuiz()


    'Type d'opération
    m_TypeOperation = shQuiz.Label5.Caption
    
    'Couleur du groupe ISO
    m_CouleurISO = shQuiz.Label7.BackColor
    
    'Groupe ISO
    m_ISO = shQuiz.Label7.Caption
    
    'Matoutil
    m_Matoutil = shQuiz.Label2.Caption
    
    'IdOutil
    m_IdOutil = shQuiz.Label1.Caption
    
    'État métallurgique
    m_EtatMetal = shQuiz.Label11.Caption
    
    'Composition
    m_Composition = shQuiz.Label12.Caption
    
    'Dureté HB
    m_DureteHB = shQuiz.Label13.Caption
    
    'VDI
    m_VDI = shQuiz.Label8.Caption

    'Matériau usiné
    m_MatUsi = shQuiz.Label9.Caption
    
    'NoCol
    m_NoCol = shQuiz.Label6.Caption
    
    'Vc
    m_Vc = shQuiz.TextBox1.Value
    
    'Avpdent
    m_Avpdent = shQuiz.TextBox2.Value
    
    'Avptour
    m_Avptour = shQuiz.TextBox4.Value
    
    'Rpm
    m_Rpm = shQuiz.TextBox3.Value
    
    'Avpmin
    m_Avpmin = shQuiz.TextBox5.Value
    
End Sub


'Insert deux lignes d'infos d'une QROpération dans le rapport sous le rgTitreOp
Public Sub InsOpRapport(ByVal rgTitreOp As Range)
        
        
    Dim ws As Worksheet
    Set ws = shRapport
    
    Dim rw As Long 'Numéro de ligne du titre de l'opération dans le rapport
    rw = rgTitreOp.Row
    
    Dim cl As Long 'Numéro de colonne du titre de l'opérations dans le rapport
    cl = rgTitreOp.Column

'1- Entrée des données

    'Insérer deux lignes sous le rgCoinHG
    rw = rw + 1 'pour compenser le décallage d'insertion de ligne
    'ws.Range(ws.Cells(rw, cl), ws.Cells(rw + 1, cl)).EntireRow.Insert
    ws.Rows(rw).Insert
    ws.Rows(rw).Insert
    
    
    'Créer un range rgNouvLignes
    Dim rgNouvLignes As Range
    Set rgNouvLignes = ws.Range(ws.Cells(rw, cl), ws.Cells(rw + 1, cl + 11))

    'Créer un array pour ensuite le copier dans le range rgNouvLignes
    Dim arNouvLignes As Variant
    arNouvLignes = rgNouvLignes.Value
        
        'IdOutil
        arNouvLignes(1, 1) = m_IdOutil & " - " & m_Matoutil
        'Vitesse de coupe
        arNouvLignes(1, 7) = m_Vc
        'Avance par dent
        arNouvLignes(1, 8) = m_Avpdent
        'Avance par tour
        arNouvLignes(1, 10) = m_Avptour
        'Vitesse de rotation
        arNouvLignes(1, 11) = m_Rpm
        'Vitesse d'avance
        arNouvLignes(1, 12) = m_Avpmin
        'Groupe ISO
        arNouvLignes(2, 1) = m_ISO
        'Materiau usiné
        arNouvLignes(2, 2) = m_VDI & " - " & m_MatUsi & " - " & m_DureteHB
        'Nocol
        arNouvLignes(2, 9) = m_NoCol

    'Recopier l'array dans le range
    rgNouvLignes = arNouvLignes

'2-Formater les lignes insérées
    
    'Général
    With rgNouvLignes.Borders(xlEdgeTop)
        .LineStyle = xlContinuous
        .ColorIndex = 0
        .TintAndShade = 0
        .Weight = xlThin
    End With

    With rgNouvLignes
        .Borders(xlEdgeBottom).LineStyle = xlLineStyleNone
        .Borders(xlInsideHorizontal).LineStyle = xlLineStyleNone
        .Font.Bold = False
        .Font.Size = 8
    End With
    
    'Groupe ISO
    With rgNouvLignes(2, 1)
        .Interior.Color = m_CouleurISO
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
        .Font.Bold = True
        .Font.Size = 12
        .RowHeight = 13.5
        .VerticalAlignment = xlCenter
    End With
    
    'IdOutil
    Dim matOLen As Long
    matOLen = Len(m_IdOutil)
    
    rgNouvLignes(1, 1).RowHeight = 13.5
    rgNouvLignes(1, 1).Characters(Start:=matOLen + 4, Length:=matOLen + 3 _
    + Len(m_Matoutil)).Font.Bold = True

    With rgNouvLignes(2, 2)
        .Font.Bold = False
        .VerticalAlignment = xlTop
        With .Interior
            .Pattern = xlPatternLinearGradient
            .Gradient.Degree = 180
            .Gradient.ColorStops.Clear
        End With
    End With

    With rgNouvLignes(2, 2).Interior.Gradient.ColorStops.Add(0)
        .ThemeColor = xlThemeColorDark1
        .TintAndShade = 0
    End With

    With rgNouvLignes(2, 2).Interior.Gradient.ColorStops.Add(1)
        .Color = m_CouleurISO
        .TintAndShade = 0
    End With

    'NoCol
    rgNouvLignes(2, 9).Font.Bold = False
    rgNouvLignes(2, 9).Font.ColorIndex = 2
    
    'Quiz en mode vitesse de coupe seulement
    If shOutil.OLEObjects("CheckBox2").Object.Value = True Then
        rgNouvLignes(1, 8).Font.Bold = False
        rgNouvLignes(1, 8).Font.ColorIndex = 2
        rgNouvLignes(1, 10).Font.Bold = False
        rgNouvLignes(1, 10).Font.ColorIndex = 2
        rgNouvLignes(1, 12).Font.Bold = False
        rgNouvLignes(1, 12).Font.ColorIndex = 2
    End If
   
End Sub

'****************************************************************************
'Event
'****************************************************************************

