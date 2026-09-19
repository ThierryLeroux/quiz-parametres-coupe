Attribute VB_Name = "menuNouveauQuiz"
Attribute VB_Base = "0{2D822232-9FB0-42E7-8C7D-675F0F1DF891}{56A3CBF6-6A19-4851-B2D6-77A614F965C4}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = False

Option Explicit

'***********************************************************************************************************
'Contrôle du pointeur de souris au dessus des boutons
'***********************************************************************************************************

'Api Declarations
Private Declare PtrSafe Function GetCursorInfo Lib "user32" (ByRef pci As CursorInfo) As Boolean
Private Declare PtrSafe Function LoadCursor Lib "user32" Alias "LoadCursorA" (ByVal hInstance As Long, ByVal lpCursorName As Long) As LongPtr
Private Declare PtrSafe Function SetCursor Lib "user32" (ByVal hCursor As LongPtr) As LongPtr
Private Declare PtrSafe Sub Sleep Lib "kernel32" (ByVal dwMilliseconds As Long)
'Private Declare PtrSafe Function LoadCursor Lib "user32" Alias "LoadCursorA" (ByVal hInstance As LongPtr, ByVal id As Long) As LongPtr

'You can use the default cursors in windows
Private Enum CursorTypes
    IDC_ARROW = 32512
    IDC_IBEAM = 32513
    IDC_WAIT = 32514
    IDC_CROSS = 32515
    IDC_UPARROW = 32516
    IDC_SIZE = 32640
    IDC_ICON = 32641
    IDC_SIZENWSE = 32642
    IDC_SIZENESW = 32643
    IDC_SIZEWE = 32644
    IDC_SIZENS = 32645
    IDC_SIZEALL = 32646
    IDC_NO = 32648
    IDC_HAND = 32649
    IDC_APPSTARTING = 32650
End Enum

'Needed for GetCursorInfo
Private Type POINT
    X As Long
    Y As Long
End Type

'Needed for GetCursorInfo
Private Type CursorInfo
    cbSize As Long
    flags As Long
    hCursor As Long
    ptScreenPos As POINT
End Type

'To set a cursor
Private Function AddCursor(CursorType As CursorTypes)
    If Not IsCursorType(CursorType) Then
        SetCursor LoadCursor(0, CursorType)
        'Application.Wait 200 ' wait a bit, needed for rendering
    End If
End Function

'To determine if the cursor is already set
Private Function IsCursorType(CursorType As CursorTypes) As Boolean
    Dim CursorHandle As LongPtr: CursorHandle = LoadCursor(ByVal 0&, CursorType)
    Dim Cursor As CursorInfo: Cursor.cbSize = Len(Cursor)
    Dim CursorInfo As Boolean: CursorInfo = GetCursorInfo(Cursor)

    If Not CursorInfo Then
        IsCursorType = False
        Exit Function
    End If

    IsCursorType = (Cursor.hCursor = CursorHandle)
End Function
'***********************************************************************************************************


'Débuter le nouveau quiz
Private Sub Image1_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)
   
    AddCursor IDC_HAND 'Pointeur souris en forme de main
    
End Sub
Private Sub Image1_MouseDown(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)

    OptiMode True

'**********************************************
    'Vérification des informations entrées

    Dim sPrenom As String
    Dim sNom As String
    Dim sMatricule As String
    Dim sNumMoodle As String
    
    Dim msg As String
    Dim tbxfocus As Long
    
    sPrenom = TextBox1.Value
    sNom = TextBox2.Value
    sMatricule = TextBox3.Value
    sNumMoodle = TextBox4.Value

    'Prénom
        'N'est pas vide
    If Trim(sPrenom & vbNullString) = vbNullString Then
        msg = "Le prénom doit être inscrit."
        tbxfocus = 1
        GoTo NonValide
    End If
'        'Alphabétique
'    If Not IsAlpha(sPrenom) Then
'        msg = "Le prénom doit comporter seulement des caractères alphabétiques."
'        tbxfocus = 1
'        GoTo NonValide
'    End If

    'Nom
        'N'est pas vide
    If Trim(sNom & vbNullString) = vbNullString Then
        msg = "Le nom doit être inscrit."
        tbxfocus = 2
        GoTo NonValide
    End If
'        'Alphabétique
'    If Not IsAlpha(sNom) Then
'        msg = "Le nom doit comporter seulement des caractères alphabétiques."
'        tbxfocus = 2
'        GoTo NonValide
'    End If

    'Matricule
        'N'est pas vide
    If Trim(sMatricule & vbNullString) = vbNullString Then
        msg = "Le matricule doit être inscrit."
        tbxfocus = 3
        GoTo NonValide
    End If
        'Alphabétique
    If Not IsNumeric(sMatricule) Then
        msg = "Le matricule doit comporter seulement des caractères numériques."
        tbxfocus = 3
        GoTo NonValide
    End If
        'Sept chiffre
    If Len(sMatricule) <> 7 Then
        msg = "Le matricule doit être composé de 7 chiffres."
        tbxfocus = 3
        GoTo NonValide
    End If

    'Numéro d'exercice Moodle
        'Condition de la case à cocher "numéro Moodle "Obligatoire"
    Dim etatMoodle As Boolean
    etatMoodle = shOutil.CheckBox1.Value
        
        'Pas d'exercice moodle relié
    If etatMoodle = False Then
        sNumMoodle = vbNullString
    End If
        'N'est pas vide
    If Trim(sNumMoodle & vbNullString) = vbNullString And etatMoodle Then
        msg = "Le numéro d`exercice Moodle n`est pas inscrit." & vbCrLf & _
    vbCrLf & _
    "Entrer le numéro d`exercice donné dans la question Moodle."
        tbxfocus = 4
        GoTo NonValide
    End If
        'Alphabétique
    If Not IsNumeric(sNumMoodle) And etatMoodle Then
        msg = "Le numéro d`exercice Moodle doit comporter seulement des caractères numériques."
        tbxfocus = 4
        GoTo NonValide
    End If
        'Huit chiffre
    If Len(sNumMoodle) <> 5 And etatMoodle Then
        msg = "Le numéro d`exercice Moodle doit être composé de 5 chiffres."
        tbxfocus = 4
        GoTo NonValide
    End If

    'Vérification des informations entrées
'**********************************************

    'Avertissement que les anciennes données seront effacées
    Dim answer As Long
    If Trim(shQuiz.Label21.Caption) = 20 Or Trim(shQuiz.Label21.Caption) = "" Then GoTo quizVide
    answer = MsgBox("Les données du quiz actuel seront effacées." & vbCrLf & _
    vbCrLf & _
    "Démarrer un nouveau quiz?", _
    vbInformation + vbYesNo, "Démarrer un nouveau quiz")
    
    If answer = vbNo Then Exit Sub 'Si "Non", quitte la procedure

quizVide: 'Suite sans besoin de confirmation d'effacement de données, le quiz étant déjà vide
    
    'Fermer le userform
    Unload Me
    
    'Poser l'état du quiz
    shQuiz.Unprotect pwd
    shQuiz.Label21.Caption = 30
    modAffControlBouton.ControlButton (30)
    
    'Assignation des identifiants étudiants à l'objet oEtudiant
    Dim oEtudiant As New clsEtudiant
        
    With oEtudiant
        .Prenom = sPrenom
        .Nom = sNom
        .Matricule = sMatricule
        .NumMoodle = sNumMoodle
    End With

    'Passer l'objet oEtudiant à la sub de début de quiz
    Call startNewQuiz(oEtudiant)
    
    OptiMode False
    
    Unload MenuPrincipal
    
    Exit Sub
    
'--------------------------------------------------
'Entrées non valide, message et retour à la TextBox
NonValide:

    MsgBox msg, vbInformation + vbOKOnly, "Type de données"

    Select Case tbxfocus
    
    Case 1
    TextBox1.SetFocus
    Case 2
    TextBox2.SetFocus
    Case 3
    TextBox3.SetFocus
    Case 4
    TextBox4.SetFocus

    End Select

End Sub


'Retourner au menu principal
Private Sub Image2_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)
   
    AddCursor IDC_HAND 'Pointeur souris en forme de main
    
End Sub
Private Sub Image2_MouseDown(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)

    Unload Me
    MenuPrincipal.Show
    
End Sub

'Statut optionnel / obligatoire du numéro d'exercice Moodle
Private Sub UserForm_Activate()

    Dim etatMoodle As Boolean
    etatMoodle = shOutil.CheckBox1.Value
    
    If etatMoodle Then
        menuNouveauQuiz.Label1.Caption = "( obligatoire )"
    Else
        menuNouveauQuiz.Label1.Caption = "( optionel )"
    End If

End Sub

'Informations sur le numéro Moodle
Private Sub Image4_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)
   
    AddCursor IDC_HAND 'Pointeur souris en forme de main
    
End Sub
Private Sub Image4_MouseDown(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)

    Me.Hide
    menuInfoMoodle.Show

End Sub


'Touche ESCAPE
Private Sub UserForm_KeyPress(ByVal KeyAscii As MSForms.ReturnInteger)
    If KeyAscii = 27 Then Unload Me
End Sub
Private Sub TextBox1_KeyPress(ByVal KeyAscii As MSForms.ReturnInteger)
    If KeyAscii = 27 Then Unload Me
End Sub
Private Sub TextBox2_KeyPress(ByVal KeyAscii As MSForms.ReturnInteger)
    If KeyAscii = 27 Then Unload Me
End Sub
Private Sub TextBox3_KeyPress(ByVal KeyAscii As MSForms.ReturnInteger)
    If KeyAscii = 27 Then Unload Me
End Sub
Private Sub TextBox4_KeyPress(ByVal KeyAscii As MSForms.ReturnInteger)
    If KeyAscii = 27 Then Unload Me
End Sub

