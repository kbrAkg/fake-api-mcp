# Azure Container Apps Deployment Guide

Bu guide, Node.js TypeScript uygulamanızı Azure Container Apps'e deploy etmek için adım adım talimatlar içerir.

## Ön Gereksinimler

- Azure CLI yüklü ve yapılandırılmış
- Docker Desktop yüklü
- Azure subscription
- GitHub hesabı (CI/CD için)

## Deployment Seçenekleri

### Seçenek 1: Azure CLI ile Manuel Deployment

#### Adım 1: Azure CLI Login
```bash
az login
az account set --subscription "<SUBSCRIPTION_ID>"
```

#### Adım 2: Resource Group Oluşturma
```bash
az group create \
  --name rg-fake-api-mcp \
  --location westeurope
```

#### Adım 3: Azure Container Registry (ACR) Oluşturma
```bash
az acr create \
  --resource-group rg-fake-api-mcp \
  --name acrfakeapimcp \
  --sku Basic \
  --admin-enabled true
```

#### Adım 4: Docker Image Build & Push
```bash
# ACR'ye login
az acr login --name acrfakeapimcp

# Image build
docker build -t acrfakeapimcp.azurecr.io/fake-api-mcp:latest .

# Image push
docker push acrfakeapimcp.azurecr.io/fake-api-mcp:latest
```

#### Adım 5: Container Apps Environment Oluşturma
```bash
az containerapp env create \
  --name cae-fake-api-mcp \
  --resource-group rg-fake-api-mcp \
  --location westeurope
```

#### Adım 6: Container App Oluşturma
```bash
# ACR credentials al
ACR_USERNAME=$(az acr credential show --name acrfakeapimcp --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name acrfakeapimcp --query passwords[0].value -o tsv)

# Container App oluştur
az containerapp create \
  --name ca-fake-api-mcp \
  --resource-group rg-fake-api-mcp \
  --environment cae-fake-api-mcp \
  --image acrfakeapimcp.azurecr.io/fake-api-mcp:latest \
  --target-port 3000 \
  --ingress external \
  --registry-server acrfakeapimcp.azurecr.io \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --cpu 0.5 \
  --memory 1.0Gi \
  --min-replicas 1 \
  --max-replicas 3
```

### Seçenek 2: Bicep Infrastructure as Code

#### Bicep Template ile Deployment
```bash
# Bicep template deploy et
az deployment group create \
  --resource-group rg-fake-api-mcp \
  --template-file ./azure-deployment/main.bicep \
  --parameters ./azure-deployment/parameters.json
```

### Seçenek 3: GitHub Actions CI/CD

1. GitHub repository'nizi açın
2. **Settings** > **Secrets and variables** > **Actions**
3. Aşağıdaki secrets'ı ekleyin:
   - `AZURE_CREDENTIALS`: Service Principal credentials (JSON)
   - `AZURE_SUBSCRIPTION_ID`: Azure subscription ID
   - `ACR_USERNAME`: ACR kullanıcı adı
   - `ACR_PASSWORD`: ACR şifresi

#### Service Principal Oluşturma
```bash
az ad sp create-for-rbac \
  --name "sp-fake-api-mcp-github" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/rg-fake-api-mcp \
  --sdk-auth
```

Çıktıyı `AZURE_CREDENTIALS` secret'ına ekleyin.

4. `.github/workflows/deploy.yml` dosyasını repository'nize push edin
5. Her push'ta otomatik deployment başlayacak

## Deployment Sonrası

### URL'i Kontrol Etme
```bash
az containerapp show \
  --name ca-fake-api-mcp \
  --resource-group rg-fake-api-mcp \
  --query properties.configuration.ingress.fqdn \
  -o tsv
```

### Logları İzleme
```bash
az containerapp logs show \
  --name ca-fake-api-mcp \
  --resource-group rg-fake-api-mcp \
  --follow
```

### Scaling Ayarları
```bash
az containerapp update \
  --name ca-fake-api-mcp \
  --resource-group rg-fake-api-mcp \
  --min-replicas 2 \
  --max-replicas 5
```

## Monitoring ve Diagnostics

### Application Insights
```bash
# Application Insights workspace ID
WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group rg-fake-api-mcp \
  --workspace-name law-fake-api-mcp \
  --query customerId -o tsv)

# Container App'e bağla
az containerapp update \
  --name ca-fake-api-mcp \
  --resource-group rg-fake-api-mcp \
  --set-env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=secretref:appinsights-connection-string"
```

## Maliyet Optimizasyonu

- **Minimum replicas**: Test ortamı için 0, production için 1
- **CPU/Memory**: İhtiyaca göre 0.25-2.0 vCPU, 0.5-4.0 Gi
- **Free tier**: İlk 180,000 vCPU-seconds/month ve 360,000 GiB-seconds/month ücretsiz

## Güvenlik Best Practices

1. **Managed Identity kullanın**: ACR authentication için
2. **Private networking**: VNET integration
3. **Secrets**: Key Vault integration
4. **HTTPS only**: Ingress configuration
5. **Health probes**: Liveness ve readiness checks

## Troubleshooting

### Container başlamıyor
```bash
# Revision detaylarını kontrol et
az containerapp revision list \
  --name ca-fake-api-mcp \
  --resource-group rg-fake-api-mcp \
  -o table

# Specific revision logs
az containerapp logs show \
  --name ca-fake-api-mcp \
  --resource-group rg-fake-api-mcp \
  --revision <REVISION_NAME>
```

### Image çekilemiyor
```bash
# ACR credentials test
az acr login --name acrfakeapimcp

# Image listele
az acr repository list --name acrfakeapimcp -o table
```

## Cleanup (Kaynakları Silme)

```bash
# Tüm resource group'u sil
az group delete --name rg-fake-api-mcp --yes --no-wait
```

## Ek Kaynaklar

- [Azure Container Apps Documentation](https://learn.microsoft.com/azure/container-apps/)
- [Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)
- [Best Practices](https://learn.microsoft.com/azure/container-apps/best-practices)
