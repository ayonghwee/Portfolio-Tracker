@echo off
cd /d "%~dp0"

:: Find GitHub Desktop's bundled git (latest app- folder)
for /f "delims=" %%i in ('dir /b /ad "%LOCALAPPDATA%\GitHubDesktop" 2^>nul ^| findstr /i "app-" ^| sort /r') do (
  if exist "%LOCALAPPDATA%\GitHubDesktop\%%i\resources\app\git\cmd\git.exe" (
    set GH_APP=%%i
    goto :found
  )
)
:found
set GIT="%LOCALAPPDATA%\GitHubDesktop\%GH_APP%\resources\app\git\cmd\git.exe"

:: Remove stale lock if present
if exist ".git\index.lock" del /f ".git\index.lock" 2>nul

:: Stage all changes
%GIT% add -A

:: Show status
%GIT% status --short

:: Prompt for commit message
echo.
set /p MSG=Commit message:
if "%MSG%"=="" set MSG=Update

%GIT% commit -m "%MSG%"
%GIT% push
echo.
echo Done! Press any key to close.
pause
