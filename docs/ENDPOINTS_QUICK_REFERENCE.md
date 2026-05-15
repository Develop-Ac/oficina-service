# Quick Reference - Endpoints de Upload

## Endpoints Disponíveis

### 1. Upload de Avaria (Arquivo)
```
POST /uploads/avarias
Content-Type: multipart/form-data

Request:
  file: <binary file>

Response:
  {
    "ok": true,
    "fileName": "abc123def456.png",
    "key": "abc123def456.png",
    "uploadedAt": "2026-05-15T10:31:22-04:00",
    "url": "https://s3.example.com/avarias/abc123def456.png?sig=..."
  }
```
**Validações**: MIME type, tamanho máx 5MB  
**Processamento**: Redimensiona para 1280x1280 PNG (qual 85%)

---

### 2. Upload de Checklist (Arquivo)
```
POST /uploads/checklist
Content-Type: multipart/form-data

Request:
  file: <binary file>

Response:
  {
    "ok": true,
    "fileName": "xyz789abc123.png",
    "key": "xyz789abc123.png",
    "uploadedAt": "2026-05-15T10:31:22-04:00",
    "url": "https://s3.example.com/checklist/xyz789abc123.png?sig=..."
  }
```
**Idêntico ao endpoint de avarias**

---

### 3. Adicionar Foto ao Checklist (JSON)
```
POST /checklists/{checklistId}/fotos
Content-Type: application/json

Request:
  {
    "foto": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
  }

Response:
  {
    "id": "abc-123",
    "checklist_id": "def-456",
    "foto": "data:image/png;base64,..."
  }
```
**✅ Aceita dataURL ou key do S3**

---

### 4. Criar Checklist com Fotos 360 e Avarias (JSON)
```
POST /checklists
Content-Type: application/json

Request:
  {
    "osInterna": "OS-2025-001",
    "clienteNome": "João Silva",
    "veiculoPlaca": "ABC-1234",
    "fotos360": [
      {
        "tipo": "foto_360",
        "posicao": "frente",
        "ordem": 1,
        "descricao": "Frente do veículo",
        "foto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD..."
      }
    ],
    "avarias": [
      {
        "tipo": "Riscado",
        "peca": "Porta Dianteira Direita",
        "observacoes": "Risco de ~10cm",
        "posX": 0.3, "posY": 0.65, "posZ": 1.0,
        "normX": 0, "normY": 1, "normZ": 0,
        "fotoBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...",
        "timestamp": 1697800000000
      }
    ]
  }

Response:
  {
    "id": "checklist-abc-123",
    "createdAt": "2026-05-15T10:31:22.000Z"
  }
```
**✅ Ambos os campos (fotos360.foto e avarias.fotoBase64) aceitam dataURL**

---

## DataURL Format

```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA...
data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...
```

### Conversão no Frontend

```javascript
// Arquivo → DataURL
const dataUrl = await fileToDataURL(file);

// DataURL → Comprimido (JPEG 65%)
const comprimido = await compressDataUrl(dataUrl, 1280, 1280, 0.65);

// DataURL → Blob (para upload multipart)
const blob = dataURLtoBlob(dataUrl);
```

---

## Tipos MIME Permitidos

- ✅ image/jpeg
- ✅ image/png
- ✅ image/webp
- ✅ image/heic
- ✅ image/heif

---

## Limites

- **Tamanho máximo**: 5MB
- **Dimensões finais**: 1280x1280 (após redimensionamento)
- **Qualidade**: JPEG 85% (após redimensionamento)

---

## Fluxo Recomendado

### Cenário 1: Online (Criar Checklist + Fotos)
```
1. fileToDataURL(arquivo) → dataURL
2. compressDataUrl(dataURL) → dataURL comprimido
3. POST /checklists { avarias: [{fotoBase64: dataURL}] }
4. ✅ Foto armazenada no banco
```

### Cenário 2: Online (Foto Adicional)
```
1. POST /uploads/checklist { file: Blob }
2. Recebe key: "abc123def456.png"
3. POST /checklists/{id}/fotos { foto: key }
4. ✅ Foto associada
```

### Cenário 3: Offline → Sincronização
```
1. fileToDataURL(arquivo) → dataURL
2. Armazenar no IndexedDB { fotoBase64: dataURL }
3. Ao sincronizar:
   - dataURLtoBlob(dataURL) → Blob
   - POST /uploads/avarias { file: Blob } → recebe key
   - Substituir fotoBase64 = key
   - POST /checklists { avarias: [{fotoBase64: key}] }
4. ✅ Foto sincronizada
```

---

## Respostas de Erro

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Arquivo obrigatório (campo \"file\")",
  "error": "Bad Request"
}
```

### 400 Tipo Inválido
```json
{
  "statusCode": 400,
  "message": "Tipo de arquivo não permitido",
  "error": "Bad Request"
}
```

---

## Códigos HTTP Esperados

| Status | Significado |
|--------|-------------|
| 200 OK | Foto associada com sucesso |
| 201 Created | Checklist ou foto criada |
| 400 Bad Request | Dados inválidos ou arquivo não permitido |
| 404 Not Found | Checklist não encontrado |
| 500 Server Error | Erro no processamento |

---

## Exemplo Completo - JavaScript

```javascript
// 1. Capturar arquivo
const input = document.getElementById('foto-input');
const arquivo = input.files[0];

// 2. Converter para dataURL comprimido
const dataUrl = await fileToDataURL(arquivo);
const comprimido = await compressDataUrl(dataUrl);

// 3. Enviar ao criar checklist
const payload = {
  osInterna: "OS-2025-001",
  avarias: [
    {
      tipo: "Riscado",
      fotoBase64: comprimido  // ✅ dataURL direto
    }
  ]
};

const resp = await fetch('http://api.local/checklists', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

const resultado = await resp.json();
console.log('Checklist criado:', resultado.id);
```

---

## Autenticação

*(Não documentado em detalhes aqui, mas assumido que existe)*

Adicionar headers necessários:
```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer <token>'  // Se necessário
}
```
