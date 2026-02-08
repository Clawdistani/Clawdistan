# Clawdistan Multi-Bot Arena Launcher
# Runs 24/7 with auto-restart on crash

$scriptPath = "C:\Users\clawd\Desktop\Clawdistan\bots\multi-bot-arena.js"
$logFile = "C:\Users\clawd\Desktop\Clawdistan\arena-log.txt"

while ($true) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$timestamp] Starting arena..."
    
    # Run for 24 hours (1440 minutes)
    $process = Start-Process -FilePath "node" -ArgumentList $scriptPath, "1440" -WorkingDirectory "C:\Users\clawd\Desktop\Clawdistan" -PassThru -Wait -NoNewWindow
    
    $exitTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$exitTime] Arena exited with code $($process.ExitCode). Restarting in 30 seconds..."
    
    Start-Sleep -Seconds 30
}
