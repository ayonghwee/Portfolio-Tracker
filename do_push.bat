@echo off
cd /d "%~dp0"

:: Find GitHub Desktop's bundled git
for /f "delims=" %%i in ('dir /b /ad "%LOCALAPPDATA%\GitHubDesktop" 2^>nul ^| findstr /i "app-" ^| sort /r') do (
  if exist "%LOCALAPPDATA%\GitHubDesktop\%%i\resources\app\git\cmd\git.exe" (
    set GH_APP=%%i
    goto :found
  )
)
:found
set GIT="%LOCALAPPDATA%\GitHubDesktop\%GH_APP%\resources\app\git\cmd\git.exe"

:: Remove ALL lock files
for /r ".git" %%f in (*.lock) do del /f /q "%%f" 2>nul

:: Stage all changes
%GIT% add -A

:: Show status
%GIT% status --short

:: Prompt for commit message
echo.
set /p MSG=Commit message (leave blank to just push):
if "%MSG%"=="" goto :push
%GIT% commit -m "%MSG%"

:push
%GIT% push
echo.
echo Done! Press any key to close.
pause
