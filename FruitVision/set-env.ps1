# FruitVision: konfigurasi lokasi untuk jendela PowerShell INI.
# Jalankan dengan "dot-sourcing" (perhatikan titik + spasi di depan):   . .\set-env.ps1
# Hanya dua baris di bawah yang perlu Anda ubah bila lokasi berbeda.
$FV_WORKSPACE = "D:\Tugas\Semester 5\Pengolahan Citra\Projek 2\FruitVision_Workspace"   # SATU folder: data, cache, model, hasil
$FV_DATASET   = "D:\Tugas\Semester 5\Pengolahan Citra\Projek 2\Dataset\Original Image"  # dataset ASLI (hanya dibaca)

$env:FRUITVISION_HOME = $FV_WORKSPACE
$env:FRUITVISION_RAW  = $FV_DATASET
# Hapus variabel lokasi lama (mis. D:\FruitVision\...) bila masih tersisa di jendela ini, karena akan menimpa FRUITVISION_HOME.
foreach ($v in "FRUITVISION_DATA", "FRUITVISION_CACHE", "FRUITVISION_ARTIFACTS", "FRUITVISION_RESULTS", "FRUITVISION_EXPECTED") {
    Remove-Item "Env:$v" -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force -Path $FV_WORKSPACE | Out-Null

Write-Host "FruitVision workspace : $FV_WORKSPACE" -ForegroundColor Green
Write-Host "  data\  cache\  artifacts\  results\  (dibuat otomatis di dalamnya)"
Write-Host "Dataset (hanya baca)   : $FV_DATASET"
if (-not (Test-Path -LiteralPath $FV_DATASET)) { Write-Host "PERINGATAN: folder dataset belum ada: $FV_DATASET" -ForegroundColor Yellow }
