# Generate Species Images using Pollinations.ai
# Free API, no auth needed

$speciesDir = "C:\Users\clawd\Desktop\Clawdistan\public\images\species"

# Species prompts
$species = @{
    "synthari" = "Portrait of an alien crystalline silicon-based lifeform, glowing blue crystals forming a humanoid face, quantum energy patterns, cold ice world background, sci-fi art style, digital painting, detailed, mysterious and intelligent expression, portrait format, dark background"
    
    "velthari" = "Portrait of an ancient humanoid alien with wise ethereal features, silver-white skin, crystal memory shard embedded in forehead, flowing robes, starfield background suggesting galactic travel, melancholic wise expression, sci-fi fantasy art, portrait format"
    
    "krath" = "Portrait of an insectoid alien creature, mantis-like head with compound eyes, bioluminescent green markings, chitinous exoskeleton, jungle forest background, hive-mind species, sci-fi creature design, detailed and slightly intimidating, portrait format"
    
    "mechani" = "Portrait of a sentient robot, humanoid mechanical face with glowing blue optical sensors, metallic silver and gold plating, visible circuitry patterns, industrial background, benevolent machine intelligence, sci-fi android art, portrait format"
    
    "pyronix" = "Portrait of an energy being made of living plasma and fire, humanoid form composed of swirling orange and yellow flames, containment suit visible, volcanic lava world background, sci-fi elemental creature, dynamic and powerful, portrait format"
    
    "aquari" = "Portrait of an elegant aquatic alien, bioluminescent blue-green skin, flowing tentacle-like hair, large dark eyes adapted for deep ocean, coral reef background, graceful underwater creature, sci-fi mermaid-like being, portrait format"
    
    "umbral" = "Portrait of a mysterious shadow being, partially transparent dark form, glowing purple eyes, reality seems to bend around them, cosmic void background, interdimensional entity, ethereal and unsettling, sci-fi horror aesthetic, portrait format"
    
    "terrax" = "Portrait of a proud reptilian warrior alien, scaled green-brown skin, fierce intelligent yellow eyes, ceremonial armor, desert canyon background, warrior-philosopher species, dignified and powerful, sci-fi lizardfolk, portrait format"
    
    "celesti" = "Portrait of an angelic ascended being, luminous white-gold skin, gentle radiant aura, serene peaceful expression, cosmic nebula background, transcendent alien species, beautiful and otherworldly, sci-fi divine being, portrait format"
    
    "voidborn" = "Portrait of an eldritch entity from between galaxies, dark formless shape with countless small stars within, tentacle-like appendages, cosmic horror aesthetic, void of space background, unknowable alien intelligence, Lovecraftian sci-fi, portrait format"
}

Write-Host "Generating species images..." -ForegroundColor Cyan
Write-Host ""

foreach ($name in $species.Keys) {
    $prompt = $species[$name]
    # Use .NET Uri class for encoding
    $encodedPrompt = [uri]::EscapeDataString($prompt)
    $url = "https://image.pollinations.ai/prompt/$encodedPrompt`?width=512&height=512&seed=42&model=flux"
    $outFile = Join-Path $speciesDir "$name.png"
    
    Write-Host "Generating $name..." -ForegroundColor Yellow
    Write-Host "  URL: $url" -ForegroundColor Gray
    
    try {
        # Download the image
        Invoke-WebRequest -Uri $url -OutFile $outFile -TimeoutSec 120
        $size = (Get-Item $outFile).Length / 1KB
        Write-Host "  Saved: $outFile ($([math]::Round($size, 1)) KB)" -ForegroundColor Green
    }
    catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Brief pause between requests to be polite
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "Done! Images saved to $speciesDir" -ForegroundColor Cyan
