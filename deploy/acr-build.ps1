param(
    [Parameter(Mandatory=$true)]
    [string]$AcrName,
    
    [Parameter(Mandatory=$false)]
    [string]$ImageTag = "latest"
)

$ErrorActionPreference = "Stop"

$ImageName = "fake-api-mcp"
$FullImageName = "$AcrName.azurecr.io/${ImageName}:${ImageTag}"

Write-Host "🔐 ACR'a giriş yapılıyor: $AcrName" -ForegroundColor Cyan
az acr login --name $AcrName

Write-Host "🏗️ Image build ediliyor: $FullImageName" -ForegroundColor Cyan
$ProjectRoot = Split-Path -Parent $PSScriptRoot
docker build -t $FullImageName $ProjectRoot

Write-Host "🚀 Image push ediliyor: $FullImageName" -ForegroundColor Cyan
docker push $FullImageName

Write-Host "✅ Tamamlandı! Image: $FullImageName" -ForegroundColor Green
