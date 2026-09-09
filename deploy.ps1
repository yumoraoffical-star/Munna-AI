param(
    [string]$msg = "update: latest improvements"
)

Write-Host "👑 Munna AI — Syncing & Deploying to Vercel..." -ForegroundColor Cyan

# 1. Sync CSS and JS from index.html if syncer exists
$syncScript = "C:\Users\megwa\.gemini\antigravity-ide\brain\72e39bb9-118f-46fa-9da4-3e472eaadb7d\scratch\sync_files.ps1"
if (Test-Path $syncScript) {
    powershell -ExecutionPolicy Bypass -File $syncScript
}

# 2. Stage, commit and push to GitHub (triggers instant Vercel redeploy)
git add .
git commit -m "$msg"
git push origin main

Write-Host ""
Write-Host "🚀 Safal! Vercel par live update ho gaya hai!" -ForegroundColor Green
Write-Host "🌐 Live Link: https://munnaai.youmika.site" -ForegroundColor Yellow
