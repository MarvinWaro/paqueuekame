@echo off
rem Double-click to open PaQueueKame in VS Code. The app installs and starts in its terminal.
cd /d "%~dp0"
if not exist ".vscode\tasks.json" (
  mkdir .vscode 2>nul
  copy /y "tasks.vscode.json" ".vscode\tasks.json" >nul
)
code .
