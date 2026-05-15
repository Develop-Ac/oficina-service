// src/oficina/checkListPdf/generate-pdf.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { GenerateChecklistPdfRepository } from './generate-pdf.repository';
import { S3Service } from '../../../storage/s3.service';
import * as fs from 'fs';
import * as path from 'path';

// Alias de tipo seguro para a instância do PDFKit
type PDFDoc = InstanceType<typeof PDFDocument>;

type FotoRaw = {
  id: string;
  foto: string | null;
  timestamp: Date | null;
  tipo_foto: unknown;
};

type FotoPdf = {
  key: string;
  label: string;
  timestamp?: Date | null;
  image?: Buffer | null;
};

@Injectable()
export class GenerateChecklistPdfService {
  constructor(
    private readonly repo: GenerateChecklistPdfRepository,
    private readonly s3: S3Service,
  ) {}

  // ---------- Util: localizar logo e retornar Buffer ----------
  private getLogoBuffer(): Buffer | null {
    const candidates = [
      path.resolve(process.cwd(), 'public', 'icon-192.png'),
      path.resolve(process.cwd(), 'icon-192.png'),
      path.resolve(process.cwd(), 'src', 'public', 'icon-192.png'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return fs.readFileSync(p);
      } catch {
        // ignora e tenta o próximo
      }
    }
    return null;
  }

  private dataUrlToBuffer(dataUrlOrBase64?: string | null): Buffer | null {
    if (!dataUrlOrBase64 || !dataUrlOrBase64.startsWith('data:')) return null;
    const base64 = dataUrlOrBase64.split(',')[1] ?? '';
    if (!base64) return null;
    return Buffer.from(base64, 'base64');
  }

  private maybePlainBase64ToBuffer(raw?: string | null): Buffer | null {
    if (!raw) return null;
    const normalized = raw.replace(/\s+/g, '');
    if (!normalized || normalized.length < 80) return null;
    if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) return null;

    try {
      const buf = Buffer.from(normalized, 'base64');
      if (!buf.length) return null;
      return buf;
    } catch {
      return null;
    }
  }

  private formatDateTime(value?: Date | string | null): string {
    if (!value) return '-';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('pt-BR');
  }

  private uniqueList(values: string[]) {
    return Array.from(new Set(values.filter((v) => !!v)));
  }

  private async resolveImageBufferByKey(
    keyOrBase64: string | null | undefined,
    buckets: string[],
  ): Promise<Buffer | null> {
    if (!keyOrBase64) return null;

    const inline = this.dataUrlToBuffer(keyOrBase64) ?? this.maybePlainBase64ToBuffer(keyOrBase64);
    if (inline) return inline;

    for (const bucket of this.uniqueList(buckets)) {
      try {
        return await this.s3.getObjectBuffer(keyOrBase64, bucket);
      } catch (err) {
        console.warn(
          `[PDF] Falha ao obter imagem. bucket=${bucket} key=${keyOrBase64}`,
          (err as Error)?.message
        );
      }
    }

    return null;
  }

  private normalizeChecklistFotos(fotosRaw: FotoRaw[]) {
    const fotos360: FotoPdf[] = [];
    const demaisFotos: FotoPdf[] = [];

    (fotosRaw || []).forEach((f, idx) => {
      const tipoFotoObj = typeof f.tipo_foto === 'string'
        ? (() => {
            try {
              return JSON.parse(f.tipo_foto);
            } catch {
              return null;
            }
          })()
        : (f.tipo_foto && typeof f.tipo_foto === 'object' ? f.tipo_foto : null);

      let parsedLegacy: any = null;
      try {
        parsedLegacy = f.foto ? JSON.parse(f.foto) : null;
      } catch {
        parsedLegacy = null;
      }

      const key = typeof f.foto === 'string' && f.foto.trim() && !f.foto.trim().startsWith('{')
        ? f.foto.trim()
        : typeof parsedLegacy?.foto === 'string' && parsedLegacy.foto.trim()
          ? parsedLegacy.foto.trim()
          : typeof parsedLegacy?.key === 'string' && parsedLegacy.key.trim()
            ? parsedLegacy.key.trim()
            : typeof parsedLegacy?.fileName === 'string' && parsedLegacy.fileName.trim()
              ? parsedLegacy.fileName.trim()
              : '';

      if (!key) return;

      const tipo = typeof tipoFotoObj?.tipo === 'string'
        ? tipoFotoObj.tipo
        : (typeof parsedLegacy?.tipo === 'string' ? parsedLegacy.tipo : 'foto_360');

      const descricao = typeof tipoFotoObj?.descricao === 'string'
        ? tipoFotoObj.descricao
        : (typeof parsedLegacy?.descricao === 'string' ? parsedLegacy.descricao : null);

      const posicao = typeof tipoFotoObj?.posicao === 'string'
        ? tipoFotoObj.posicao
        : (typeof parsedLegacy?.posicao === 'string' ? parsedLegacy.posicao : null);

      const label = descricao || posicao || `Foto ${idx + 1}`;
      const foto: FotoPdf = {
        key,
        label,
        timestamp: f.timestamp,
      };

      if (!tipo || tipo === 'foto_360') {
        fotos360.push(foto);
      } else {
        demaisFotos.push(foto);
      }
    });

    return { fotos360, demaisFotos };
  }

  private addSectionTitle(doc: PDFDoc, title: string, marginLeft: number) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(12).text(title, marginLeft);
    doc.moveDown(0.2);
    const y = doc.y;
    const pageWidth = doc.page.width;
    const margin = 12;
    doc
      .moveTo(margin, y)
      .lineTo(pageWidth - margin, y)
      .lineWidth(0.5)
      .strokeColor('#dddddd')
      .stroke();
    doc.moveDown(0.4);
  }

  private textLabelValue(doc: PDFDoc, label: string, value: string, x: number, y?: number) {
    if (y != null) doc.y = y;
    doc.font('Helvetica-Bold').fontSize(10).text(label, x, doc.y, { continued: true });
    doc.font('Helvetica').fontSize(10).text(value || '-');
  }

  private ensurePageSpace(doc: PDFDoc, needed: number, margin: number) {
    const bottom = doc.page.height - margin;
    if (doc.y + needed > bottom) doc.addPage();
  }

  // ====== DUAS TABELAS LADO A LADO ======
  private drawSimpleTable(
    doc: PDFDoc,
    rows: { item: string; status: string }[],
    x: number,
    yStart: number,
    tableWidth: number,
    rowH: number,
    headerH: number,
  ): number {
    // Colunas internas da tabela (Item / Status): 70% / 30%
    const colPerc = [0.7, 0.3];
    const colW = colPerc.map((p) => Math.floor(tableWidth * p));

    // Cabeçalho
    doc.rect(x, yStart, tableWidth, headerH).fill('#162032');
    doc
      .fill('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Item', x + 6, yStart + 3, { width: colW[0] - 8 })
      .text('Status', x + colW[0] + 6, yStart + 3, { width: colW[1] - 8 });
    doc.fill('#000000');

    let y = yStart + headerH;

    rows.forEach((r, idx) => {
      if (idx % 2 === 0) {
        // alterna a faixa de fundo da linha
        doc.rect(x, y, tableWidth, rowH).fill('#f5f7fa').fillColor('#000000');
      }
      doc
        .font('Helvetica')
        .fontSize(9)
        .text(r.item || '-', x + 6, y + 3, { width: colW[0] - 8 })
        .text(r.status || '-', x + colW[0] + 6, y + 3, { width: colW[1] - 8 });
      y += rowH;
    });

    return y; // y final após a tabela
  }

  private writeTwoTablesChecklist(doc: PDFDoc, items: { item: string; status: string }[], margin: number) {
    const gap = 16;
    const usableWidth = doc.page.width - margin * 2;
    const tableWidth = (usableWidth - gap) / 2;
    const headerH = 14;
    const rowH = 12;

    // split 50/50
    const meio = Math.ceil(items.length / 2);
    const leftRows = items.slice(0, meio);
    const rightRows = items.slice(meio);

    // Altura necessária: cabeçalho + linhas do maior lado
    const maxRows = Math.max(leftRows.length, rightRows.length);
    const neededHeight = headerH + maxRows * rowH + 8; // + margem após

    this.ensurePageSpace(doc, neededHeight, margin);
    const yStart = doc.y;

    // Desenha ambas as tabelas
    const xLeft = margin;
    const xRight = margin + tableWidth + gap;

    const yEndLeft = this.drawSimpleTable(doc, leftRows, xLeft, yStart, tableWidth, rowH, headerH);
    const yEndRight = this.drawSimpleTable(doc, rightRows, xRight, yStart, tableWidth, rowH, headerH);

    // posiciona o cursor no maior Y final
    doc.y = Math.max(yEndLeft, yEndRight) + 6;
  }

  private writeAvariasTable(
    doc: PDFDoc,
    avarias: { peca?: string | null; tipo?: string | null; observacoes?: string | null }[],
    margin: number,
  ) {
    const headers = ['Peça', 'Tipo', 'Observações'];
    const colPerc = [0.25, 0.2, 0.55]; // largura relativa
    const usableWidth = doc.page.width - margin * 2;
    const colW = colPerc.map((p) => Math.floor(usableWidth * p));
    const rowH = 16;

    // Cabeçalho
    this.ensurePageSpace(doc, rowH, margin);
    const headerY = doc.y;
    doc.rect(margin, headerY, usableWidth, rowH).fill('#162032');
    doc
      .fill('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(headers[0], margin + 6, headerY + 4, { width: colW[0] - 8 })
      .text(headers[1], margin + colW[0] + 6, headerY + 4, { width: colW[1] - 8 })
      .text(headers[2], margin + colW[0] + colW[1] + 6, headerY + 4, { width: colW[2] - 8 });
    doc.fill('#000000');
    doc.y = headerY + rowH;

    // Linhas
    avarias.forEach((av, idx) => {
      this.ensurePageSpace(doc, rowH, margin);
      const y = doc.y;

      if (idx % 2 === 0) {
        doc.rect(margin, y, usableWidth, rowH).fill('#f5f7fa').fillColor('#000000');
      }

      doc
        .font('Helvetica')
        .fontSize(9)
        .text(av.peca || '-', margin + 6, y + 4, { width: colW[0] - 8 })
        .text(av.tipo || '-', margin + colW[0] + 6, y + 4, { width: colW[1] - 8 })
        .text(av.observacoes || '-', margin + colW[0] + colW[1] + 6, y + 4, {
          width: colW[2] - 8,
        });

      doc.y = y + rowH;
    });

    doc.moveDown(0.5);
  }

  private writePhotoGrid(doc: PDFDoc, title: string, fotos: FotoPdf[], margin: number) {
    this.addSectionTitle(doc, title, margin);

    if (!fotos.length) {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor('#555').text('Sem fotos.', margin);
      doc.fillColor('#000');
      doc.moveDown(0.6);
      return;
    }

    const cols = 3;
    const gap = 8;
    const usableWidth = doc.page.width - margin * 2;
    const cardW = (usableWidth - gap * (cols - 1)) / cols;
    const imageH = 108;
    const cardH = 148;

    let rowY = doc.y;

    fotos.forEach((foto, idx) => {
      const col = idx % cols;
      if (col === 0) {
        this.ensurePageSpace(doc, cardH + 8, margin);
        rowY = doc.y;
      }

      const x = margin + col * (cardW + gap);
      const y = rowY;

      doc.rect(x, y, cardW, cardH).lineWidth(0.6).strokeColor('#d8d8d8').stroke();

      if (foto.image) {
        try {
          doc.image(foto.image, x + 4, y + 4, {
            fit: [cardW - 8, imageH - 8],
            align: 'center',
            valign: 'center',
          });
        } catch {
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor('#777')
            .text('Imagem indisponível', x + 8, y + imageH / 2 - 5, { width: cardW - 16, align: 'center' });
          doc.fillColor('#000');
        }
      } else {
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#777')
          .text('Imagem indisponível', x + 8, y + imageH / 2 - 5, { width: cardW - 16, align: 'center' });
        doc.fillColor('#000');
      }

      const metaY = y + imageH + 4;
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#111')
        .text(foto.label || `Foto ${idx + 1}`, x + 4, metaY, {
          width: cardW - 8,
          ellipsis: true,
        });

      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#555')
        .text(`Data/Hora: ${this.formatDateTime(foto.timestamp)}`, x + 4, metaY + 12, {
          width: cardW - 8,
          ellipsis: true,
        });
      doc.fillColor('#000');

      if (col === cols - 1 || idx === fotos.length - 1) {
        doc.y = rowY + cardH + 6;
      }
    });
  }

  private drawSignaturesFooter(
    doc: PDFDoc,
    assinaturas: Array<{ label: string; image: Buffer | null }>,
    margin: number,
  ) {
    const gap = 10;
    const usableWidth = doc.page.width - margin * 2;
    const totalBoxes = Math.max(assinaturas.length, 1);
    const boxW = (usableWidth - gap * (totalBoxes - 1)) / totalBoxes;
    const boxH = 62;

    this.ensurePageSpace(doc, boxH + 28, margin);

    const yStart = doc.y + 8;

    assinaturas.forEach((sig, idx) => {
      const x = margin + idx * (boxW + gap);
      doc.rect(x, yStart, boxW, boxH).stroke('#cccccc');

      if (sig.image) {
        try {
          doc.image(sig.image, x + 6, yStart + 6, {
            width: boxW - 12,
            height: boxH - 24,
            fit: [boxW - 12, boxH - 24],
            align: 'center',
            valign: 'center',
          });
        } catch {
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor('#888')
            .text('Assinatura inválida', x + 6, yStart + 24, { width: boxW - 12, align: 'center' });
          doc.fillColor('#000');
        }
      } else {
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#888')
          .text('Sem assinatura', x + 6, yStart + 24, { width: boxW - 12, align: 'center' });
        doc.fillColor('#000');
      }

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#111')
        .text(sig.label, x, yStart + boxH + 6, {
          width: boxW,
          align: 'center',
        });
      doc.fillColor('#000');
    });

    doc.y = yStart + boxH + 22;
  }

  async generatePdfBuffer(id: string): Promise<Buffer> {
    const c = await this.repo.findChecklistWithRelations(id);
    if (!c) throw new NotFoundException('Checklist não encontrado');

    const doc = new PDFDocument({ size: 'A4', margin: 12 });
    const chunks: Buffer[] = [];
    const bufferPromise = new Promise<Buffer>((resolve) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const margin = 12;

    const fotosRaw = (await this.repo.findFotosByChecklistId(c.id)) as FotoRaw[];
    const { fotos360, demaisFotos } = this.normalizeChecklistFotos(fotosRaw);

    const avariasFotos: FotoPdf[] = (c.ofi_checklists_avarias || [])
      .filter((a) => !!a.fotoBase64)
      .map((a, idx) => ({
        key: a.fotoBase64 || '',
        label: a.peca || a.tipo || `Avaria ${idx + 1}`,
        timestamp: a.timestamp,
      }));

    const bucketAvarias = process.env.S3_BUCKET_AVARIAS || 'avarias';
    const bucketChecklist = process.env.S3_BUCKET_CHECKLIST || 'check-list';
    const bucketDefault = this.s3.getDefaultBucket();

    const avariasComImagem = await Promise.all(
      avariasFotos.map(async (f) => ({
        ...f,
        image: await this.resolveImageBufferByKey(f.key, [bucketAvarias, bucketDefault, bucketChecklist]),
      })),
    );

    const fotos360ComImagem = await Promise.all(
      fotos360.map(async (f) => ({
        ...f,
        image: await this.resolveImageBufferByKey(f.key, [bucketChecklist, bucketDefault, bucketAvarias]),
      })),
    );

    const demaisComImagem = await Promise.all(
      demaisFotos.map(async (f) => ({
        ...f,
        image: await this.resolveImageBufferByKey(f.key, [bucketChecklist, bucketDefault, bucketAvarias]),
      })),
    );

    // =============================
    // Cabeçalho com LOGO + TÍTULO (título centralizado verticalmente)
    // =============================
    const logo = this.getLogoBuffer();
    const headerY = doc.y; // geralmente = margin

    const title = 'Checklist de Entrada e Saída de Veículo – AC';
    const titleFontSize = 14;
    const logoSize = 28; // caixa quadrada conhecida para facilitar centragem
    const gap = 8;

    let headerBlockHeight = 0;

    // Desenha logo à esquerda dentro de uma caixa conhecida (fit) => altura conhecida (logoSize)
    if (logo) {
      doc.image(logo, margin, headerY, { fit: [logoSize, logoSize] });
      headerBlockHeight = Math.max(headerBlockHeight, logoSize);
    }

    // Medidas do título
    doc.font('Helvetica-Bold').fontSize(titleFontSize);
    const titleX = margin + (logo ? logoSize + gap : 0);
    const titleWidth = doc.page.width - titleX - margin;

    // Altura do título (pode variar se quebrar linha)
    const titleHeight = doc.heightOfString(title, { width: titleWidth });

    const headerInfo = `Entrada: ${this.formatDateTime(c.dataHoraEntrada)}   |   Saída: ${this.formatDateTime(c.dataHoraEntrega)}`;
    doc.font('Helvetica').fontSize(9);
    const infoHeight = doc.heightOfString(headerInfo, { width: titleWidth });

    // Calcula Y do título para centralizar verticalmente em relação à altura da logo (ou do próprio título se não houver logo)
    const textBlockHeight = titleHeight + 2 + infoHeight;
    const referenceHeight = logo ? logoSize : textBlockHeight;
    const yTitle = headerY + (referenceHeight - textBlockHeight) / 2;

    // Desenha o título alinhado à esquerda, centralizado verticalmente
    doc.font('Helvetica-Bold').fontSize(titleFontSize);
    doc.text(title, titleX, yTitle, { width: titleWidth, align: 'left' });

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#444')
      .text(headerInfo, titleX, yTitle + titleHeight + 2, { width: titleWidth, align: 'left' });
    doc.fillColor('#000');

    // Altura total do bloco do cabeçalho
    headerBlockHeight = Math.max(headerBlockHeight, textBlockHeight);

    // Avança o cursor após o cabeçalho e traça a linha
    doc.y = headerY + headerBlockHeight + 6;
    doc
      .moveTo(margin, doc.y)
      .lineTo(doc.page.width - margin, doc.y)
      .lineWidth(0.5)
      .strokeColor('#dddddd')
      .stroke();
    doc.moveDown(0.6);

    // =============================
    // (REMOVIDO) "Gerado em: ..."
    // =============================

    // Identificação
    this.addSectionTitle(doc, 'Identificação', margin);
    const y0 = doc.y;
    this.textLabelValue(doc, 'O.S Interna: ', c.osInterna || '-', margin, y0);
    this.textLabelValue(
      doc,
      'Data/Hora Entrada: ',
      this.formatDateTime(c.dataHoraEntrada),
      margin + 240,
      y0,
    );

    const y0b = doc.y + 2;
    this.textLabelValue(doc, 'Data/Hora Saída: ', this.formatDateTime(c.dataHoraEntrega), margin, y0b);

    const y1 = doc.y + 2;
    this.textLabelValue(doc, 'Cliente: ', c.clienteNome || '-', margin, y1);
    this.textLabelValue(doc, 'Doc: ', c.clienteDoc || '-', margin + 240, y1);

    const y2 = doc.y + 2;
    this.textLabelValue(doc, 'Telefone: ', c.clienteTel || '-', margin, y2);
    this.textLabelValue(doc, 'Endereço: ', c.clienteEnd || '-', margin + 240, y2);

    const y3 = doc.y + 2;
    this.textLabelValue(doc, 'Veículo: ', c.veiculoNome || '-', margin, y3);
    this.textLabelValue(doc, 'Placa: ', c.veiculoPlaca || '-', margin + 240, y3);

    const y4 = doc.y + 2;
    this.textLabelValue(doc, 'Cor: ', c.veiculoCor || '-', margin, y4);
    this.textLabelValue(doc, 'KM: ', c.veiculoKm != null ? String(c.veiculoKm) : '-', margin + 240, y4);
    doc.moveDown(1);

    // Combustível
    this.addSectionTitle(doc, 'Nível de Combustível', margin);
    doc.font('Helvetica').fontSize(10).text(`Percentual: ${c.combustivelPercentual ?? 0}%`, margin);
    doc.moveDown(0.8);

    // Checklist (DUAS TABELAS)
    this.addSectionTitle(doc, 'Checklist de Itens', margin);
    const checklist = (c.ofi_checklists_items || []).map((i) => ({ item: i.item, status: i.status }));
    if (checklist.length) {
      this.writeTwoTablesChecklist(doc, checklist, margin);
    } else {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor('#555').text('Sem itens informados.', margin);
      doc.fillColor('#000');
      doc.moveDown(0.6);
    }

    // Avarias
    this.addSectionTitle(doc, 'Avarias Registradas', margin);
    const avariasLite = (c.ofi_checklists_avarias || []).map((a) => ({
      peca: a.peca ?? '',
      tipo: a.tipo ?? '',
      observacoes: a.observacoes ?? '',
    }));
    if (avariasLite.length) {
      this.writeAvariasTable(doc, avariasLite, margin);
    } else {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor('#555').text('Sem avarias.', margin);
      doc.fillColor('#000');
      doc.moveDown(0.6);
    }

    // Fotos
    this.writePhotoGrid(doc, 'Fotos de Avarias', avariasComImagem, margin);
    this.writePhotoGrid(doc, 'Fotos 360', fotos360ComImagem, margin);
    this.writePhotoGrid(doc, 'Demais Fotos', demaisComImagem, margin);

    // Observações
    if (c.observacoes) {
      this.addSectionTitle(doc, 'Observações', margin);
      doc.font('Helvetica').fontSize(10).text(c.observacoes, {
        width: doc.page.width - margin * 2,
      });
      doc.moveDown(0.6);
    }

    // Assinaturas (rodapé)
    const imgClienteEntrada = this.dataUrlToBuffer((c as any).assinaturasclienteBase64);
    const imgRespEntrada = this.dataUrlToBuffer((c as any).assinaturasresponsavelBase64);
    const imgClienteSaida = this.dataUrlToBuffer((c as any).assinaturaRetiradaBase64);

    const hasClienteEntrada = !!imgClienteEntrada;
    const hasClienteSaida = !!imgClienteSaida;

    const assinaturasCliente: Array<{ label: string; image: Buffer | null }> = [];

    if (hasClienteEntrada && hasClienteSaida) {
      assinaturasCliente.push({ label: 'Cliente (Entrada)', image: imgClienteEntrada });
      assinaturasCliente.push({ label: 'Cliente (Saída)', image: imgClienteSaida });
    } else if (hasClienteEntrada || hasClienteSaida) {
      assinaturasCliente.push({
        label: 'Cliente',
        image: imgClienteEntrada ?? imgClienteSaida,
      });
    } else {
      assinaturasCliente.push({ label: 'Cliente', image: null });
    }

    this.addSectionTitle(doc, 'Assinaturas', margin);
    this.drawSignaturesFooter(
      doc,
      [
        { label: 'Responsável', image: imgRespEntrada },
        ...assinaturasCliente,
      ],
      margin,
    );

    // Numeração de páginas
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.height - 16;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#777')
        .text(`Página ${i + 1} de ${range.count}`, doc.page.width - margin, bottom, {
          align: 'right',
        });
      doc.fillColor('#000');
    }

    doc.end();
    return bufferPromise;
  }
}
