@echo off
echo Starting Value Engine...

:: Start Backend
echo Starting Backend...
start "Value Engine Backend" cmd /k "cd backend && ..\venv\Scripts\python -m uvicorn main:app --reload --port 8000"

:: Start Frontend
echo Starting Frontend...
start "Value Engine Frontend" cmd /k "cd frontend && npm run dev"

echo Done! Both servers are starting in separate windows.
