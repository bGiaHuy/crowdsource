@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==============================================
echo Khởi động Hệ thống FPTU Student Guild (Admin)
echo ==============================================

echo [1/3] Đang khoi dong Backend API (Port 8000)...
start "Backend API" cmd /k "cd backend && .venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo [2/3] Đang khoi dong Frontend Web...
start "Frontend Web" cmd /k "cd frontend && npm run dev"

echo [3/3] Đang cho server khoi dong (10 giay)...
timeout /t 10 /nobreak >nul

echo Dang mo trinh duyet vao trang Admin...
start http://localhost:5173/admin

echo ==============================================
echo Hoan tat! 
echo Neu cong 5173 bi chiem dung, hay kiem tra cua so 
echo Frontend de xem cong (port) chinh xac va tu go
echo http://localhost:[port]/admin nhe.
echo ==============================================
pause
