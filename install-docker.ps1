# ============================================================
# Install Docker Desktop on Windows (via winget)
# Run this script in PowerShell as Administrator
# ============================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Digital Library - Docker Setup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is already installed
$dockerPath = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerPath) {
    Write-Host "[OK] Docker is already installed at: $($dockerPath.Source)" -ForegroundColor Green
    docker --version
    Write-Host ""
    Write-Host "You can start the project with:" -ForegroundColor Yellow
    Write-Host "  docker compose up --build" -ForegroundColor White
    exit 0
}

Write-Host "[INFO] Docker Desktop is NOT installed." -ForegroundColor Yellow
Write-Host "[INFO] Attempting to install via winget..." -ForegroundColor Yellow
Write-Host ""

# Check if winget is available
$wingetPath = Get-Command winget -ErrorAction SilentlyContinue
if (-not $wingetPath) {
    Write-Host "[ERROR] winget is not available on this system." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Docker Desktop manually:" -ForegroundColor Yellow
    Write-Host "  1. Go to https://www.docker.com/products/docker-desktop/" -ForegroundColor White
    Write-Host "  2. Download and run the installer" -ForegroundColor White
    Write-Host "  3. Restart your PC after installation" -ForegroundColor White
    Write-Host "  4. Run: docker compose up --build" -ForegroundColor White
    exit 1
}

# Install Docker Desktop
Write-Host "Installing Docker Desktop..." -ForegroundColor Cyan
winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host " Docker Desktop installed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANT: You MUST restart your PC before using Docker." -ForegroundColor Red
    Write-Host ""
    Write-Host "After restarting:" -ForegroundColor Yellow
    Write-Host "  1. Open Docker Desktop and wait for it to start" -ForegroundColor White
    Write-Host "  2. Open a terminal in the project directory" -ForegroundColor White
    Write-Host "  3. Run: docker compose up --build" -ForegroundColor White
    Write-Host "  4. Open http://localhost:5000 in your browser" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "[ERROR] Installation failed." -ForegroundColor Red
    Write-Host "Please install Docker Desktop manually from:" -ForegroundColor Yellow
    Write-Host "  https://www.docker.com/products/docker-desktop/" -ForegroundColor White
}
