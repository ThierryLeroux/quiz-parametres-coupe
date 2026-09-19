Attribute VB_Name = "shQuiz"
Attribute VB_Base = "0{00020820-0000-0000-C000-000000000046}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = True
Attribute VB_Control = "Label21, 10011, 2, MSForms, Label"
Attribute VB_Control = "Label20, 10009, 3, MSForms, Label"
Attribute VB_Control = "Label19, 10004, 4, MSForms, Label"
Attribute VB_Control = "Label18, 10003, 5, MSForms, Label"
Attribute VB_Control = "Label17, 10002, 6, MSForms, Label"
Attribute VB_Control = "TextBox16, 10001, 7, MSForms, TextBox"
Attribute VB_Control = "Label16, 9994, 8, MSForms, Label"
Attribute VB_Control = "Label15, 9993, 9, MSForms, Label"
Attribute VB_Control = "Label14, 9992, 10, MSForms, Label"
Attribute VB_Control = "Label13, 9739, 11, MSForms, Label"
Attribute VB_Control = "Label12, 9738, 12, MSForms, Label"
Attribute VB_Control = "Label11, 9737, 13, MSForms, Label"
Attribute VB_Control = "Label10, 9736, 14, MSForms, Label"
Attribute VB_Control = "Label9, 9735, 15, MSForms, Label"
Attribute VB_Control = "Label8, 9728, 16, MSForms, Label"
Attribute VB_Control = "Label7, 9727, 17, MSForms, Label"
Attribute VB_Control = "Label5, 9690, 18, MSForms, Label"
Attribute VB_Control = "Label4, 9689, 19, MSForms, Label"
Attribute VB_Control = "Label3, 9688, 20, MSForms, Label"
Attribute VB_Control = "TextBox10, 3305, 21, MSForms, TextBox"
Attribute VB_Control = "TextBox9, 3304, 22, MSForms, TextBox"
Attribute VB_Control = "TextBox8, 3303, 23, MSForms, TextBox"
Attribute VB_Control = "TextBox7, 3302, 24, MSForms, TextBox"
Attribute VB_Control = "TextBox6, 3301, 25, MSForms, TextBox"
Attribute VB_Control = "TextBox1, 2700, 26, MSForms, TextBox"
Attribute VB_Control = "TextBox2, 2701, 27, MSForms, TextBox"
Attribute VB_Control = "TextBox3, 2702, 28, MSForms, TextBox"
Attribute VB_Control = "TextBox4, 2703, 29, MSForms, TextBox"
Attribute VB_Control = "TextBox5, 2704, 30, MSForms, TextBox"
Attribute VB_Control = "Label1, 9424, 31, MSForms, Label"
Attribute VB_Control = "Label2, 9659, 32, MSForms, Label"
Attribute VB_Control = "Label6, 9995, 33, MSForms, Label"
Attribute VB_Control = "TextBox11, 9996, 34, MSForms, TextBox"
Attribute VB_Control = "TextBox12, 9997, 35, MSForms, TextBox"
Attribute VB_Control = "TextBox13, 9998, 36, MSForms, TextBox"
Attribute VB_Control = "TextBox14, 9999, 37, MSForms, TextBox"
Attribute VB_Control = "TextBox15, 10000, 38, MSForms, TextBox"
Attribute VB_Control = "Label22, 10012, 39, MSForms, Label"
Option Explicit

'*********************************************************************************
'Gestion des boutons
'*********************************************************************************

'État du quiz

'10 - Édition de la liste d'outil
'20 - Initialisé
'30 - En quiz, aucune question posée
'40 - En quiz, question posée
'50 - En quiz, question corrigée
'60 - Quiz complété


'"Menu principal"
'Action suivant l'évènement click
Sub TextBox102A_Click()

    'Zoom et recadrage du Quiz pour éviter les glitchs de copy/paste/delete de l'image outil
    shRapport.Application.ActiveWindow.Zoom = 100
    ActiveWindow.ScrollRow = 1
    ActiveWindow.ScrollColumn = 1
    DoEvents

    OptiMode True    'Optimiser l'exécution de VBA sur Excel ON
    
    'Appeler la Form
    MenuPrincipal.Show

    OptiMode False    'Optimiser l'exécution de VBA sur Excel OFF

End Sub


'***********************************************************************************
'Bulles d'information
'***********************************************************************************
'Sub cacher les bulles d'information
Sub cacheBulles()
    On Error Resume Next
    Dim i As Long
    Dim tb As Object
    
    For i = 11 To 16
        Set tb = shQuiz.OLEObjects("TextBox" & i)
        tb.Visible = False
    Next i

End Sub


'Vitesse de coupe
Private Sub TextBox1_GotFocus()
    
    Call cacheBulles
    shQuiz.TextBox11.Visible = True
    
End Sub
Private Sub TextBox1_lostfocus()

    Call cacheBulles

End Sub


'Avance par dent
Private Sub TextBox2_GotFocus()
    
    Call cacheBulles
    shQuiz.TextBox12.Visible = True

End Sub
Private Sub TextBox2_LostFocus()

    Call cacheBulles

End Sub


'Vitesse de révolution ajustée
Private Sub TextBox3_GotFocus()

    Call cacheBulles
    shQuiz.TextBox13.Visible = True
    shQuiz.TextBox16.Visible = True
    
End Sub
Private Sub TextBox3_lostfocus()

    Call cacheBulles

End Sub


'Avance par révolution
Private Sub TextBox4_GotFocus()

    Call cacheBulles
    shQuiz.TextBox14.Visible = True

End Sub
Private Sub TextBox4_lostfocus()

    Call cacheBulles

End Sub


'Avance par minute
Private Sub TextBox5_GotFocus()

    Call cacheBulles
    shQuiz.TextBox15.Visible = True

End Sub
Private Sub TextBox5_lostfocus()

    Call cacheBulles

End Sub


'***********************************************************************************
'Tabulations et sélection de contenu des textbox
'***********************************************************************************

'Tabulation et sélection TextBox1
Private Sub TextBox1_KeyDown(ByVal KeyCode As MSForms.ReturnInteger, ByVal Shift As Integer)
    If KeyCode = vbKeyTab Then
        If shOutil.OLEObjects("CheckBox2").Object.Value = True Then
            TextBox3.Activate
            With TextBox3
                .SelStart = 0
                .SelLength = Len(.text)
            End With
        Else
            TextBox2.Activate
            With TextBox2
                .SelStart = 0
                .SelLength = Len(.text)
            End With
        End If
    End If
End Sub

'Tabulation et sélection TextBox2
Private Sub TextBox2_KeyDown(ByVal KeyCode As MSForms.ReturnInteger, ByVal Shift As Integer)
    If KeyCode = vbKeyTab Then
        If shOutil.OLEObjects("CheckBox2").Object.Value = True Then
            TextBox3.Activate
            With TextBox3
                .SelStart = 0
                .SelLength = Len(.text)
            End With
        Else
            TextBox3.Activate
            With TextBox3
                .SelStart = 0
                .SelLength = Len(.text)
            End With
        End If
    End If
End Sub

'Tabulation et sélection TextBox3
Private Sub TextBox3_KeyDown(ByVal KeyCode As MSForms.ReturnInteger, ByVal Shift As Integer)
    If KeyCode = vbKeyTab Then
        If shOutil.OLEObjects("CheckBox2").Object.Value = True Then
            TextBox1.Activate
            With TextBox1
                .SelStart = 0
                .SelLength = Len(.text)
            End With
        Else
            TextBox4.Activate
            With TextBox4
                .SelStart = 0
                .SelLength = Len(.text)
            End With
        End If
    End If
End Sub

'Tabulation et sélection TextBox4
Private Sub TextBox4_KeyDown(ByVal KeyCode As MSForms.ReturnInteger, ByVal Shift As Integer)
    If KeyCode = vbKeyTab Then
        If shOutil.OLEObjects("CheckBox2").Object.Value = True Then
            TextBox1.Activate
            With TextBox1
                .SelStart = 0
                .SelLength = Len(.text)
            End With
        Else
            TextBox5.Activate
            With TextBox5
                .SelStart = 0
                .SelLength = Len(.text)
            End With
        End If
    End If
End Sub

'Tabulation et sélection TextBox5
Private Sub TextBox5_KeyDown(ByVal KeyCode As MSForms.ReturnInteger, ByVal Shift As Integer)
    If KeyCode = vbKeyTab Then
        TextBox1.Activate
        With TextBox1
            .SelStart = 0
            .SelLength = Len(.text)
        End With
    End If
End Sub

