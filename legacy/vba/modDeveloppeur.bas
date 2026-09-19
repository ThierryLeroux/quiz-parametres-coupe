Attribute VB_Name = "modDeveloppeur"
Option Explicit


'Pour développement
Sub copieReponse()
Dim textboxValue As String
Dim numberValue As Double

    With shQuiz
    
        .TextBox1.Value = Format(ConvertToNumber(.TextBox6.Value), "General Number")
        .TextBox2.Value = Format(ConvertToNumber(.TextBox7.Value), "General Number")
        .TextBox3.Value = Format(ConvertToNumber(.TextBox8.Value), "General Number")
        .TextBox4.Value = Format(ConvertToNumber(.TextBox9.Value), "General Number")
        .TextBox5.Value = Format(ConvertToNumber(.TextBox10.Value), "General Number")
        
    End With
    
End Sub

Sub GetBackgroundColor()
    Dim ws As Worksheet
    Dim cell As Range
    Dim colorNumber As Long
    
    Set ws = shRapport ' Replace "Sheet1" with your sheet name
    Set cell = ws.Range("E18") ' Replace "A1" with the cell reference of your gray background
    
    colorNumber = cell.Interior.Color
    MsgBox "The color number of the background is: " & colorNumber '15921906
End Sub

