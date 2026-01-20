# ============================================================================
# Azure Resources Cleanup Script
# Cleans up Azure Container Apps resources
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = 'rg-fake-api-mcp',
    
    [Parameter(Mandatory=$false)]
    [switch]$Force,
    
    [Parameter(Mandatory=$false)]
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Azure Resources Cleanup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Resource Group: $ResourceGroup" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan

# Check if resource group exists
$rgExists = az group exists --name $ResourceGroup

if ($rgExists -eq 'false') {
    Write-Host "✓ Resource group does not exist. Nothing to clean up." -ForegroundColor Green
    exit 0
}

# Get resource list
Write-Host "`nResources to be deleted:" -ForegroundColor Yellow
$resources = az resource list --resource-group $ResourceGroup --output json | ConvertFrom-Json

if ($resources.Count -eq 0) {
    Write-Host "No resources found in resource group." -ForegroundColor Yellow
}
else {
    foreach ($resource in $resources) {
        Write-Host "  - $($resource.type): $($resource.name)" -ForegroundColor Red
    }
}

# Confirm deletion
if (-not $Force -and -not $WhatIf) {
    $confirmation = Read-Host "`nAre you sure you want to delete the resource group '$ResourceGroup'? (yes/no)"
    
    if ($confirmation -ne 'yes') {
        Write-Host "Cleanup cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Delete resource group
if ($WhatIf) {
    Write-Host "`n⊘ WhatIf mode - would delete resource group: $ResourceGroup" -ForegroundColor Yellow
}
else {
    Write-Host "`nDeleting resource group..." -ForegroundColor Yellow
    az group delete --name $ResourceGroup --yes --no-wait
    Write-Host "✓ Resource group deletion initiated (async operation)" -ForegroundColor Green
    Write-Host "  You can monitor the deletion in Azure Portal" -ForegroundColor Yellow
}
