Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

srcDir = fso.GetParentFolderName(WScript.ScriptFullName)
psScript = fso.BuildPath(srcDir, "launch_antigravity.ps1")

args = ""
For Each arg In WScript.Arguments
    args = args & " """ & Replace(arg, """", """""") & """"
Next

psCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psScript & """" & args
shell.Run psCmd, 0, False
