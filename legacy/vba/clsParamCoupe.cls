Attribute VB_Name = "clsParamCoupe"
Attribute VB_Base = "0{FCFB3D2A-A0FA-1068-A738-08002B3371B5}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = False
' Class module: clsParamCoupe
Option Explicit

'****************************************************************************
'Member variable
'****************************************************************************
'Outil de coupe
Private m_Operation As String 'outil
Private m_Pas As Double 'outil
Private m_Dia As Double 'outil
Private m_NbDent As Long 'outil
Private m_Matoutil As String 'outil
'Lien VDI
Private m_Matbrut As String 'materiau
'Tableaux
Private m_Vc As Double 'param
Private m_Avpdent As Double 'param
'Calc
Private m_Rpm As Double 'param
Private m_Avptour As Double 'param
Private m_Avpmin As Double 'param
Private m_FactVc As Double 'param
Private m_FactAv As Double 'param
Private m_LimitRpm As Double 'param

'****************************************************************************
'Property
'****************************************************************************
'Vc
Public Property Get Vc() As Double
    Vc = m_Vc
End Property

'Avpdent
Public Property Get Avpdent() As Double
    Avpdent = m_Avpdent
End Property

'Rpm
Public Property Get Rpm() As Double
    Rpm = m_Rpm
End Property

'Avptour
Public Property Get Avptour() As Double
    Avptour = m_Avptour
End Property

'Avpmin
Public Property Get Avpmin() As Double
    Avpmin = m_Avpmin
End Property

'****************************************************************************
'Method
'****************************************************************************

'****************************************************************************
'Event
'****************************************************************************

Private Sub Class_Initialize()


    '1-Retrouver la vitesse de coupe
    Dim tbv As ListObject 'Table des vitesses de coupe
    Set tbv = shVitesse.ListObjects("tblVitesse")

        'Assigner la valeur du tableau de vitesse à la variable
    m_Vc = tbv.DataBodyRange.Cells(modNouvQuestion.oMateriau.VDI, _
            tbv.ListColumns(modNouvQuestion.oOutil.Matoutil).Index).Value

    '2-Retrouver l'avance par dent
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
        rw = .Find(What:=modNouvQuestion.oOutil.operation, _
                   LookIn:=xlValues, _
                   LookAt:=xlPart, _
                   SearchOrder:=xlByColumns, _
                   SearchDirection:=xlNext, _
                   MatchCase:=False, _
                   SearchFormat:=False, _
                   After:=.Cells(.Cells.Count)).Row - tbHeader + 1

    End With
    
        'Assigner la valeur du tableau d'avance à la variable
    Dim AvpRev As Double
    Dim AvMax As Double
    Dim boPas As Boolean
    Dim boDia As Boolean
    Dim nboDia As Boolean
            
    With modNouvQuestion.oOutil
            
    boPas = tba.DataBodyRange.Cells(rw, 4).Value '0 ou 1 s'il s'agit d'une avance de filetage
    boDia = tba.DataBodyRange.Cells(rw, 5).Value '0 ou 1 s'il s'agit d'une avance proportionnelle à un Ø
    nboDia = Not boDia
    
    If boPas Then 'Filetage
        AvpRev = .Pas
        AvMax = .Pas
        m_Avpdent = 1 / .Pas
    ElseIf boDia Then 'Proportionnel au diamètre
        AvpRev = tba.DataBodyRange.Cells(rw, 2).Value
        AvMax = tba.DataBodyRange.Cells(rw, 3).Value
        m_Avpdent = AvpRev * .Dia * .FactAv
        If AvMax < m_Avpdent Then
            m_Avpdent = AvMax
        End If
    Else
        m_Avpdent = tba.DataBodyRange.Cells(rw, 2).Value
    End If
        
    End With
        
'        'Arrondir l'avance par dent
'            'FILETAGE
'    If verifFiletage(shQuiz.Label6.Caption) Then
'        m_Avpdent = Round(m_Avpdent, 5)
'    Else 'Autre que filetage
'        m_Avpdent = Round(m_Avpdent, 4)
'    End If
    
    '3-Calculer le RPM
    Dim tempRpm As Double
    tempRpm = (m_Vc * 4 / modNouvQuestion.oOutil.Dia * modNouvQuestion.oOutil.FactVc)
    'tempRpm = Application.WorksheetFunction.RoundDown(tempRpm, 0)
    
        'Plafonner le RPM selon la limite de l'opération
    If tempRpm >= modNouvQuestion.oOutil.LimitRpm Then
        m_Rpm = modNouvQuestion.oOutil.LimitRpm
    Else
        m_Rpm = tempRpm
        'Arrondir à le RPM
        'm_Rpm = Round(tempRpm, 0)
    End If
    
    '4-Calculer l'avance par révolution
    m_Avptour = m_Avpdent * modNouvQuestion.oOutil.NbDent
'        'Arrondir l'avance par révolution
'            'FILETAGE
'    If verifFiletage(shQuiz.Label6.Caption) Then
'        m_Avptour = Round(Avptour, 5)
'    Else
'        m_Avptour = Round(Avptour, 4)
'    End If
    
    '5-Calculer la vitesse d'avance
    m_Avpmin = m_Rpm * m_Avptour
'        'Arrondir l'avance par minute
'    m_Avpmin = Round(m_Avpmin, 3)
    
End Sub

