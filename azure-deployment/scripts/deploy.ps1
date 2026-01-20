# ============================================================================
# Azure Container Apps Deployment Script
# PowerShell deployment automation
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'dev',
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = 'rg-fake-api-mcp',
    
    [Parameter(Mandatory=$false)]
    [string]$Location = 'westeurope',
    
    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId = '',
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,
    
    [Parameter(Mandatory=$false)]
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

# ============================================================================
# Variables
# ============================================================================

$AppName = 'fake-api-mcp'
$ImageTag = (Get-Date -Format 'yyyyMMdd-HHmmss')

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Azure Container Apps Deployment" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Resource Group: $ResourceGroup" -ForegroundColor Yellow
Write-Host "Location: $Location" -ForegroundColor Yellow
Write-Host "Image Tag: $ImageTag" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan

# ============================================================================
# Functions
# ============================================================================

function Test-AzureCLI {
    try {
        $azVersion = az version --output json | ConvertFrom-Json
        Write-Host "✓ Azure CLI version: $($azVersion.'azure-cli')" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "✗ Azure CLI not found. Please install: https://aka.ms/install-azure-cli" -ForegroundColor Red
        return $false
    }
}

function Test-DockerCLI {
    try {
        $dockerVersion = docker version --format '{{.Server.Version}}'
        Write-Host "✓ Docker version: $dockerVersion" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "✗ Docker not found. Please install Docker Desktop" -ForegroundColor Red
        return $false
    }
}

function Set-AzureSubscription {
    if ($SubscriptionId) {
        Write-Host "Setting subscription: $SubscriptionId" -ForegroundColor Yellow
        az account set --subscription $SubscriptionId
    }
    
    $currentSub = az account show --output json | ConvertFrom-Json
    Write-Host "✓ Using subscription: $($currentSub.name) ($($currentSub.id))" -ForegroundColor Green
}

function New-ResourceGroupIfNotExists {
    Write-Host "Checking resource group..." -ForegroundColor Yellow
    
    $rgExists = az group exists --name $ResourceGroup
    
    if ($rgExists -eq 'false') {
        Write-Host "Creating resource group: $ResourceGroup" -ForegroundColor Yellow
        if (-not $WhatIf) {
            az group create --name $ResourceGroup --location $Location --output none
        }
        Write-Host "✓ Resource group created" -ForegroundColor Green
    }
    else {
        Write-Host "✓ Resource group exists" -ForegroundColor Green
    }
}

function Build-DockerImage {
    param($AcrName)
    
    if ($SkipBuild) {
        Write-Host "⊘ Skipping Docker build" -ForegroundColor Yellow
        return
    }
    
    Write-Host "Building Docker image..." -ForegroundColor Yellow
    
    $imageName = "$AcrName.azurecr.io/${AppName}:${ImageTag}"
    $imageNameLatest = "$AcrName.azurecr.io/${AppName}:latest"
    
    if (-not $WhatIf) {
        # Build image
        docker build -t $imageName -t $imageNameLatest .
        
        if ($LASTEXITCODE -ne 0) {
            throw "Docker build failed"
        }
        
        Write-Host "✓ Docker image built" -ForegroundColor Green
        
        # Push to ACR
        Write-Host "Pushing image to ACR..." -ForegroundColor Yellow
        docker push $imageName
        docker push $imageNameLatest
        
        if ($LASTEXITCODE -ne 0) {
            throw "Docker push failed"
        }
        
        Write-Host "✓ Image pushed to ACR" -ForegroundColor Green
    }
}

function Deploy-BicepTemplate {
    Write-Host "Deploying Bicep template..." -ForegroundColor Yellow
    
    $parametersFile = ".\azure-deployment\parameters.$Environment.json"
    
    if (-not (Test-Path $parametersFile)) {
        $parametersFile = ".\azure-deployment\parameters.json"
    }
    
    if (-not $WhatIf) {
        $deployment = az deployment group create `
            --resource-group $ResourceGroup `
            --template-file .\azure-deployment\main.bicep `
            --parameters $parametersFile `
            --parameters imageTag=$ImageTag `
            --output json | ConvertFrom-Json
        
        if ($LASTEXITCODE -ne 0) {
            throw "Bicep deployment failed"
        }
        
        Write-Host "✓ Bicep template deployed" -ForegroundColor Green
        return $deployment
    }
}

function Show-DeploymentSummary {
    param($Deployment)
    
    if ($WhatIf) {
        Write-Host "`n⊘ WhatIf mode - no changes made" -ForegroundColor Yellow
        return
    }
    
    Write-Host "`n=============================================" -ForegroundColor Cyan
    Write-Host "Deployment Summary" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    
    $outputs = $Deployment.properties.outputs
    
    Write-Host "Application URL: $($outputs.containerAppUrl.value)" -ForegroundColor Green
    Write-Host "FQDN: $($outputs.containerAppFQDN.value)" -ForegroundColor Yellow
    Write-Host "ACR Login Server: $($outputs.acrLoginServer.value)" -ForegroundColor Yellow
    Write-Host "Container App Name: $($outputs.containerAppName.value)" -ForegroundColor Yellow
    
    if ($outputs.appInsightsConnectionString.value) {
        Write-Host "Application Insights: Enabled" -ForegroundColor Green
    }
    
    Write-Host "=============================================" -ForegroundColor Cyan
    
    # Test health endpoint
    Write-Host "`nTesting health endpoint..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    try {
        $response = Invoke-WebRequest -Uri "$($outputs.containerAppUrl.value)/health" -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "✓ Health check passed" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "⚠ Health check failed (app may still be starting)" -ForegroundColor Yellow
    }
}

# ============================================================================
# Main Execution
# ============================================================================

try {
    # Validate prerequisites
    Write-Host "`nValidating prerequisites..." -ForegroundColor Yellow
    if (-not (Test-AzureCLI)) { exit 1 }
    if (-not (Test-DockerCLI)) { exit 1 }
    
    # Azure setup
    Write-Host "`nConfiguring Azure..." -ForegroundColor Yellow
    Set-AzureSubscription
    New-ResourceGroupIfNotExists
    
    # Get ACR name
    Write-Host "`nGetting ACR details..." -ForegroundColor Yellow
    $acrList = az acr list --resource-group $ResourceGroup --output json | ConvertFrom-Json
    
    if ($acrList.Count -eq 0) {
        throw "No ACR found in resource group. Please create one first or run Bicep deployment."
    }
    
    $acrName = $acrList[0].name
    Write-Host "✓ Using ACR: $acrName" -ForegroundColor Green
    
    # Login to ACR
    if (-not $WhatIf) {
        Write-Host "Logging into ACR..." -ForegroundColor Yellow
        az acr login --name $acrName --output none
        Write-Host "✓ Logged into ACR" -ForegroundColor Green
    }
    
    # Build and push
    Build-DockerImage -AcrName $acrName
    
    # Deploy
    $deployment = Deploy-BicepTemplate
    
    # Summary
    Show-DeploymentSummary -Deployment $deployment
    
    Write-Host "`n✓ Deployment completed successfully!" -ForegroundColor Green
}
catch {
    Write-Host "`n✗ Deployment failed: $_" -ForegroundColor Red
    exit 1
}
