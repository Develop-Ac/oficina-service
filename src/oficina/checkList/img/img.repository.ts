import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class ImagesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listByChecklistId(checklistId: string) {
    return this.prisma.ofi_checklists_avarias.findMany({
      where: { checklistId },
      orderBy: { timestamp: 'asc' },
      select: {
        fotoBase64: true,
        peca: true,
        observacoes: true,
        tipo: true,
      },
    });
  }

  listFotosByChecklistId(checklistId: string) {
    return this.prisma.ofi_checklists_fotos.findMany({
      where: { checklist_id: checklistId },
      select: {
        foto: true,
      },
    });
  }
}
