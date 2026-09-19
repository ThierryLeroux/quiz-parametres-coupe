Attribute VB_Name = "shOutil"
Attribute VB_Base = "0{00020820-0000-0000-C000-000000000046}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = True
Attribute VB_Control = "CheckBox2, 6, 0, MSForms, CheckBox"
Attribute VB_Control = "TextBox1, 1, 1, MSForms, TextBox"
Attribute VB_Control = "CheckBox1, 4, 2, MSForms, CheckBox"
Attribute VB_Control = "TextBox2, 5, 3, MSForms, TextBox"
Option Explicit

'Protection de la feuille, TextBox et CheckBox
Sub ToggleProtection()
    Dim ws As Worksheet
    Dim inputPwd As String

    Set ws = shOutil

    If ws.ProtectContents Then
        inputPwd = InputBox("Entrer le mot de passe pour déverrouiller la feuille")
        If inputPwd = pwd Then
            ws.Unprotect Password:=pwd
            ToggleControls True
        Else
            MsgBox "Mot de passe incorrect. La feuille demeure verrouillée.", vbExclamation
        End If
    Else
        ws.Protect Password:=pwd
        ToggleControls False
        ws.Range("A3").Select ' Select cell A3 when the sheet is locked
        MsgBox "La feuille est maintenant verrouillée.", vbInformation
    End If
End Sub

Sub ToggleControls(ByVal Enable As Boolean)
    shOutil.CheckBox1.Enabled = Enable
    shOutil.TextBox1.Enabled = Enable
    shOutil.CheckBox2.Enabled = Enable
    shOutil.TextBox2.Enabled = Enable
End Sub

Private Sub Workbook_SheetActivate(ByVal Sh As Object)
    If Sh.ProtectContents Then
        ToggleControls False
    Else
        ToggleControls True
    End If
End Sub

Private Sub Workbook_SheetDeactivate(ByVal Sh As Object)
    ToggleControls True
End Sub


'Vérification du format de numéro de version
Private Sub TextBox2_LostFocus()
    ValidateTextBox2
End Sub

Private Sub CheckBox1_Click()
    If Not ValidateTextBox2 Then
        shOutil.CheckBox1.Value = False
    End If
End Sub

Private Function ValidateTextBox2() As Boolean
    '**********************************************
    'Vérification des informations entrées
    '**********************************************
    
    Dim sVersion As String
    sVersion = shOutil.TextBox2.Value

    Dim msg As String

    'Version Moodle/Quiz
        'Condition de la case à cocher "numéro Moodle "Obligatoire"
    Dim etatMoodle As Boolean
    etatMoodle = shOutil.CheckBox1.Value

        'N'est pas vide
    If Trim(sVersion & vbNullString) = vbNullString And etatMoodle Then
        msg = "Le numéro de version Moodle/Quiz doit être inscrit."
        GoTo NonValide
    End If
    
        'Alphabétique
    If Not IsNumeric(sVersion) And Len(sVersion) > 0 Then
        msg = "Le numéro de version Moodle/Quiz doit comporter seulement des caractères numériques."
        GoTo NonValide
    End If
    
        'Cinq chiffres
    If Len(sVersion) <> 5 And Len(sVersion) > 0 Then
        msg = "Le numéro de version Moodle/Quiz doit être composé de 5 chiffres."
        GoTo NonValide
    End If

    ValidateTextBox2 = True
    OptiMode False
    Exit Function

    '--------------------------------------------------
    'Entrées non valides, message et retour à la TextBox
NonValide:
    
    Dim response As VbMsgBoxResult
    response = MsgBox(msg & vbCrLf & "Voulez-vous corriger le numéro ou annuler cette action?", vbYesNoCancel + vbExclamation, "Validation des données")
    If response = vbYes Then
        shOutil.TextBox2.Activate
    ElseIf response = vbNo Or response = vbCancel Then
        shOutil.TextBox2.Value = ""
        shOutil.CheckBox1.Value = False
    End If
    
    ValidateTextBox2 = False
End Function



'Ouvrir la fenêtre d'information
Sub InfoPicture()

    menuInfo.Show

End Sub


