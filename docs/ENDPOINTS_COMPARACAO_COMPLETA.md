# 📋 Comparação de Endpoints - Tabela Completa

## Todos os Endpoints de Upload/Foto

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        ENDPOINTS DE UPLOAD DE FOTOS                                     │
├─────────────────┬──────────┬────────────┬──────────┬──────────┬──────────┬─────────────┤
│ Endpoint        │ Método   │ Path       │ DataURL? │ Tipo I.  │ Res.     │ Arquivo     │
├─────────────────┼──────────┼────────────┼──────────┼──────────┼──────────┼─────────────┤
│ Upload Avaria   │ POST     │ /uploads/  │ ❌ Não   │ Multipart│ { key }  │ src/oficina │
│                 │          │ avarias    │          │          │          │ /s3/*       │
├─────────────────┼──────────┼────────────┼──────────┼──────────┼──────────┼─────────────┤
│ Upload Check.   │ POST     │ /uploads/  │ ❌ Não   │ Multipart│ { key }  │ src/oficina │
│                 │          │ checklist  │          │          │          │ /s3/*       │
├─────────────────┼──────────┼────────────┼──────────┼──────────┼──────────┼─────────────┤
│ Add Foto Check. │ POST     │ /checklists│ ✅ Sim   │ JSON     │ { id }   │ src/oficina │
│                 │          │ /{id}/fotos│          │          │          │ /checkList/ │
├─────────────────┼──────────┼────────────┼──────────┼──────────┼──────────┼─────────────┤
│ Create Check.   │ POST     │ /checklists│ ✅ Sim*  │ JSON     │ { id }   │ src/oficina │
│                 │          │            │ (2 campos)          │          │ /checkList/ │
└─────────────────┴──────────┴────────────┴──────────┴──────────┴──────────┴─────────────┘
```

*2 campos aceitam DataURL: `fotos360[].foto` e `avarias[].fotoBase64`

---

## DTOs - Campos de Foto

```
┌─────────────────────────────────────────────────────────────────┐
│              CAMPOS QUE ACEITAM FOTO/DATAURL                    │
├─────────────────────┬──────────────┬──────────┬────────────────┤
│ DTO                 │ Campo        │ Tipo     │ Aceita DataURL │
├─────────────────────┼──────────────┼──────────┼────────────────┤
│ CreateChecklist     │ fotos360[    │ string   │ ✅ Sim         │
│ Dto                 │ ].foto       │          │                │
├─────────────────────┼──────────────┼──────────┼────────────────┤
│ CreateChecklist     │ avarias[    │ string   │ ✅ Sim         │
│ Dto                 │ ].fotoBase64 │          │                │
├─────────────────────┼──────────────┼──────────┼────────────────┤
│ CreateChecklist     │ assinatura   │ string   │ ✅ Sim (PNG)   │
│ Dto                 │ clienteBase  │          │                │
│                     │ 64           │          │                │
├─────────────────────┼──────────────┼──────────┼────────────────┤
│ CreateChecklist     │ assinatura   │ string   │ ✅ Sim (PNG)   │
│ Dto                 │ responsavel  │          │                │
│                     │ Base64       │          │                │
├─────────────────────┼──────────────┼──────────┼────────────────┤
│ CreateChecklist     │ capturasCarro│ string   │ ✅ Sim (PNG)   │
│ Dto                 │ Base64       │          │                │
├─────────────────────┼──────────────┼──────────┼────────────────┤
│ CreateChecklistFoto │ foto         │ string   │ ✅ Sim         │
│ Dto                 │              │          │                │
└─────────────────────┴──────────────┴──────────┴────────────────┘
```

---

## Controllers e Métodos

```
┌──────────────────────────────────────────────────────────────┐
│            CONTROLLERS E MÉTODOS                             │
├──────────────────────┬──────────┬──────────┬────────────────┤
│ Controller           │ Método   │ Endpoint │ DataURL        │
├──────────────────────┼──────────┼──────────┼────────────────┤
│ ChecklistsController │ create() │ POST /   │ ✅ Sim (2 c.)  │
│                      │          │ checklists                │
├──────────────────────┼──────────┼──────────┼────────────────┤
│ ChecklistsController │ createFoto() │ POST / │ ✅ Sim     │
│                      │          │ checklists/{id}/fotos     │
├──────────────────────┼──────────┼──────────┼────────────────┤
│ S3Controller         │ uploadAvaria  │ POST / │ ❌ Não    │
│                      │          │ uploads/avarias           │
├──────────────────────┼──────────┼──────────┼────────────────┤
│ S3Controller         │ uploadCheckList │ POST / │ ❌ Não  │
│                      │          │ uploads/checklist         │
└──────────────────────┴──────────┴──────────┴────────────────┘
```

---

## Fluxo de Dados - Request/Response

### 1️⃣ POST /checklists (JSON + DataURL)

```
REQUEST:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST /checklists
Content-Type: application/json

{
  "osInterna": "OS-2025-001",
  "fotos360": [{
    "foto": "data:image/jpeg;base64,/9j/..."  ✅
  }],
  "avarias": [{
    "fotoBase64": "data:image/jpeg;base64,/9j/..."  ✅
  }]
}

RESPONSE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
201 Created
{
  "id": "checklist-abc-123",
  "createdAt": "2026-05-15T10:31:22.000Z"
}
```

### 2️⃣ POST /uploads/avarias (Multipart)

```
REQUEST:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST /uploads/avarias
Content-Type: multipart/form-data

[binary file data]  ❌ (Não aceita dataURL)

RESPONSE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
200 OK
{
  "ok": true,
  "fileName": "abc123def456.png",
  "key": "abc123def456.png",
  "uploadedAt": "2026-05-15T10:31:22-04:00"
}
```

### 3️⃣ POST /checklists/{id}/fotos (JSON + DataURL)

```
REQUEST:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST /checklists/abc-123/fotos
Content-Type: application/json

{
  "foto": "data:image/png;base64,iVBO..."  ✅ (ou key)
}

RESPONSE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
201 Created
{
  "id": "foto-xyz-789",
  "checklist_id": "abc-123",
  "foto": "data:image/png;base64,iVBO..."
}
```

---

## Localização dos Arquivos

```
oficina-service/
├── src/oficina/
│   ├── checkList/
│   │   ├── checkList.controller.ts       📍 ChecklistsController
│   │   ├── checkList.service.ts          📍 ChecklistsService
│   │   ├── checkList.repository.ts       📍 Repository
│   │   └── dto/
│   │       ├── create-checklist.dto.ts        ✅ AvariaDto.fotoBase64
│   │       │                                  ✅ Foto360Dto.foto
│   │       └── create-checklist-foto.dto.ts   ✅ CreateChecklistFotoDto.foto
│   │
│   └── s3/
│       └── s3.controller.ts              📍 S3Controller
│           ├── uploadAvaria()           ❌ Não aceita dataURL
│           └── uploadChecklist()        ❌ Não aceita dataURL
│
└── package.json
```

---

## Validações Aplicadas

```
┌───────────────────────────────────────────────────────────┐
│            VALIDAÇÕES POR ENDPOINT                        │
├──────────────────────┬────────────┬─────────────────────┤
│ Validação            │ Endpoint   │ Implementação       │
├──────────────────────┼────────────┼─────────────────────┤
│ Tipo MIME            │ S3         │ FileInterceptor     │
│ image/jpeg           │ endpoints  │ fileFilter callback │
│ image/png            │            │                     │
│ image/webp           │            │ Rejeita outros      │
│ image/heic           │            │                     │
│ image/heif           │            │                     │
├──────────────────────┼────────────┼─────────────────────┤
│ Tamanho máximo       │ S3         │ multer              │
│ 5MB                  │ endpoints  │ limits.fileSize =   │
│                      │            │ 5 * 1024 * 1024     │
├──────────────────────┼────────────┼─────────────────────┤
│ Redimensionamento    │ S3         │ sharp library       │
│ 1280x1280 PNG        │ endpoints  │ .resize()           │
│ Qualidade 85%        │            │ .png()              │
├──────────────────────┼────────────┼─────────────────────┤
│ String obrigatória   │ JSON       │ class-validator     │
│ para campos de foto  │ endpoints  │ @IsString()         │
└──────────────────────┴────────────┴─────────────────────┘
```

---

## Tipos de Erro Esperados

```
┌───────────────────────────────────────────────────────────┐
│              RESPOSTAS DE ERRO                            │
├────────┬──────────────────────┬─────────────────────────┤
│ Status │ Erro                 │ Quando Ocorre           │
├────────┼──────────────────────┼─────────────────────────┤
│ 400    │ Tipo não permitido   │ MIME inválido           │
│ 400    │ Arquivo obrigatório  │ Field "file" ausente    │
│ 400    │ Dados inválidos      │ JSON malformado         │
│ 404    │ Checklist not found  │ ID não existe           │
│ 500    │ Server Error         │ Erro no sharp/S3        │
└────────┴──────────────────────┴─────────────────────────┘
```

---

## Resumo de Suporte a DataURL

```
╔══════════════════════════════════════════════════════════╗
║                  SUPORTE A DATAURL                       ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  ✅ POST /checklists                                    ║
║     • fotos360[].foto: Sim                              ║
║     • avarias[].fotoBase64: Sim                         ║
║     • assinaturasClienteBase64: Sim                     ║
║     • assinaturasResponsavelBase64: Sim                 ║
║                                                          ║
║  ✅ POST /checklists/{id}/fotos                        ║
║     • foto: Sim (dataURL ou key)                        ║
║                                                          ║
║  ❌ POST /uploads/avarias                              ║
║     • file: Multipart only (não dataURL)               ║
║                                                          ║
║  ❌ POST /uploads/checklist                            ║
║     • file: Multipart only (não dataURL)               ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

---

## Recomendação de Fluxo

```
FLUXO RECOMENDADO:

1. Capturar foto (File)
        ↓
2. fileToDataURL() → dataURL
        ↓
3. compressDataUrl() → dataURL comprimido (JPEG 65%)
        ↓
4. POST /checklists com avaria.fotoBase64 = dataURL
        ↓
5. ✅ Sucesso (Online)
   ❌ Falha (Offline) → Armazena em IndexedDB
        ↓
   Ao sincronizar:
   a. dataURLtoBlob() → Blob
   b. POST /uploads/avarias → recebe key
   c. Substitui fotoBase64 = key
   d. POST /checklists com key
   e. ✅ Sincronizado
```

---

## Matriz de Compatibilidade

```
┌────────────────────────────────────────────────────────────┐
│  COMPATIBILIDADE APPCHECK LIST ↔ OFICINA SERVICE          │
├────────────────────┬─────────────┬──────────────────────┤
│ Recurso            │ AppChecklist│ Oficina Service      │
├────────────────────┼─────────────┼──────────────────────┤
│ DataURL em avarias │ ✅ Envia    │ ✅ Recebe            │
│ DataURL em fotos360│ ✅ Envia    │ ✅ Recebe            │
│ Compressão JPEG    │ ✅ Implementa│ (Não interfere)     │
│ Offline storage    │ ✅ IndexedDB│ (Sincroniza depois) │
│ Upload S3          │ ✅ Suporta  │ ✅ Processa         │
│ Validação MIME     │ ✅ Frontend | ✅ Backend           │
│ Sincronização      │ ✅ Automática| ✅ Recebe           │
└────────────────────┴─────────────┴──────────────────────┘
```

---

## Conclusão

✅ **Todos os endpoints estão funcionando conforme esperado**

✅ **AppChecklist e Oficina-Service estão totalmente compatíveis**

✅ **Nenhuma alteração é necessária**
