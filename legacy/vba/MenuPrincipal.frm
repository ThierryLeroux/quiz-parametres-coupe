Attribute VB_Name = "MenuPrincipal"
Attribute VB_Base = "0{E6806307-921F-472B-BBE9-230365FA16AE}{625CD3F6-E044-4B1F-85F3-FE6474723223}"
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

'"Nouveau quiz"
Private Sub Image1_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)
   
        AddCursor IDC_HAND 'Pointeur souris en forme de main
    
End Sub
Private Sub Image1_MouseDown(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)

    Unload Me
    menuNouveauQuiz.Show
    
End Sub


'"Réinitialiser le quiz"
Private Sub Image2_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)
    
    AddCursor IDC_HAND 'Pointeur souris en forme de main
    
End Sub
Private Sub Image2_MouseDown(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)
        
    Dim answer As Long
    
    If Trim(shQuiz.Label21.Caption) = 20 Or Trim(shQuiz.Label21.Caption) = "" Then GoTo quizVide
    answer = MsgBox("Les données suivantes seront effacées:" & vbCrLf & _
    vbCrLf & _
    "- nom, prénom, matricule" & vbCrLf & _
    "- liste des questions réussies" & vbCrLf & _
    "- numéro d`exercice et code de réussite Moodle" & vbCrLf & _
    vbCrLf & _
    "Réinitialiser le quiz?", _
    vbInformation + vbYesNo, "Réinitialiser le quiz")
    
    If answer = vbNo Then GoTo returnMenu 'Si "Non", quitte la procedure

quizVide:
    
    Unload Me
    
    OptiMode True
    shQuiz.Unprotect pwd
    'shRapport.Unprotect pwd
    'shOutil.Unprotect pwd
        
    Call resetQuiz
    
    'État du quiz
    shQuiz.Label21.Caption = 20
    modAffControlBouton.ControlButton (20)
    
    Call versionQuiz
    
    Call affGraph
    
    shQuiz.Protect pwd
    ThisWorkbook.Unprotect pwd
    shRapport.Visible = xlSheetVeryHidden
    shOutil.ToggleControls False
    shOutil.Visible = xlSheetHidden
    ThisWorkbook.Protect pwd
    shOutil.Protect pwd
    OptiMode False

    Exit Sub
    
returnMenu:

End Sub

'"Éditer les outils"
Private Sub Image3_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)
    
    AddCursor IDC_HAND 'Pointeur souris en forme de main
    
End Sub
Private Sub Image3_MouseDown(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)

    Unload Me
    
    With shOutil
        .Unprotect pwd
        ThisWorkbook.Unprotect pwd
        .Visible = xlSheetVisible
        ThisWorkbook.Protect pwd
        .TextBox1.Enabled = False
        .Activate
        .Range("A3").Select
        .Protect pwd
    End With

    'État du quiz "Banque d'outils déverouillé"
    If shOutil.ProtectContents = False Then
        shQuiz.Unprotect pwd
        shQuiz.Label21.Caption = 10
        modAffControlBouton.ControlButton (10)
        shQuiz.Protect pwd
    End If
    

End Sub


'Aide
Private Sub Image6_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)
    
    AddCursor IDC_HAND 'Pointeur souris en forme de main
    
End Sub
Private Sub Image6_MouseDown(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)

    Me.Hide
    menuInfo.Show
    Me.Show

End Sub


'Annuler
Private Sub Image4_MouseMove(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)
    
    AddCursor IDC_HAND 'Pointeur souris en forme de main
    
End Sub
Private Sub Image4_MouseDown(ByVal Button As Integer, ByVal Shift As Integer, ByVal X As Single, ByVal Y As Single)

    Unload Me

End Sub

'Touche ESCAPE
Private Sub UserForm_KeyDown(ByVal KeyCode As MSForms.ReturnInteger, ByVal Shift As Integer)
    If KeyCode = 27 Then ' Check if Escape key is pressed
        Unload Me ' Close the form
    End If
End Sub

