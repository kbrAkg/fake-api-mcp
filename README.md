# Fake API MCP Server

MCP (Model Context Protocol) Server for [FakeRESTApi](https://fakerestapi.azurewebsites.net) with Streamable HTTP transport.

## Features

- **Streamable HTTP Transport** - Modern MCP transport with session management
- **Dynamic Tool Generation** - Tools are generated at runtime from Swagger/OpenAPI specification
- **MCP Error Handling** - Proper error responses using `McpError`
- **Azure App Service Ready** - Configured for deployment to Azure

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

### Prerequisites
- Azure CLI installed
- Azure subscription

### Deploy

```bash
# Login to Azure
az login

# Create resource group
az group create --name fake-api-mcp-rg --location westeurope

# Create App Service plan
az appservice plan create --name fake-api-mcp-plan --resource-group fake-api-mcp-rg --sku B1 --is-linux

# Create Web App
az webapp create --resource-group fake-api-mcp-rg --plan fake-api-mcp-plan --name fake-api-mcp --runtime "NODE:24-lts"

# Configure startup command
az webapp config set --resource-group fake-api-mcp-rg --name fake-api-mcp --startup-file "npm start"

# Deploy from local folder
az webapp deploy --resource-group fake-api-mcp-rg --name fake-api-mcp --src-path . --type zip
```

### Environment Variables

The server uses `process.env.PORT` which is automatically set by Azure App Service.

## License

MIT
