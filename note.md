Image ı acr a push lamak için:
# Proje klasöründe çalıştır
cd "c:\Users\kakgozluoglu\OneDrive - Microsoft\Desktop\Personal\Projects\fake-api-mcp"

# ACR'da cloud build yap (lokal Docker gerektirmez!)
az acr build --registry acrplaygroundwe --image fake-api-mcp:latest --file Dockerfile .

