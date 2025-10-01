@echo off
echo Starting US Visa Expert System...
echo.

REM Try different Python commands
python --version >nul 2>&1
if not errorlevel 1 goto :python_found

python3 --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python3
    goto :python_found
)

py --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=py
    goto :python_found
)

echo Error: Python is not installed or not in PATH.
echo.
echo Please install Python using one of these methods:
echo 1. Microsoft Store: Search for "Python 3.12" and install
echo 2. Official website: https://www.python.org/downloads/
echo 3. Make sure to check "Add Python to PATH" during installation
echo.
echo After installation, restart this script.
pause
exit /b 1

:python_found
if not defined PYTHON_CMD set PYTHON_CMD=python

echo Found Python! Installing dependencies...
%PYTHON_CMD% -m pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo Error: Failed to install dependencies.
    echo Trying with --user flag...
    %PYTHON_CMD% -m pip install --user -r requirements.txt
    if errorlevel 1 (
        echo Failed to install dependencies. Please check your internet connection.
        pause
        exit /b 1
    )
)

echo.
echo Dependencies installed successfully!
echo.
echo Starting the web server...
echo.
echo The application will be available at: http://localhost:5000
echo Press Ctrl+C to stop the server
echo.

%PYTHON_CMD% app.py

pause