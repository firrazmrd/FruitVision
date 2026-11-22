# Menjalankan antarmuka FruitVision (http://127.0.0.1:5173). Jalankan di JENDELA POWERSHELL TERPISAH dari backend:  .\run-frontend.ps1
Set-Location (Join-Path $PSScriptRoot "frontend")
if (-not (Test-Path -LiteralPath "node_modules")) { Write-Host "Menginstal dependency frontend (sekali saja)..." -ForegroundColor Cyan; npm install }
npm run dev
