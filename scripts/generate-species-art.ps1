# Generate Species Art using Pollinations.ai (Free, no signup)
# Usage: .\generate-species-art.ps1

$species = @(
    @{ name = "Velthari"; prompt = "portrait of Velthari alien, bioluminescent blue skin, flowing ethereal hair, wise ancient eyes, elegant features, sci-fi game art, dark space background" },
    @{ name = "Krathzul"; prompt = "portrait of Krathzul alien warrior, reptilian scales, fierce red eyes, battle scars, armored, aggressive, sci-fi game art, dark space background" },
    @{ name = "Aquari"; prompt = "portrait of Aquari alien, aquatic humanoid, translucent blue skin, gills, flowing fins, serene expression, underwater aesthetic, sci-fi game art" },
    @{ name = "Terrax"; prompt = "portrait of Terrax alien, rock-like crystalline skin, glowing mineral veins, sturdy powerful, earth tones, sci-fi game art, asteroid background" },
    @{ name = "Synthari"; prompt = "portrait of Synthari android, sleek metallic face, glowing circuit patterns, chrome and blue, precise symmetrical, sci-fi game art, digital background" },
    @{ name = "Mechani"; prompt = "portrait of Mechani robot, industrial mechanical face, gears and pistons, brass and copper, steampunk sci-fi, game art, factory background" },
    @{ name = "Pyronix"; prompt = "portrait of Pyronix fire alien, flames for hair, molten skin, burning eyes, orange and red, intense energy, sci-fi game art, volcanic background" },
    @{ name = "Umbral"; prompt = "portrait of Umbral shadow alien, dark wispy form, glowing purple eyes, mysterious ethereal, void energy, sci-fi game art, dark nebula background" },
    @{ name = "Celesti"; prompt = "portrait of Celesti light being, radiant glowing form, golden light, angelic serene, cosmic energy, sci-fi game art, stellar background" },
    @{ name = "Voidborn"; prompt = "portrait of Voidborn cosmic horror, tentacles, multiple eyes, dark purple, eldritch, otherworldly, sci-fi game art, void background" }
)

$outputDir = "$PSScriptRoot\..\assets\species"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force
}

foreach ($s in $species) {
    $encodedPrompt = [System.Web.HttpUtility]::UrlEncode($s.prompt)
    $url = "https://image.pollinations.ai/prompt/$encodedPrompt`?width=512&height=512&seed=42&model=flux"
    $outFile = "$outputDir\$($s.name.ToLower()).png"
    
    Write-Host "Generating $($s.name)..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri $url -OutFile $outFile -TimeoutSec 120
        Write-Host "  Saved: $outFile" -ForegroundColor Green
    } catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 5  # Rate limiting
}

Write-Host "`nDone! Check $outputDir" -ForegroundColor Yellow
