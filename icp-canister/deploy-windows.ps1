# Paramify ICP Canister Deployment Script for Windows
# Run this script in Windows PowerShell

Write-Host "🚀 Starting Paramify ICP Canister deployment for Windows..." -ForegroundColor Green

# Check if WSL is installed
Write-Host "Checking for WSL..." -ForegroundColor Yellow
try {
    wsl --status | Out-Null
    Write-Host "✅ WSL detected" -ForegroundColor Green
} catch {
    Write-Host "❌ WSL not found. Please install WSL first." -ForegroundColor Red
    Write-Host "Run: wsl --install" -ForegroundColor Yellow
    exit 1
}

# Function to run commands in WSL
function Run-InWSL {
    param($Command)
    wsl bash -c $Command
}

# Enter WSL and navigate to project directory
Write-Host "`n📁 Entering WSL environment..." -ForegroundColor Yellow

# Convert Windows path to WSL path
$windowsPath = Get-Location
$wslPath = $windowsPath -replace '\\', '/' -replace 'C:', '/mnt/c'
$canisterPath = "$wslPath/icp-canister"

Write-Host "Project path in WSL: $canisterPath" -ForegroundColor Cyan

# Check if dfx is installed in WSL [[memory:6920894]]
Write-Host "`n🔍 Checking for dfx installation in WSL..." -ForegroundColor Yellow
$dfxCheck = Run-InWSL "which dfx"
if (-not $dfxCheck) {
    Write-Host "❌ dfx not found in WSL. Installing..." -ForegroundColor Red
    Run-InWSL "sh -ci `"`$(curl -fsSL https://internetcomputer.org/install.sh)`""
} else {
    Write-Host "✅ dfx is installed" -ForegroundColor Green
}

# Start dfx in the background
Write-Host "`n🔄 Starting local Internet Computer replica..." -ForegroundColor Yellow
Run-InWSL "cd $canisterPath && dfx start --clean --background"

# Wait for replica to start
Write-Host "⏳ Waiting for replica to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Deploy the canister
Write-Host "`n📦 Building and deploying the canister..." -ForegroundColor Yellow
$deployResult = Run-InWSL "cd $canisterPath && dfx deploy 2>&1"
Write-Host $deployResult

# Extract canister ID
$canisterId = Run-InWSL "cd $canisterPath && dfx canister id paramify_insurance 2>/dev/null"
if ($canisterId) {
    Write-Host "`n✅ Canister deployed successfully!" -ForegroundColor Green
    Write-Host "📍 Canister ID: $canisterId" -ForegroundColor Cyan
    
    # Get principal
    $principal = Run-InWSL "cd $canisterPath && dfx identity get-principal"
    Write-Host "👤 Admin Principal: $principal" -ForegroundColor Cyan
    
    # Save to environment file
    $envContent = @"
CANISTER_ID=$canisterId
ADMIN_PRINCIPAL=$principal
NETWORK=local
"@
    $envContent | Out-File -FilePath "icp-canister\.env" -Encoding UTF8
    Write-Host "`n💾 Environment variables saved to icp-canister\.env" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to get canister ID" -ForegroundColor Red
}

Write-Host "`n🎉 Deployment complete!" -ForegroundColor Green
Write-Host "`nTo interact with the canister, use WSL:" -ForegroundColor Yellow
Write-Host "  wsl" -ForegroundColor Cyan
Write-Host "  cd $canisterPath" -ForegroundColor Cyan
Write-Host "  dfx canister call paramify_insurance get_policy_stats" -ForegroundColor Cyan

Write-Host "`nTo stop the local replica:" -ForegroundColor Yellow
Write-Host "  wsl -e dfx stop" -ForegroundColor Cyan

