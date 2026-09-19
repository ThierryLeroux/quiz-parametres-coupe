Attribute VB_Name = "shRapport"
Attribute VB_Base = "0{00020820-0000-0000-C000-000000000046}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = True
Attribute VB_Control = "Image2, 25, 37, MSForms, Image"
Attribute VB_Control = "Image1, 21, 38, MSForms, Image"
Private Sub Worksheet_Activate()

    shRapport.Application.ActiveWindow.Zoom = 100
    ActiveWindow.ScrollRow = 1
    ActiveWindow.ScrollColumn = 1
    DoEvents
    shRapport.Protect pwd

End Sub

Private Sub Worksheet_Deactivate()

    shRapport.Unprotect pwd
    
End Sub
