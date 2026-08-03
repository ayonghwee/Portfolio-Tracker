@echo off
cd /d "%~dp0"
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\objects\maintenance.lock" 2>nul
del /f /q ".git\index.lock" 2>nul
for /r ".git" %%f in (*.lock) do del /f /q "%%f" 2>nul
echo All lock files removed.
pause
