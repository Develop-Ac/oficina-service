# oficina-service — Documentação Técnica

> API NestJS responsável pelo módulo de oficina da intranet AC Acessórios.  
> Gerencia checklists de entrada/saída de veículos, upload de imagens (S3) e ordens de serviço.

---

## Índice

1. [Visão Geral do Módulo](#1-visão-geral-do-módulo)
2. [Stack e Dependências](#2-stack-e-dependências)
3. [Estrutura do Módulo](#3-estrutura-do-módulo)
4. [Arquitetura](#4-arquitetura)
5. [Endpoints da Oficina](#5-endpoints-da-oficina)
6. [Upload de Imagens — Fluxo Completo](#6-upload-de-imagens--fluxo-completo)
7. [Variáveis de Ambiente](#7-variáveis-de-ambiente)
8. [Banco de Dados](#8-banco-de-dados)
9. [Instalação e Execução](#9-instalação-e-execução)
10. [Testes](#10-testes)
11. [Deploy](#11-deploy)
12. [Arquivos de Referência nesta pasta](#12-arquivos-de-referência-nesta-pasta)

---

## 1. Visão Geral do Módulo

Este serviço é o **backend principal** consumido pelo [AppChecklist](../../AppChecklist/docs/README.md). Ele expõe endpoints para:

- **Checklists de veículos**: criação, listagem, fotos, entregas
- **Upload de imagens**: avarias e fotos 360 (armazena no S3, retorna `key`)
- **Ordens de serviço**: vínculo com checklists
- **Leitura de imagens**: proxy de leitura das imagens do S3

A API escuta sob o prefixo global `/oficina`. Todas as rotas abaixo partem desse prefixo.

---

## 2. Stack e Dependências

| Camada | Tecnologia |
|--------|------------|
| Framework | NestJS 10+ |
| Linguagem | TypeScript 5+ |
| ORM | Prisma 5+ |
| Banco | PostgreSQL 15+ |
| Storage | AWS S3 |
| Imagens | sharp (resize/compressão) |
| PDFs | PDFKit |
| Runtime | Node.js 20+ |
| Deploy | Docker / Nixpacks (EasyPanel) |

---

## 3. Estrutura do Módulo

```
src/oficina/
├── checkList/
│   ├── checkList.controller.ts     # Rotas: /checklists
│   ├── checkList.service.ts        # Lógica de negócio
│   ├── checkList.repository.ts     # Acesso ao banco via Prisma
│   └── dto/                        # DTOs de entrada/saída
│       ├── create-checklist.dto.ts
│       ├── create-foto.dto.ts
│       └── ...
└── s3/
    ├── s3.controller.ts            # Rotas: /uploads e /img
    ├── s3.service.ts               # Integração com AWS S3
    └── s3.module.ts
```

---

## 4. Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│                     AppChecklist (PWA)                       │
│  IndexedDB ──► sincronizar ──► fetch                         │
└───────────────────────┬──────────────────────────────────────┘
                        │ HTTP
                        ▼
┌──────────────────────────────────────────────────────────────┐
│           oficina-service  (NestJS)  :3000                   │
│                                                              │
│  POST /oficina/uploads/avarias  ──►  S3Service              │
│  POST /oficina/uploads/checklist ──► S3Service              │
│  POST /oficina/checklists        ──► CheckListService       │
│  GET  /oficina/checklists        ──► CheckListService       │
│  POST /oficina/checklists/:id/fotos ► CheckListService      │
│  POST /oficina/checklists/:id/entregar ► CheckListService   │
│  GET  /oficina/img/:checklistId  ──► S3Service              │
│                                                              │
│          CheckListService ──► CheckListRepository           │
│                                    │                         │
│          S3Service ──► AWS SDK     ▼                         │
│                              PrismaService                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
             ┌──────────┴───────────┐
             ▼                      ▼
      ┌─────────────┐       ┌──────────────┐
      │  PostgreSQL  │       │   AWS S3     │
      │  (Prisma)    │       │  (imagens)   │
      └─────────────┘       └──────────────┘
```

---

## 5. Endpoints da Oficina

> Todos os endpoints têm o prefixo `/oficina` definido em `main.ts`.

### Checklists

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/checklists` | Criar checklist completo com fotos e avarias |
| `GET` | `/checklists` | Listar checklists paginados (query: `page`, `placa`) |
| `GET` | `/checklists/:id` | Buscar checklist por ID |
| `POST` | `/checklists/:id/fotos` | Adicionar foto ao checklist (JSON com base64) |
| `GET` | `/checklists/:id/entrega` | Dados para tela de entrega |
| `POST` | `/checklists/:id/entregar` | Registrar entrega do veículo |

### Upload de Imagens

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/uploads/avarias` | Upload de foto de avaria (multipart) |
| `POST` | `/uploads/checklist` | Upload de foto 360 (multipart) |

### Imagens

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/img/:checklistId` | Listar URLs das imagens de um checklist |

---

## 6. Upload de Imagens — Fluxo Completo

```mermaid
sequenceDiagram
    participant Frontend as AppChecklist
    participant API as oficina-service
    participant S3 as AWS S3

    Frontend->>API: POST /uploads/avarias\nContent-Type: multipart/form-data\nfile: <blob>
    API->>API: Valida MIME (jpeg/png/webp/heic/heif)\nValida tamanho (max 5MB)\nResize sharp → 1280x1280 PNG
    API->>S3: putObject(buffer, key)
    S3-->>API: confirmação
    API-->>Frontend: { ok, key, fileName, uploadedAt, url }

    Frontend->>API: POST /checklists\nBody: { avarias: [{ fotoKey: key }], ... }
    API->>API: Persiste no PostgreSQL
    API-->>Frontend: 201 Created { id, ... }
```

### Parâmetros do endpoint de upload

**Request:**
```
POST /oficina/uploads/avarias
Content-Type: multipart/form-data

file: <binary image>
```

**Response 200:**
```json
{
  "ok": true,
  "fileName": "a1b2c3d4e5f6.png",
  "key": "a1b2c3d4e5f6.png",
  "uploadedAt": "2026-05-15T10:31:22-04:00",
  "url": "https://s3.amazonaws.com/bucket/avarias/a1b2c3d4e5f6.png?..."
}
```

O endpoint `/uploads/checklist` tem comportamento idêntico, mas armazena em pasta separada no S3.

### Endpoint JSON (base64)

Para adicionar fotos a um checklist já criado:

```
POST /oficina/checklists/:id/fotos
Content-Type: application/json

{
  "foto": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

---

## 7. Variáveis de Ambiente

```env
# PostgreSQL
DATABASE_URL="postgresql://user:pass@host:5432/intranet_ac"

# AWS S3
AWS_ACCESS_KEY_ID=sua_access_key
AWS_SECRET_ACCESS_KEY=sua_secret_key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=nome-do-bucket

# Servidor
PORT=3000
NODE_ENV=production

# CORS (separar por vírgula)
CORS_ORIGIN="http://intranet-check-list-app.acacessorios.local"

# Segurança — middleware de token de aplicação
APP_TOKEN=token_secreto_compartilhado_com_frontend

# JWT (para módulos de autenticação)
JWT_SECRET=jwt_secret_muito_seguro
```

---

## 8. Banco de Dados

### Tabelas do módulo de oficina (Prisma schema)

```prisma
model Checklist {
  id              String    @id @default(cuid())
  osInterna       String?
  clienteNome     String
  clienteDoc      String?
  veiculoPlaca    String
  veiculoNome     String
  veiculoCor      String?
  veiculoKm       Int?
  combustivel     Int?
  observacoes     String?
  status          String    @default("aberto")   // aberto | entregue
  criadoEm        DateTime  @default(now())
  fotos           Foto[]
  avarias         Avaria[]
}

model Foto {
  id          String   @id @default(cuid())
  checklistId String
  tipo        String   // "foto_360" | "avaria" | "entrega"
  posicao     String?
  key         String   // chave no S3
  uploadedAt  DateTime
  checklist   Checklist @relation(fields: [checklistId], references: [id])
}

model Avaria {
  id          String   @id @default(cuid())
  checklistId String
  tipo        String   // "Riscado" | "Amassado" | ...
  peca        String
  observacoes String?
  fotoKey     String?  // chave no S3
  posX        Float?
  posY        Float?
  posZ        Float?
  checklist   Checklist @relation(fields: [checklistId], references: [id])
}
```

> Consulte `prisma/schema.prisma` para o schema completo e atualizado.

### Migrations

```bash
# Criar nova migration após alterar o schema
npx prisma migrate dev --name descricao_da_mudanca

# Aplicar migrations em produção
npx prisma migrate deploy
```

---

## 9. Instalação e Execução

```bash
# 1. Instalar dependências
npm install

# 2. Gerar cliente Prisma
npx prisma generate

# 3. Executar migrations (banco deve estar acessível)
npx prisma migrate deploy

# 4. Desenvolvimento (watch mode)
npm run dev

# 5. Build + produção
npm run build
npm run start:prod
```

### Com Docker

```bash
# Build da imagem
docker build -t oficina-service .

# Rodar com variáveis de ambiente
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e AWS_ACCESS_KEY_ID="..." \
  -e AWS_SECRET_ACCESS_KEY="..." \
  oficina-service
```

---

## 10. Testes

```bash
# Unitários
npm run test

# Com coverage
npm run test:cov

# E2E
npm run test:e2e
```

Os mocks do banco estão em `test/mocks/`. O setup global fica em `test/setup.ts`.

---

## 11. Deploy

O projeto usa **Nixpacks** para deploy no EasyPanel (`nixpacks.toml`). A migração do banco é executada automaticamente no start via:

```bash
npm run start:migrate
# equivale a: prisma migrate deploy && node dist/main.js
```

O endpoint fica disponível em `http://oficina-service.acacessorios.local`.

---

## 12. Arquivos de Referência nesta pasta

Os arquivos abaixo são documentos de análise gerados durante sprints de desenvolvimento. Servem como referência histórica e podem ser removidos após revisão:

| Arquivo | Conteúdo |
|---------|----------|
| `ENDPOINTS_ANALISE.md` | Análise detalhada dos endpoints de upload com trechos de código |
| `ENDPOINTS_COMPARACAO_COMPLETA.md` | Comparação completa dos formatos suportados (dataURL vs multipart) |
| `ENDPOINTS_QUICK_REFERENCE.md` | **Referência rápida** dos 3 endpoints de upload com exemplos curl/fetch |
| `ENDPOINTS_SUMARIO_EXECUTIVO.md` | Resumo executivo do suporte a dataURL e multipart |
| `EXEMPLOS_PRATICOS.md` | **Exemplos completos** em JavaScript/fetch para criar checklists com fotos |
| `README_ENDPOINTS.md` | Visão geral dos endpoints de foto |
| `RESULTADO_FINAL.md` | Resultado final da análise de compatibilidade AppChecklist ↔ backend |
| `0_LEIA_PRIMEIRO.md` | Ponto de entrada da análise — leia antes dos outros |

> **Para consulta rápida**: use `ENDPOINTS_QUICK_REFERENCE.md` ou `EXEMPLOS_PRATICOS.md`.
