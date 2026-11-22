
# ==========================================
# FRUITVISION - RUN ALL
# Menjalankan Backend + Frontend + Browser
# ==========================================

$root = $PSScriptRoot

# Sesuaikan dengan alamat frontend kamu
$frontendUrl = "http://127.0.0.1:5173"

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "       FRUITVISION STARTING         " -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# 1. Jalankan Backend
Write-Host "`n[1/3] Starting Backend..." -ForegroundColor Yellow

Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command",
    "Set-Location '$root'; .\run-backend.ps1"
)

# 2. Jalankan Frontend
Write-Host "[2/3] Starting Frontend..." -ForegroundColor Yellow

Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command",
    "Set-Location '$root'; .\run-frontend.ps1"
)

# 3. Tunggu sampai Frontend siap
Write-Host "`n[3/3] Waiting for Frontend..." -ForegroundColor Yellow

$timeout = 60
$elapsed = 0
$ready = $false

while ($elapsed -lt $timeout) {
    try {
        $response = Invoke-WebRequest `
            -Uri $frontendUrl `
            -UseBasicParsing `
            -TimeoutSec 2

        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
            $ready = $true
            break
        }
    }
    catch {
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
}

# 4. Buka Browser
if ($ready) {
    Write-Host "`nFruitVision is ready!" -ForegroundColor Green
    Write-Host "Frontend: $frontendUrl" -ForegroundColor Green
    Write-Host "Backend : http://127.0.0.1:8000" -ForegroundColor Green

    Start-Process $frontendUrl
}
else {
    Write-Host "`nFrontend belum merespons setelah $timeout detik." -ForegroundColor Red
    Write-Host "Periksa terminal frontend dan alamat URL." -ForegroundColor Yellow
}

Write-Host "`nFruitVision startup process finished." -ForegroundColor Cyan
