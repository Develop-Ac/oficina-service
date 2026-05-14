import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class GenerateChecklistPdfRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findChecklistWithRelations(id: string) {
    return this.prisma.ofi_checklists.findUnique({
      where: { id },
      include: {
        ofi_checklists_items: { orderBy: { item: 'asc' } },
        ofi_checklists_avarias: { orderBy: { timestamp: 'asc' } },
        ofi_checklists_fotos: { orderBy: { timestamp: 'asc' } },
      },
    });
  }

  async findFotosByChecklistId(checklistId: string) {
    try {
      return await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        foto: string | null;
        timestamp: Date | null;
        tipo_foto: unknown;
      }>>(
        'SELECT id, foto, timestamp, tipo_foto FROM ofi_checklists_fotos WHERE checklist_id = $1 ORDER BY timestamp ASC',
        checklistId,
      );
    } catch {
      const fotos = await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        foto: string | null;
        timestamp: Date | null;
      }>>(
        'SELECT id, foto, timestamp FROM ofi_checklists_fotos WHERE checklist_id = $1 ORDER BY timestamp ASC',
        checklistId,
      );

      return fotos.map((f) => ({ ...f, tipo_foto: null }));
    }
  }
}
