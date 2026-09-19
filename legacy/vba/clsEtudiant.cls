Attribute VB_Name = "clsEtudiant"
Attribute VB_Base = "0{FCFB3D2A-A0FA-1068-A738-08002B3371B5}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = False
'Class module: clsEtudiant

' Member variable
Private m_Prenom As String
Private m_Nom As String
Private m_Matricule As Long
Private m_Debutquiz As Long
Private m_Reussitequiz As Long
Private m_cumulRep As Long
Private m_NumMoodle As String
Private m_CodeMoodle As String
Private m_QuizVersion As String


'*****************************************************************************
' Properties
'*****************************************************************************

'Prenom
Property Get Prenom() As String
    Prenom = m_Prenom
End Property

Property Let Prenom(vNewValue As String)
    m_Prenom = vNewValue
End Property

'Nom
Property Get Nom() As String
    Nom = m_Nom
End Property

Property Let Nom(vNewValue As String)
    m_Nom = vNewValue
End Property

'Matricule
Property Get Matricule() As Long
    Matricule = m_Matricule
End Property

Property Let Matricule(vNewValue As Long)
    m_Matricule = vNewValue
End Property

'Debutquiz
Property Get Debutquiz() As Date
    Debutquiz = m_Debutquiz
End Property

Property Let Debutquiz(vNewValue As Date)
    m_Debutquiz = vNewValue
End Property

'Reussitequiz
Property Get Reussitequiz() As Date
    Reussitequiz = m_Reussitequiz
End Property

Property Let Reussitequiz(vNewValue As Date)
    m_Reussitequiz = vNewValue
End Property

'cumulRep
Property Get cumulRep() As Long
    cumulRep = m_cumulRep
End Property

Property Let cumulRep(vNewValue As Long)
    m_cumulRep = vNewValue
End Property

'NumMoodle
Property Get NumMoodle() As String
    NumMoodle = m_NumMoodle
End Property

Property Let NumMoodle(vNewValue As String)
    m_NumMoodle = vNewValue
End Property

'CodeMoodle
Property Get CodeMoodle() As String
    CodeMoodle = m_CodeMoodle
End Property

Property Let CodeMoodle(vNewValue As String)
    m_CodeMoodle = vNewValue
End Property

'QuizVersion
Property Get QuizVersion() As String
    QuizVersion = m_QuizVersion
End Property

Property Let QuizVersion(vNewValue As String)
    m_QuizVersion = vNewValue
End Property


'*****************************************************************************
' Event
'*****************************************************************************

Private Sub Class_Initialize()

    'Reconstruire l'objet étudiant avec les valeurs du rapport
    Dim ws As Worksheet
    Set ws = shRapport
    
        m_Prenom = ws.Range("C7").Value
        m_Nom = ws.Range("C8").Value
        m_Matricule = ws.Range("C9").Value
        m_Debutquiz = ws.Range("H7").Value
        m_Reussitequiz = ws.Range("H8").Value
        m_cumulRep = ws.Range("H9").Value
        m_NumMoodle = ws.Range("C5").Value
        m_CodeMoodle = ws.Range("H5").Value
        m_QuizVersion = ws.Range("C4").Value
    
        
End Sub
