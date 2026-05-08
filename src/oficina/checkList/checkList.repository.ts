import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ChecklistRepository {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      return data.replace(/\0/g, ''); // Remove bytes nulos
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    if (data && typeof data === 'object') {
      return Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, this.sanitizeData(value)]),
      );
    }

    return data;
  }

  create(data: Prisma.ofi_checklistsCreateInput) {
    return this.prisma.ofi_checklists.create({ data });
  }

  count(where?: Prisma.ofi_checklistsWhereInput) {
    return this.prisma.ofi_checklists.count({ where });
  }

  findMany(params: {
    where?: Prisma.ofi_checklistsWhereInput;
    orderBy?: Prisma.ofi_checklistsOrderByWithRelationInput;
    skip?: number;
    take?: number;
    select?: Prisma.ofi_checklistsSelect;
  }) {
    return this.prisma.ofi_checklists.findMany(params);
  }

  findUnique(where: Prisma.ofi_checklistsWhereUniqueInput, include?: Prisma.ofi_checklistsInclude) {
    return this.prisma.ofi_checklists.findUnique({ where, include });
  }

  findFirst(params: { where: Prisma.ofi_checklistsWhereInput }, include?: Prisma.ofi_checklistsInclude) {
    return this.prisma.ofi_checklists.findFirst({ ...params, include });
  }

  update(where: Prisma.ofi_checklistsWhereUniqueInput, data: Prisma.ofi_checklistsUpdateInput) {
    if (!data || Object.keys(data).length === 0) {
      throw new Error('O argumento "data" está vazio ou inválido.');
    }

    // Remover campos não permitidos
    const { id, createdAt, updatedAt, ...filteredData } = data;

    return this.prisma.ofi_checklists.update({
      where,
      data: filteredData,
    });
  }

  delete(where: Prisma.ofi_checklistsWhereUniqueInput) {
    return this.prisma.ofi_checklists.delete({ where });
  }

  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn);
  }

  async updateChecklist(id: string, checklist: any) {
    if (!checklist || Object.keys(checklist).length === 0) {
      throw new Error('O objeto checklist está vazio ou inválido.');
    }

    // Remover campos não permitidos
    const { id: _, createdAt, updatedAt, ofi_checklists_items, ...filteredData } = checklist;

    // Sanitizar os dados
    const sanitizedData = this.sanitizeData(filteredData);

    // Transformar itens relacionados em um formato compatível com o Prisma
    if (ofi_checklists_items) {
      sanitizedData.ofi_checklists_items = {
        update: ofi_checklists_items.map((item: any) => ({
          where: { id: item.id },
          data: this.sanitizeData(item),
        })),
        create: ofi_checklists_items
          .filter((item: any) => !item.id) // Apenas itens sem ID serão criados
          .map((item: any) => this.sanitizeData(item)),
      };
    }

    return this.prisma.ofi_checklists.update({
      where: { id },
      data: sanitizedData,
    });
  }

  async updateChecklistItems(checklistId: string, items: any[]) {
    // Exemplo: Atualizar itens relacionados
    for (const item of items) {
      await this.prisma.ofi_checklists_items.upsert({
        where: { id: item.id },
        update: item,
        create: { ...item, checklistId },
      });
    }
  }

  async createFoto(data: { checklist_id: string; foto: string; tipo_foto?: Record<string, any> | null }) {
    const created = await this.prisma.ofi_checklists_fotos.create({
      data: {
        checklist_id: data.checklist_id,
        foto: data.foto,
      },
    });

    if (data.tipo_foto) {
      try {
        await this.prisma.$executeRawUnsafe(
          'UPDATE ofi_checklists_fotos SET tipo_foto = $1::jsonb WHERE id = $2',
          JSON.stringify(data.tipo_foto),
          created.id,
        );
      } catch {
        // Compatibilidade: se a coluna tipo_foto ainda nao existir, mantem o fluxo.
      }
    }

    return created;
  }

  async findFotosByChecklistId(checklistId: string) {
    try {
      return await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        foto: string | null;
        timestamp: Date;
        tipo_foto: any;
      }>>(
        'SELECT id, foto, timestamp, tipo_foto FROM ofi_checklists_fotos WHERE checklist_id = $1 ORDER BY timestamp ASC',
        checklistId,
      );
    } catch {
      const fotos = await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        foto: string | null;
        timestamp: Date;
      }>>(
        'SELECT id, foto, timestamp FROM ofi_checklists_fotos WHERE checklist_id = $1 ORDER BY timestamp ASC',
        checklistId,
      );

      return fotos.map((f) => ({ ...f, tipo_foto: null }));
    }
  }

  async updateChecklistAvarias(checklistId: string, avarias: any[]) {
    // Exemplo: Atualizar avarias relacionadas
    for (const avaria of avarias) {
      await this.prisma.ofi_checklists_avarias.upsert({
        where: { id: avaria.id },
        update: avaria,
        create: { ...avaria, checklistId },
      });
    }
  }
}
