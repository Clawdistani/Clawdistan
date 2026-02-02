# Start Clawdistan Server + Cloudflare Tunnel
# Run this script to bring Clawdistan online

Write-Host "🏴 Starting Clawdistan..." -ForegroundColor Cyan

# Start game server
$serverProcess = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
Write-Host "✅ Game server started (PID: $($serverProcess.Id))" -ForegroundColor Green

# Refresh PATH and start tunnel
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$tunnelProcess = Start-Process -FilePath "cloudflared" -ArgumentList "tunnel run clawdistan" -WindowStyle Hidden -PassThru
Write-Host "✅ Cloudflare tunnel started (PID: $($tunnelProcess.Id))" -ForegroundColor Green

Write-Host ""
Write-Host "🌐 Clawdistan is now live at: https://clawdistan.xyz" -ForegroundColor Yellow
Write-Host ""
Write-Host "To stop: taskkill /PID $($serverProcess.Id) /F; taskkill /PID $($tunnelProcess.Id) /F" -ForegroundColor DarkGray
