# Azure Container Apps Deployment

Bu klasör, MCP Server'ı Azure Container Apps'e deploy etmek için gerekli dosyaları içerir.

## 📋 Ön Gereksinimler

1. **Azure CLI** yüklü ve giriş yapılmış olmalı
   ```bash
   az login
   ```

2. **Azure Container Registry (ACR)** oluşturulmuş olmalı

## 🚀 ACR'a Image Push

### PowerShell (Windows)
```powershell
# ACR'a giriş yap
az acr login --name <acr-name>

# Image'ı build et ve push et
.\acr-build.ps1 -AcrName "myacr"

# Belirli tag ile
.\acr-build.ps1 -AcrName "myacr" -ImageTag "v1.0.0"
```

## 🔧 Script Parametreleri

| Parametre | Açıklama | Zorunlu |
|-----------|----------|---------|
| AcrName | ACR adı (.azurecr.io olmadan) | ✅ |
| ImageTag | Docker image tag | ❌ (default: latest) |

## 🏗️ Container App Manuel Oluşturma

### 1. Resource Group Oluştur (isteğe bağlı)
```bash
az group create --name mcp-server-rg --location westeurope
```

### 2. Azure Container Registry Oluştur (yoksa)
```bash
az acr create \
    --name <acr-name> \
    --resource-group mcp-server-rg \
    --sku Basic \
    --admin-enabled true
```

### 3. Container Apps Environment Oluştur
```bash
az containerapp env create \
    --name mcp-server-env \
    --resource-group mcp-server-rg \
    --location westeurope
```

### 4. Container App Oluştur
```bash
az containerapp create \
    --name mcp-server \
    --resource-group mcp-server-rg \
    --environment mcp-server-env \
    --image <acr-name>.azurecr.io/fake-api-mcp:latest \
    --target-port 3000 \
    --ingress external \
    --min-replicas 0 \
    --max-replicas 10 \
    --cpu 0.5 \
    --memory 1.0Gi

# ACR'a erişim için identity ekle
az containerapp registry set \
    --name mcp-server \
    --resource-group mcp-server-rg \
    --server <acr-name>.azurecr.io \
    --identity system
```

### 5. Image Güncelleme (Sonraki Deploymentlar)
```bash
# ACR'a yeni image push ettikten sonra
az containerapp update \
    --name mcp-server \
    --resource-group mcp-server-rg \
    --image <acr-name>.azurecr.io/fake-api-mcp:latest
```

## 📊 Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/health` | GET | Health check |
| `/mcp` | POST | MCP JSON-RPC requests |
| `/mcp` | GET | SSE stream (Server-Sent Events) |
| `/mcp` | DELETE | Session termination |

## 🔍 Troubleshooting

### Container App loglarını görüntüle
```bash
az containerapp logs show \
    --name mcp-server \
    --resource-group mcp-server-rg \
    --follow
```

### Container App durumunu kontrol et
```bash
az containerapp show \
    --name mcp-server \
    --resource-group mcp-server-rg \
    --query "{status:properties.runningStatus, fqdn:properties.configuration.ingress.fqdn}"
```

### Revision geçmişini görüntüle
```bash
az containerapp revision list \
    --name mcp-server \
    --resource-group mcp-server-rg \
    --output table
```
