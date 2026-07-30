# Run the app as the Pesanest tenant on port 3001
# Usage: .\run-pesastack.ps1

Write-Host "Starting Pesanest tenant on http://localhost:3001 ..." -ForegroundColor Cyan

# Load env vars from .env.pesanest
Get-Content .env.pesanest | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim().Trim('"')
        [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

# Set environment variable to trigger alternate distDir in next.config.ts
$env:BUILD_TARGET = "pesanest"

# Run normal dev server
npx next dev -p 3001 -H 0.0.0.0
