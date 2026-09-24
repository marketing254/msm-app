' Starts the MSM rank worker with no window. Put a shortcut to this file in shell:startup
' so it runs whenever the PC is switched on. Output goes to worker.log in this folder.
' To stop it, double-click "Stop MSM Worker.bat".
Set sh = CreateObject("WScript.Shell")
folder = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.Run """" & folder & "Start MSM Worker.bat"" hidden", 0, False
