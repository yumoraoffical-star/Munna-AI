param(
    [string]$msg = "update: latest improvements"
)

Write-Host "Munna AI - Syncing and Deploying to Vercel..." -ForegroundColor Cyan

# 1. Stage, commit and push to GitHub (triggers automatic Vercel redeploy)
git add .
git commit -m "$msg"
git push origin main

Write-Host ""
Write-Host "Done! Vercel is now automatically updating." -ForegroundColor Green
Write-Host "Live URL: https://munnaai.youmika.site" -ForegroundColor Yellow
