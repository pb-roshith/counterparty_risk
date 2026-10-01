# Run the counterparty risk platform

Use two PowerShell terminals from the project root. Start PostgreSQL first; the backend reads its connection settings from `backend/.env`.

## Backend (terminal 1)

Create the Python virtual environment and install dependencies the first time:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

On later runs, activate the existing environment and start the API:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API: http://127.0.0.1:8000/docs

## Frontend (terminal 2)

Install dependencies the first time, then start Vite:

```powershell
cd frontend
npm install
npm run dev
```

On later runs. Frontend: http://127.0.0.1:8080

```powershell
cd frontend
npm run dev
```


If PowerShell blocks virtual environment activation, run this in the backend terminal before activating it:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
