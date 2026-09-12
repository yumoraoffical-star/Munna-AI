param(
    [string]$msg = ""
)

Write-Host "================================================================" -ForegroundColor Yellow
Write-Host "          👑 MUNNA AI - ONE-CLICK VERCEL DEPLOYER 👑" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Yellow
Write-Host ""

# 1. Check Git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Git nahi mila! Kripya Git install karein." -ForegroundColor Red
    return
}

# 2. Commit message prompt if not passed as param
if ([string]::IsNullOrWhiteSpace($msg)) {
    $defaultMsg = "update: Munna AI auto-deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    $inputMsg = Read-Host "Commit message likhein [Default: '$defaultMsg']"
    if ([string]::IsNullOrWhiteSpace($inputMsg)) {
        $msg = $defaultMsg
    } else {
        $msg = $inputMsg
    }
}

# 3. Get current branch
$branch = git branch --show-current
if ([string]::IsNullOrWhiteSpace($branch)) { $branch = "main" }

Write-Host "`n[1/3] Staging changes..." -ForegroundColor Cyan
git add .

Write-Host "[2/3] Committing with message: '$msg'..." -ForegroundColor Cyan
git commit -m "$msg"

Write-Host "[3/3] Pushing to origin/$branch..." -ForegroundColor Cyan
git push origin $branch

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n================================================================" -ForegroundColor Green
    Write-Host "   ✅ SAFALTA! GitHub push successful!" -ForegroundColor Green
    Write-Host "   🚀 Vercel ab automatically site live kar raha hai!" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host "Live URL: https://munnaai.youmika.site`n" -ForegroundColor Yellow
} else {
    Write-Host "`n[ERROR] Git push fail ho gaya. Internet connection check karein." -ForegroundColor Red
}
