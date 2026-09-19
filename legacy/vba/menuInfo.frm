Attribute VB_Name = "menuInfo"
Attribute VB_Base = "0{F34BF758-E716-41A6-920B-07FCDF2D35D2}{631A710D-24A5-440F-AF36-A106F89E8CD3}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = False

'*************************************
'Events
'*************************************
Private Sub UserForm_Initialize()
    SetInitialTab Me
End Sub

Private Sub SetInitialTab(ByVal ctrl As Object)
    Dim i As Integer
    
    If TypeOf ctrl Is multiPage Then
        Dim multiPage As multiPage
        Set multiPage = ctrl
        
        ' Set the initial tab to the first tab
        multiPage.Value = 0
    End If
    
    If TypeOf ctrl Is Control Then
        Dim container As Control
        Set container = ctrl
        
        ' Recursively loop through all controls within the container
        For Each ctrl In container.Controls
            SetInitialTab ctrl
        Next ctrl
    End If
End Sub

'Bouton "Fermer l'aide"
Private Sub CommandButton1_Click()
 
  Unload menuInfo

End Sub
