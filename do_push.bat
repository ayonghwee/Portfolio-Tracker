@echo off
cd /d "%~dp0"
for /f "delims=" %%i in ('dir /b /ad "%LOCALAPPDATA%\GitHubDesktop" 2^>nul ^| findstr /i "app-" ^| sort /r') do (
  if exist "%LOCALAPPDATA%\GitHubDesktop\%%i\resources\app\git\cmd\git.exe" (
    set GH_APP=%%i
    goto :found
  )
)
:found
set GIT="%LOCALAPPDATA%\GitHubDesktop\%GH_APP%\resources\app\git\cmd\git.exe"
%GIT% push
echo.
echo Done! Press any key to close.
pause
