# Menjalankan API FruitVision (http://127.0.0.1:8000). Jalankan dari folder root proyek:  .\run-backend.ps1
$root = $PSScriptRoot
. (Join-Path $root "set-env.ps1")
$activate = Join-Path $root "backend\.venv\Scripts\Activate.ps1"
if (-not (Test-Path -LiteralPath $activate)) { Write-Host "Virtual environment belum ada. Lihat README bagian 'Instalasi backend'." -ForegroundColor Red; exit 1 }
Set-Location (Join-Path $root "backend")
. $activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
