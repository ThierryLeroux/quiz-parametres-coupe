Attribute VB_Name = "modSubFct"
Option Explicit

Global Const pwd As String = "tartopom"

'Fonction générant un nombre aléatoire entier borné
Function randInt(lowerbound As Long, upperbound As Long) As Long

    randInt = Int((upperbound - lowerbound + 1) * Rnd + lowerbound)

End Function

'Fonction retournant le nom de l'image se trouvant (coin haut gauche) dans une cellule
Function GetShape(TopLeftCell As Range) As Shape


    Dim shp As Shape
    Dim addr As String
        addr = TopLeftCell.Address

    With TopLeftCell.Worksheet

        For Each shp In .Shapes

            If shp.TopLeftCell.Address = addr Then

                If shp.Type = msoPicture Then

                    Set GetShape = shp

                    Exit Function
                End If
            End If
        Next
    End With

End Function


'Subroutine d'optimisation du code
Public Sub OptiMode(ByVal Enable As Boolean)

     Application.EnableEvents = Not Enable
     Application.Calculation = IIf(Enable, xlCalculationManual, xlCalculationAutomatic)
     Application.ScreenUpdating = Not Enable
     Application.EnableAnimations = Not Enable
     'Application.DisplayStatusBar = Not enable
     'Application.PrintCommunication = Not enable

End Sub


'Fonction pour vérifier si un string item est dans une collection
Function IsInCollection(oCollection As Collection, sItem As String) As Boolean
    
    Dim vItem As Variant
    
    For Each vItem In oCollection
        
        If vItem = sItem Then
            IsInCollection = True
            Exit Function
        
        End If
    Next vItem
    
    IsInCollection = False

End Function


'Fonction permettant de copier un range en collection
Function ReadRangeRowsToCollection(r As Range) As Collection
 
    Dim iRow As Long
    Dim iCol As Long
    Dim rangeArr As Variant
    Dim rowArr As Variant
    Dim c As Collection

    'Read range content to Variant array
    rangeArr = r.Value

    'Transfert des items
    Set c = New Collection
    
    For iRow = 1 To r.Rows.Count
        rowArr = rangeArr(iRow, 1)
    c.Add rowArr
    Next
    
    Set ReadRangeRowsToCollection = c
    
End Function


'Trouver la position d'une variable string dans un array
Function IsInArray(stringToBeFound As String, arr As Variant) As Long
 
    Dim i As Long
    
    ' valeur par défaut si rien n'est trouvé dans l'array
    IsInArray = -1
    
    For i = LBound(arr) To UBound(arr)
    
      If StrComp(stringToBeFound, arr(i, 0), vbTextCompare) = 0 Then
        IsInArray = i
        Exit For
      
      End If
    
    Next i
    
End Function


'Évaluer si un string contient uniquement des lettres
Public Function IsAlpha(strValue As Variant) As Boolean
    
    IsAlpha = strValue Like WorksheetFunction.Rept("[a-zA-Z ]", Len(strValue))

End Function


'Calcul du module, fonctionne pour les nombres excédant 2,147,483,647
Function Modulus(int1 As Double, int2 As Double) As Double
    
    Dim myInt As LongLong
    
    myInt = Int(int1 / int2)
    
    Modulus = int1 - (myInt * int2)
    
End Function


'Fonction d'adaptation d'un marqueur de dédimal selon le système utilisateur (virgule ou point)
Function ConvertToNumber(textValue As Variant) As Double
    Dim decimalSeparator As String
    decimalSeparator = Application.International(xlDecimalSeparator)
    
    'If textValue is empty, replace by 0
    If textValue = vbNullString Then
       textValue = 0
    End If
    
    ' Replace both point and comma with the system's decimal separator
    textValue = Replace(textValue, ".", decimalSeparator)
    textValue = Replace(textValue, ",", decimalSeparator)
    
    ' Convert the modified string to a number
    ConvertToNumber = CDbl(textValue)
End Function


'Fonction pour effacer un OLEObject
Sub DeleteSpecificOLEObject(ws As Worksheet, oleObjectName As String)
    On Error Resume Next

    ws.OLEObjects(oleObjectName).Delete
End Sub


'Subroutine pour générer et positionner le code QR
Sub GenerateAndPositionQRCode(QRText As String, oleObjectName As String, targetCell As Range)
    Dim ws As Worksheet
    Set ws = targetCell.Worksheet

    ' Generate the QR code and add it as an OLEObject
    Dim img As OLEObject
    Set img = ws.OLEObjects.Add(ClassType:="Forms.Image.1", Link:=False, DisplayAsIcon:=False, _
                                Left:=targetCell.Left, Top:=targetCell.Top, Width:=75, Height:=75) ' Adjust the size as needed

    ' Generate the QR code and set it as the picture for the image control
        '    Public Function QRCodegenBarcode(TextOrByteArray As Variant, _
        '            Optional ByVal ForeColor As OLE_COLOR = vbBlack, _
        '            Optional ByVal ModuleSize As Long = 120, _
        '            Optional ByVal SquareModules As Boolean, _
        '            Optional ByVal Ecl As QRCodegenEcc = QRCodegenEcc_LOW, _
        '            Optional ByVal MinVersion As Long = VERSION_MIN, _
        '            Optional ByVal MaxVersion As Long = VERSION_MAX, _
        '            Optional ByVal Mask As QRCodegenMask = QRCodegenMask_AUTO, _
        '            Optional ByVal BoostEcl As Boolean = True) As StdPicture
    
    ' Set the name of the OLEObject
    img.Name = oleObjectName

    ' Generate the QR code and set it as the picture for the image control
    img.Object.Picture = QRCodegenBarcode(QRText, vbBlack, 75, True, QRCodegenEcc_LOW, 1, 40, QRCodegenMask_AUTO, True)

    ' Set the PictureSizeMode to stretch the image to fit the control
    img.Object.PictureSizeMode = 1 ' fmPictureSizeModeStretch

    ' Remove the border
    img.Object.BorderStyle = fmBorderStyleNone
    
    ' Position the image in the target cell
    img.Left = targetCell.Left
    img.Top = targetCell.Top

End Sub


Function EncryptString(ByVal plainText As String) As String
'    Dim plainText As String
    Dim encryptedText As String
    Dim base64EncryptedText As String
    Dim publicKey As Integer

'    plainText = ";12345;2222;;;;;;;;2025%2D01%2D19;nom;2025%2D01%2D19;1234567;1"
    publicKey = 4 ' Simplified example public key

    ' Encrypt the string
    encryptedText = RSA_Encrypt(plainText, publicKey)

    ' Encode the encrypted string in Base64
    base64EncryptedText = CustomBase64Encode(encryptedText)

    Debug.Print base64EncryptedText
    EncryptString = base64EncryptedText
    
End Function

Function RSA_Encrypt(ByVal plainText As String, ByVal publicKey As Integer) As String
    Dim i As Integer
    Dim charCode As Integer
    Dim encryptedText As String

    For i = 1 To Len(plainText)
        charCode = Asc(Mid(plainText, i, 1))
        charCode = (charCode + publicKey) Mod 256 ' Simplified RSA encryption
        encryptedText = encryptedText & Chr(charCode)
    Next i

    RSA_Encrypt = encryptedText
End Function

Function CustomBase64Encode(ByVal inputString As String) As String
    Dim base64Chars As String
    Dim output As String
    Dim i As Integer
    Dim charCode As Integer
    Dim buffer As Long
    Dim bits As Integer
    Dim chunkSize As Integer
    Dim chunk As String
    Dim j As Integer

    base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    output = ""
    buffer = 0
    bits = 0
    chunkSize = 3 ' Process 3 bytes at a time

    For i = 1 To Len(inputString) Step chunkSize
        chunk = Mid(inputString, i, chunkSize)
        buffer = 0
        bits = 0

        For j = 1 To Len(chunk)
            charCode = Asc(Mid(chunk, j, 1))
            buffer = buffer * 256 + charCode
            bits = bits + 8
        Next j

        Do While bits >= 6
            bits = bits - 6
            output = output & Mid(base64Chars, (buffer \ (2 ^ bits)) Mod 64 + 1, 1)
        Loop

        If bits > 0 Then
            buffer = buffer * (2 ^ (6 - bits))
            output = output & Mid(base64Chars, buffer Mod 64 + 1, 1)
        End If
    Next i

    While Len(output) Mod 4 <> 0
        output = output & "="
    Wend

    CustomBase64Encode = output
End Function




