# 🔧 Exemplos Práticos - Utilizando os Endpoints

---

## 1. Criar Checklist com Avarias + Fotos 360 (DataURL)

### JavaScript/Fetch
```javascript
const checklistData = {
  osInterna: "OS-2025-001",
  clienteNome: "João Silva",
  clienteDoc: "123.456.789-00",
  clienteTel: "(11) 99999-9999",
  clienteEnd: "Rua A, 123",
  
  veiculoNome: "Corolla 2020",
  veiculoPlaca: "ABC-1234",
  veiculoCor: "Prata",
  veiculoKm: 50000,
  
  combustivelPercentual: 50,
  observacoes: "Veículo para revisão completa",
  
  // ✅ Fotos 360 com DataURL
  fotos360: [
    {
      tipo: "foto_360",
      posicao: "frente",
      ordem: 1,
      descricao: "Frente do veículo",
      foto: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUD..."
    },
    {
      tipo: "foto_360",
      posicao: "trás",
      ordem: 2,
      descricao: "Trás do veículo",
      foto: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUD..."
    }
  ],
  
  // ✅ Avarias com DataURL em fotoBase64
  avarias: [
    {
      tipo: "Riscado",
      peca: "Porta Dianteira Direita",
      observacoes: "Risco leve de ~10cm",
      posX: 0.3,
      posY: 0.65,
      posZ: 1.0,
      normX: 0,
      normY: 1,
      normZ: 0,
      fotoBase64: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUD...",
      timestamp: Date.now()
    },
    {
      tipo: "Amassado",
      peca: "Para-choque Dianteiro",
      observacoes: "Pequeno amassado",
      posX: 2.5,
      posY: 0.4,
      posZ: 0.0,
      normX: 1,
      normY: 0,
      normZ: 0,
      fotoBase64: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUD...",
      timestamp: Date.now()
    }
  ],
  
  // Itens do checklist
  checklist: [
    { item: "Extintor de Incêndio", status: "OK" },
    { item: "Rádio/CD/DVD", status: "OK" },
    { item: "Tapetes", status: "Avariado" }
  ],
  
  // Assinaturas (também em base64)
  assinaturasclienteBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEA...",
  assinaturasresponsavelBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEA..."
};

// Fazer o request
const response = await fetch('http://api.local/checklists', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(checklistData)
});

const resultado = await response.json();
console.log('Checklist criado:', resultado);
// Response: { id: "abc-123", createdAt: "2026-05-15T10:31:22.000Z" }
```

### cURL
```bash
curl -X POST http://api.local/checklists \
  -H "Content-Type: application/json" \
  -d '{
    "osInterna": "OS-2025-001",
    "clienteNome": "João Silva",
    "veiculoPlaca": "ABC-1234",
    "fotos360": [
      {
        "tipo": "foto_360",
        "posicao": "frente",
        "ordem": 1,
        "foto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD..."
      }
    ],
    "avarias": [
      {
        "tipo": "Riscado",
        "peca": "Porta Direita",
        "fotoBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD..."
      }
    ]
  }'
```

---

## 2. Adicionar Foto a um Checklist Existente

### JavaScript/Fetch
```javascript
const checklistId = "abc-123";  // ID do checklist criado acima

// Opção A: Enviar dataURL diretamente
const fotoData = {
  foto: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ..."
};

const resp = await fetch(`http://api.local/checklists/${checklistId}/fotos`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(fotoData)
});

const resultado = await resp.json();
console.log('Foto adicionada:', resultado);
// Response: { id: "foto-123", checklist_id: "abc-123", foto: "data:image/png;base64,..." }

// Opção B: Enviar key de upload anterior
const fotoDataKey = {
  foto: "xyz789abc123.png"  // Key retornada por /uploads/checklist
};

const resp2 = await fetch(`http://api.local/checklists/${checklistId}/fotos`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(fotoDataKey)
});
```

### cURL
```bash
curl -X POST http://api.local/checklists/abc-123/fotos \
  -H "Content-Type: application/json" \
  -d '{
    "foto": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ..."
  }'
```

---

## 3. Upload de Arquivo (Para Obter Key)

### JavaScript/Fetch
```javascript
// Cenário: User seleciona arquivo via input

const fileInput = document.getElementById('foto-input');
const arquivo = fileInput.files[0];

const formData = new FormData();
formData.append('file', arquivo, arquivo.name);

// Upload para avarias
const respAvaria = await fetch('http://api.local/uploads/avarias', {
  method: 'POST',
  body: formData
});

const jsonAvaria = await respAvaria.json();
console.log('Key da avaria:', jsonAvaria.key);
// Response: { 
//   ok: true, 
//   fileName: "abc123def456.png", 
//   key: "abc123def456.png",
//   uploadedAt: "2026-05-15T10:31:22-04:00"
// }

// Upload para checklist (idêntico)
const respChecklist = await fetch('http://api.local/uploads/checklist', {
  method: 'POST',
  body: formData
});

const jsonChecklist = await respChecklist.json();
console.log('Key do checklist:', jsonChecklist.key);
```

### cURL
```bash
# Upload de arquivo de avaria
curl -X POST http://api.local/uploads/avarias \
  -F "file=@/path/to/foto.jpg"

# Response:
# {
#   "ok": true,
#   "fileName": "abc123def456.png",
#   "key": "abc123def456.png",
#   "uploadedAt": "2026-05-15T10:31:22-04:00",
#   "url": "https://s3.example.com/avarias/abc123def456.png?sig=..."
# }
```

---

## 4. Fluxo Completo: Captura Foto + Compressão + Envio

### JavaScript (AppChecklist Pattern)
```javascript
// Step 1: Converter arquivo para dataURL
async function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Step 2: Comprimir dataURL
async function compressDataUrl(dataUrl, maxW = 1280, maxH = 1280, quality = 0.65) {
  if (!dataUrl?.startsWith('data:image')) return dataUrl;
  
  const bytes = approxByteLength(dataUrl);
  if (bytes < 200 * 1024) return dataUrl;  // Já pequeno
  
  const img = await dataURLToImage(dataUrl);
  const canvas = document.createElement('canvas');
  const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
  canvas.width = Math.floor(img.width * ratio);
  canvas.height = Math.floor(img.height * ratio);
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  
  return canvas.toDataURL('image/jpeg', quality);
}

// Step 3: Usar na criação de checklist
async function criarChecklistComFotos() {
  const fileInput = document.getElementById('foto-avaria');
  const arquivo = fileInput.files[0];
  
  // Converter
  const dataUrl = await fileToDataURL(arquivo);
  
  // Comprimir
  const comprimido = await compressDataUrl(dataUrl, 1280, 1280, 0.65);
  
  // Enviar
  const payload = {
    osInterna: "OS-2025-001",
    veiculoPlaca: "ABC-1234",
    avarias: [
      {
        tipo: "Riscado",
        peca: "Porta",
        fotoBase64: comprimido  // ✅ DataURL comprimido
      }
    ]
  };
  
  const resp = await fetch('http://api.local/checklists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  return resp.json();
}
```

---

## 5. Fluxo Offline: Sincronização com Upload

### JavaScript (AppChecklist Offline Pattern)
```javascript
// Ao sincronizar, converter dataURL para Blob e fazer upload

async function dataURLtoBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function sincronizarAvarias() {
  // Recuperar avarias pendentes do IndexedDB
  const avarias = await window.OfflineDB.listarAvaripas();
  
  for (const avaria of avarias) {
    // Se tem dataURL, fazer upload
    if (avaria.fotoBase64?.startsWith('data:image')) {
      // 1. Converter dataURL → Blob
      const blob = await dataURLtoBlob(avaria.fotoBase64);
      
      // 2. Upload para obter key
      const formData = new FormData();
      formData.append('file', blob, 'avaria.jpg');
      
      const uploadResp = await fetch('http://api.local/uploads/avarias', {
        method: 'POST',
        body: formData
      });
      
      const uploadJson = await uploadResp.json();
      const key = uploadJson.key;
      
      // 3. Substituir dataURL pela key
      avaria.fotoBase64 = key;
      
      // 4. Atualizar no IndexedDB
      await window.OfflineDB.atualizarAvaria(avaria);
    }
  }
  
  // 5. Criar checklist com avarias (agora com keys, não dataURL)
  const checklistPayload = {
    osInterna: "OS-2025-001",
    veiculoPlaca: "ABC-1234",
    avarias: avarias  // ✅ Agora com fotoBase64 = keys
  };
  
  const checklistResp = await fetch('http://api.local/checklists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checklistPayload)
  });
  
  return checklistResp.json();
}
```

---

## 6. Tratamento de Erros

### JavaScript
```javascript
async function uploadComTreatamento() {
  try {
    const response = await fetch('http://api.local/uploads/avarias', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const erro = await response.json();
      throw new Error(erro.message || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      console.error('Erro de rede:', err.message);
      // Salvar em IndexedDB e tentar depois
    } else if (err.message.includes('Tipo de arquivo não permitido')) {
      console.error('Tipo MIME inválido');
      alert('Apenas JPEG, PNG, WebP, HEIC e HEIF são permitidos');
    } else if (err.message.includes('filesize')) {
      console.error('Arquivo muito grande');
      alert('Arquivo deve ter no máximo 5MB');
    } else {
      console.error('Erro desconhecido:', err.message);
    }
  }
}
```

---

## 7. Validação de Tipos MIME

### JavaScript
```javascript
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
];

function validarFoto(file) {
  // Validar tipo
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Tipo ${file.type} não permitido. Use: ${ALLOWED_TYPES.join(', ')}`);
  }
  
  // Validar tamanho
  const MAX_BYTES = 5 * 1024 * 1024;  // 5MB
  if (file.size > MAX_BYTES) {
    throw new Error(`Arquivo de ${(file.size / 1024 / 1024).toFixed(1)}MB excede o limite de 5MB`);
  }
  
  return true;
}

// Uso
const fileInput = document.getElementById('foto-input');
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  try {
    validarFoto(file);
    console.log('✅ Arquivo válido');
  } catch (err) {
    console.error('❌', err.message);
  }
});
```

---

## 8. Preview de Imagem Antes do Upload

### HTML + JavaScript
```html
<input type="file" id="foto-input" accept="image/*" />
<img id="preview" style="max-width: 200px; display: none;" />
```

```javascript
const fileInput = document.getElementById('foto-input');
const preview = document.getElementById('preview');

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // Mostrar preview imediato
  const objectUrl = URL.createObjectURL(file);
  preview.src = objectUrl;
  preview.style.display = 'block';
  
  // Validar
  try {
    validarFoto(file);
    console.log('✅ Pronto para upload');
  } catch (err) {
    preview.style.display = 'none';
    alert(`❌ ${err.message}`);
  }
});
```

---

## Checklist de Implementação

- [ ] Convertir File para DataURL com `fileToDataURL()`
- [ ] Comprimir DataURL com `compressDataUrl()` (JPEG 65%)
- [ ] Validar tipo MIME antes de enviar
- [ ] Validar tamanho (máximo 5MB)
- [ ] Enviar via `POST /checklists` com `fotoBase64` ou `foto`
- [ ] Lidar com erros de rede
- [ ] Armazenar em IndexedDB se offline
- [ ] Sincronizar quando conexão restaurada
- [ ] Converter DataURL para Blob para upload multipart
- [ ] Obter key do S3 e substituir DataURL
- [ ] Testar com diferentes formatos de imagem
- [ ] Testar com imagens grandes (próximo ao limite)
