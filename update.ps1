# update.ps1 - Stage, commit and push all changes to GitHub
# Usage: .\update.ps1
# Usage with message: .\update.ps1 "your commit message"

param(
    [string]$message = ""
)

if ($message -eq "") {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $message = "Update: $timestamp"
}

Write-Host "Staging all changes..." -ForegroundColor Cyan
git add .

Write-Host "Committing: $message" -ForegroundColor Cyan
git commit -m $message

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push origin main

Write-Host "Done! Changes pushed to GitHub." -ForegroundColor Green
