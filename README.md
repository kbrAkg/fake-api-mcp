# Fake API MCP Server

MCP (Model Context Protocol) Server for [FakeRESTApi](https://fakerestapi.azurewebsites.net) with Streamable HTTP transport.

## Features

- **Streamable HTTP Transport** - Modern MCP transport with session management
- **Dynamic Tool Generation** - Tools are generated at runtime from Swagger/OpenAPI specification
- **MCP Error Handling** - Proper error responses using `McpError`
- **Azure Container Apps Ready** - Containerized deployment with auto-scaling support

## Tools

The server exposes 27 tools generated from the FakeRESTApi endpoints:

### Activities
- `list_activities` - List all Activities
- `get_activity` - Get a single Activity by ID
- `create_activity` - Create a new Activity
- `update_activity` - Update an existing Activity by ID
- `delete_activity` - Delete a Activity by ID

### Authors
- `list_authors` - List all Authors
- `get_author` - Get a single Author by ID
- `get_authors_by_book` - Get Authors by book ID
- `create_author` - Create a new Author
- `update_author` - Update an existing Author by ID
- `delete_author` - Delete a Author by ID

### Books
- `list_books` - List all Books
- `get_book` - Get a single Book by ID
- `create_book` - Create a new Book
- `update_book` - Update an existing Book by ID
- `delete_book` - Delete a Book by ID

### CoverPhotos
- `list_coverphotos` - List all CoverPhotos
- `get_coverphoto` - Get a single CoverPhoto by ID
- `get_coverphotos_by_book` - Get CoverPhotos by book ID
- `create_coverphoto` - Create a new CoverPhoto
- `update_coverphoto` - Update an existing CoverPhoto by ID
- `delete_coverphoto` - Delete a CoverPhoto by ID

### Users
- `list_users` - List all Users
- `get_user` - Get a single User by ID
- `create_user` - Create a new User
- `update_user` - Update an existing User by ID
- `delete_user` - Delete a User by ID

## Installation

```bash
npm install
```

## Development

```bash
# Build TypeScript
npm run build

# Start server
npm start

# Or build and start
npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Server info |
| GET | `/health` | Health check |
| POST | `/mcp` | MCP JSON-RPC requests |
| GET | `/mcp` | SSE stream for notifications |
| DELETE | `/mcp` | Terminate session |

## MCP Client Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "fake-api": {
      "url": "http://localhost:3000/mcp",
      "transport": "streamable-http"
    }
  }
}
```

## Azure Deployment

### 🏆 Önerilen: Azure Container Apps

MCP Server için en uygun deployment seçeneği **Azure Container Apps**'tir:

- ✅ Scale to zero (kullanılmadığında maliyet yok)
- ✅ WebSocket/SSE desteği (MCP için kritik)
- ✅ Otomatik ölçeklendirme

### 1. ACR'a Image Push

```bash
# Azure'a giriş yap
az login

# ACR'a giriş yap
az acr login --name <acr-name>

# Image'ı build et ve push et
cd deploy
.\acr-build.ps1 -AcrName "<acr-name>" -ImageTag "latest"
```

### 2. Container App Oluşturma (Manuel)

```bash
# Resource Group oluştur (yoksa)
az group create --name mcp-server-rg --location westeurope

# Container Apps Environment oluştur
az containerapp env create \
    --name mcp-server-env \
    --resource-group mcp-server-rg \
    --location westeurope

# Container App oluştur
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

### Detaylı Kurulum

Detaylı kurulum adımları için [deploy/README.md](deploy/README.md) dosyasına bakın.

### Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                  Azure Container Apps                        │
│                   (MCP Server - Node.js)                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              FakeRESTApi (External API)                     │
└─────────────────────────────────────────────────────────────┘
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | production |

## License

MIT
