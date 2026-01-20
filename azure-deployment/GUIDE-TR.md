# Azure Container Apps - Türkçe Deployment Kılavuzu

Bu kılavuz, müşterinizin Node.js TypeScript uygulamasını Azure Container Apps'e deploy etmek için detaylı adımları içerir.

## 📋 İçindekiler

1. [Ön Hazırlık](#ön-hazırlık)
2. [Hızlı Başlangıç](#hızlı-başlangıç)
3. [Detaylı Deployment Seçenekleri](#detaylı-deployment-seçenekleri)
4. [CI/CD Kurulumu](#cicd-kurulumu)
5. [Monitoring ve Yönetim](#monitoring-ve-yönetim)
6. [Sorun Giderme](#sorun-giderme)

## 🚀 Ön Hazırlık

### Gerekli Araçlar

1. **Azure CLI** - Kurulum:
   ```powershell
   # Windows için
   winget install -e --id Microsoft.AzureCLI
   ```

2. **Docker Desktop** - [İndir](https://www.docker.com/products/docker-desktop/)

3. **Azure Subscription** - Aktif bir Azure aboneliği gerekli

### Azure CLI Login

```powershell
# Azure'a login ol
az login

# Doğru subscription'ı seç
az account list --output table
az account set --subscription "<SUBSCRIPTION_ID>"
```

## 🎯 Hızlı Başlangıç

### Seçenek 1: PowerShell Script ile (EN KOLAY)

```powershell
# Deployment klasörüne git
cd azure-deployment/scripts

# Deploy script'ini çalıştır
.\deploy.ps1 -Environment dev -ResourceGroup "rg-musteri-uygulamasi" -Location "westeurope"
```

Script otomatik olarak:
- ✅ Gerekli Azure kaynaklarını oluşturur
- ✅ Docker image'ını build eder
- ✅ ACR'ye push eder
- ✅ Container App'i deploy eder
- ✅ Health check yapar
- ✅ URL'i gösterir

### Seçenek 2: Azure Portal ile

1. [Azure Portal](https://portal.azure.com)'a git
2. **Container Apps** servisini ara
3. **Create** butonuna tıkla
4. Form alanlarını doldur:
   - Resource Group: Yeni oluştur
   - Container App name: `ca-musteri-app`
   - Region: `West Europe`
   - Container image: Kendi ACR'nizden seçin
5. **Review + Create** → **Create**

## 📦 Detaylı Deployment Seçenekleri

### Manuel Azure CLI ile Deployment

#### 1. Resource Group Oluştur

```powershell
$resourceGroup = "rg-musteri-uygulamasi"
$location = "westeurope"

az group create `
  --name $resourceGroup `
  --location $location
```

#### 2. Container Registry Oluştur

```powershell
$acrName = "acrusteriapp$(Get-Random -Minimum 1000 -Maximum 9999)"

az acr create `
  --resource-group $resourceGroup `
  --name $acrName `
  --sku Basic `
  --admin-enabled true
```

#### 3. Docker Image Build ve Push

```powershell
# ACR'ye login
az acr login --name $acrName

# Image build (proje root dizininde çalıştırın)
docker build -t ${acrName}.azurecr.io/musteri-app:v1 .

# Image push
docker push ${acrName}.azurecr.io/musteri-app:v1
```

#### 4. Container Apps Environment

```powershell
az containerapp env create `
  --name cae-musteri-app `
  --resource-group $resourceGroup `
  --location $location
```

#### 5. Container App Oluştur

```powershell
# ACR credentials
$acrUsername = az acr credential show --name $acrName --query username -o tsv
$acrPassword = az acr credential show --name $acrName --query passwords[0].value -o tsv

# Container App oluştur
az containerapp create `
  --name ca-musteri-app `
  --resource-group $resourceGroup `
  --environment cae-musteri-app `
  --image ${acrName}.azurecr.io/musteri-app:v1 `
  --target-port 3000 `
  --ingress external `
  --registry-server ${acrName}.azurecr.io `
  --registry-username $acrUsername `
  --registry-password $acrPassword `
  --cpu 0.5 `
  --memory 1.0Gi `
  --min-replicas 1 `
  --max-replicas 3
```

### Bicep Template ile Deployment

```powershell
# Deployment
az deployment group create `
  --resource-group $resourceGroup `
  --template-file ./azure-deployment/main.bicep `
  --parameters ./azure-deployment/parameters.json
```

**Avantajları:**
- ✅ Tüm kaynaklar tek komutla oluşturulur
- ✅ Infrastructure as Code (IaC)
- ✅ Tekrar kullanılabilir
- ✅ Version control'e uygun
- ✅ Parametre dosyaları ile farklı ortamlar

## 🔄 CI/CD Kurulumu

### GitHub Actions

#### 1. GitHub Secrets Ekle

Repository → **Settings** → **Secrets and variables** → **Actions**

Eklenecek secrets:

```yaml
AZURE_CREDENTIALS: {Service Principal JSON}
AZURE_SUBSCRIPTION_ID: <subscription-id>
ACR_USERNAME: <acr-username>
ACR_PASSWORD: <acr-password>
```

#### 2. Service Principal Oluştur

```powershell
# Service Principal oluştur
az ad sp create-for-rbac `
  --name "sp-musteri-app-github" `
  --role contributor `
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/$resourceGroup `
  --sdk-auth
```

Çıktıyı `AZURE_CREDENTIALS` olarak ekleyin.

#### 3. Workflow Dosyasını Kopyala

`.github/workflows/deploy.yml` dosyasını kopyalayın:

```powershell
# Workflow dizini oluştur
mkdir -p .github/workflows

# Deploy workflow'unu kopyala
copy azure-deployment\.github\workflows\deploy.yml .github\workflows\
```

#### 4. Push ve Deploy

```powershell
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions deployment workflow"
git push origin main
```

Her `main` veya `develop` branch'ine push'ta otomatik deployment başlar!

### Azure DevOps Pipelines

#### 1. Azure Pipelines Dosyasını Ekle

```powershell
copy azure-deployment\.azdo\azure-pipelines.yml .
```

#### 2. Service Connection Oluştur

1. Azure DevOps → **Project Settings**
2. **Service connections** → **New service connection**
3. **Azure Resource Manager** seç
4. Gerekli bilgileri gir
5. Connection name: `Azure-Service-Connection`

#### 3. Pipeline Oluştur

1. **Pipelines** → **New pipeline**
2. Repository seç (GitHub/Azure Repos)
3. **Existing Azure Pipelines YAML file** seç
4. `azure-pipelines.yml` seç
5. **Run**

## 📊 Monitoring ve Yönetim

### Application Insights Kurulumu

```powershell
# Application Insights oluştur
az monitor app-insights component create `
  --app ai-musteri-app `
  --location $location `
  --resource-group $resourceGroup `
  --application-type web

# Connection string al
$appInsightsConnStr = az monitor app-insights component show `
  --app ai-musteri-app `
  --resource-group $resourceGroup `
  --query connectionString -o tsv

# Container App'e ekle
az containerapp update `
  --name ca-musteri-app `
  --resource-group $resourceGroup `
  --set-env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=$appInsightsConnStr"
```

### Log İzleme

```powershell
# Canlı loglar
az containerapp logs show `
  --name ca-musteri-app `
  --resource-group $resourceGroup `
  --follow

# Son 100 log
az containerapp logs show `
  --name ca-musteri-app `
  --resource-group $resourceGroup `
  --tail 100
```

### Metrics ve Alerts

Azure Portal'dan:
1. Container App → **Monitoring** → **Metrics**
2. Metric seç: CPU, Memory, HTTP Requests, Response Time
3. **New alert rule** ile uyarı oluştur

### Scaling Ayarları

```powershell
# Manuel scaling
az containerapp update `
  --name ca-musteri-app `
  --resource-group $resourceGroup `
  --min-replicas 2 `
  --max-replicas 10

# HTTP scaling rule ekle
az containerapp update `
  --name ca-musteri-app `
  --resource-group $resourceGroup `
  --scale-rule-name http-rule `
  --scale-rule-type http `
  --scale-rule-http-concurrency 50
```

## 🔧 Sorun Giderme

### Container Başlamıyor

```powershell
# Revision'ları listele
az containerapp revision list `
  --name ca-musteri-app `
  --resource-group $resourceGroup `
  -o table

# Spesifik revision logları
az containerapp logs show `
  --name ca-musteri-app `
  --resource-group $resourceGroup `
  --revision <REVISION_NAME>
```

### Image Pull Hataları

```powershell
# ACR'ye erişimi test et
az acr login --name $acrName

# Image'ları listele
az acr repository list --name $acrName -o table

# ACR credentials'ı yenile
$acrPassword = az acr credential show --name $acrName --query passwords[0].value -o tsv

az containerapp registry set `
  --name ca-musteri-app `
  --resource-group $resourceGroup `
  --server ${acrName}.azurecr.io `
  --username $acrUsername `
  --password $acrPassword
```

### SSL/TLS Sertifika

```powershell
# Custom domain ekle
az containerapp hostname add `
  --name ca-musteri-app `
  --resource-group $resourceGroup `
  --hostname "app.musteridomaini.com"

# Managed certificate oluştur
az containerapp ssl upload `
  --name ca-musteri-app `
  --resource-group $resourceGroup `
  --hostname "app.musteridomaini.com" `
  --certificate-file ./cert.pfx `
  --password "certpassword"
```

### Health Check Başarısız

Container'ın `/health` endpoint'i olmalı. Kontrol:

```powershell
# App URL al
$appUrl = az containerapp show `
  --name ca-musteri-app `
  --resource-group $resourceGroup `
  --query properties.configuration.ingress.fqdn -o tsv

# Health check test
curl "https://${appUrl}/health"
```

## 💰 Maliyet Optimizasyonu

### Development Ortamı
```powershell
# Min replicas 0 (scale to zero)
az containerapp update `
  --name ca-musteri-app-dev `
  --resource-group $resourceGroup `
  --min-replicas 0 `
  --max-replicas 3 `
  --cpu 0.25 `
  --memory 0.5Gi
```

### Production Ortamı
```powershell
# Min replicas 2 (high availability)
az containerapp update `
  --name ca-musteri-app-prod `
  --resource-group $resourceGroup `
  --min-replicas 2 `
  --max-replicas 10 `
  --cpu 1.0 `
  --memory 2.0Gi
```

### Maliyet Hesaplama

- **Free tier**: 180,000 vCPU-saniye + 360,000 GiB-saniye/ay
- **CPU**: ~$0.000012/vCPU-saniye
- **Memory**: ~$0.000001333/GiB-saniye

Örnek (0.5 vCPU, 1GB, 7/24):
- Aylık maliyet: ~$30-40

## 🗑️ Temizlik (Cleanup)

### Script ile
```powershell
.\azure-deployment\scripts\cleanup.ps1 -ResourceGroup $resourceGroup
```

### Manuel
```powershell
# Resource group'u sil (tüm kaynaklar silinir)
az group delete --name $resourceGroup --yes --no-wait
```

## 📚 Ek Kaynaklar

- [Azure Container Apps Dokümantasyonu](https://learn.microsoft.com/azure/container-apps/)
- [Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)
- [GitHub Actions Azure Login](https://github.com/marketplace/actions/azure-login)
- [Container Apps Best Practices](https://learn.microsoft.com/azure/container-apps/best-practices)

## 💡 İpuçları

1. **Development için scale-to-zero kullanın** (maliyet tasarrufu)
2. **Application Insights'ı mutlaka aktif edin** (monitoring)
3. **Managed Identity kullanın** (güvenlik)
4. **Custom domain ekleyin** (profesyonellik)
5. **CI/CD pipeline kurun** (otomasyon)
6. **Health checks ekleyin** (güvenilirlik)
7. **Resource tags kullanın** (organizasyon)

## 🎓 Müşteriye Teslim Checklist

- [ ] Azure kaynakları oluşturuldu
- [ ] Container App deploy edildi
- [ ] Health check çalışıyor
- [ ] Custom domain eklendi (opsiyonel)
- [ ] SSL sertifikası yapılandırıldı
- [ ] Application Insights aktif
- [ ] CI/CD pipeline kuruldu
- [ ] Alert'ler yapılandırıldı
- [ ] Dokümantasyon teslim edildi
- [ ] Müşteri eğitimi yapıldı

## 📞 Destek

Sorularınız için:
- Azure Support Portal
- Microsoft Q&A
- Stack Overflow (tag: azure-container-apps)
