import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ChecklistRepository } from './checkList.repository';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { CreateChecklistFotoDto } from './dto/create-checklist-foto.dto';
import { Prisma } from '@prisma/client';

type ListQuery = {
  page?: number | string;
  pageSize?: number | string;
  search?: string;
  orderBy?: 'createdAt' | 'dataHoraEntrada';
  orderDir?: 'asc' | 'desc';
};

const FOTOS_360_OBRIGATORIAS = [
  { ordem: 1, posicao: 'frente', descricao: 'Frente do veiculo' },
  { ordem: 2, posicao: 'frente_lateral_direita', descricao: 'Frente + lateral direita' },
  { ordem: 3, posicao: 'lateral_direita', descricao: 'Lateral direita' },
  { ordem: 4, posicao: 'lateral_direita_traseira', descricao: 'Lateral direita + traseira' },
  { ordem: 5, posicao: 'traseira', descricao: 'Traseira' },
  { ordem: 6, posicao: 'traseira_lateral_esquerda', descricao: 'Traseira + lateral esquerda' },
  { ordem: 7, posicao: 'lateral_esquerda', descricao: 'Lateral esquerda' },
  { ordem: 8, posicao: 'lateral_esquerda_frente', descricao: 'Lateral esquerda + frente do veiculo' },
];

type Foto360Normalizada = {
  tipo: string;
  posicao: string;
  ordem: number;
  descricao: string;
  foto: string;
};

function normalizarFoto360(entry: any, index: number): Foto360Normalizada | null {
  if (!entry) return null;

  if (typeof entry === 'string') {
    const foto = entry.trim();
    if (!foto) return null;
    const fallback = FOTOS_360_OBRIGATORIAS[index];
    return {
      tipo: 'foto_360',
      posicao: fallback?.posicao || `posicao_${index + 1}`,
      ordem: fallback?.ordem || (index + 1),
      descricao: fallback?.descricao || `Foto ${index + 1}`,
      foto,
    };
  }

  if (typeof entry === 'object') {
    const fotoRaw = entry.foto ?? entry.key ?? entry.fileName;
    const foto = typeof fotoRaw === 'string' ? fotoRaw.trim() : '';
    if (!foto) return null;

    const fallback = FOTOS_360_OBRIGATORIAS[index];
    return {
      tipo: typeof entry.tipo === 'string' && entry.tipo.trim() ? entry.tipo.trim() : 'foto_360',
      posicao: typeof entry.posicao === 'string' && entry.posicao.trim()
        ? entry.posicao.trim()
        : (typeof entry.chave === 'string' && entry.chave.trim() ? entry.chave.trim() : (fallback?.posicao || `posicao_${index + 1}`)),
      ordem: Number.isFinite(Number(entry.ordem)) ? Number(entry.ordem) : (fallback?.ordem || (index + 1)),
      descricao: typeof entry.descricao === 'string' && entry.descricao.trim()
        ? entry.descricao.trim()
        : (typeof entry.titulo === 'string' && entry.titulo.trim() ? entry.titulo.trim() : (fallback?.descricao || `Foto ${index + 1}`)),
      foto,
    };
  }

  return null;
}

@Injectable()
export class ChecklistsService {
  constructor(private readonly repo: ChecklistRepository) {}

  /** CREATE */
  async create(body: CreateChecklistDto) {
    const fotos360Normalizadas = (body.fotos360 || [])
      .map((entry, index) => normalizarFoto360(entry, index))
      .filter((f): f is Foto360Normalizada => !!f);

    if (fotos360Normalizadas.length !== FOTOS_360_OBRIGATORIAS.length) {
      const faltantesBasicos = FOTOS_360_OBRIGATORIAS
        .slice(fotos360Normalizadas.length)
        .map((f) => `${f.ordem}. ${f.descricao}`);
      throw new BadRequestException(
        `Checklist nao pode ser concluido sem as 8 fotos 360 obrigatorias. Pendentes: ${faltantesBasicos.join(', ') || 'verifique as 8 posicoes.'}`,
      );
    }

    const posicoesUnicas = new Set(fotos360Normalizadas.map((f) => f.posicao));
    const ordemUnica = new Set(fotos360Normalizadas.map((f) => f.ordem));
    if (posicoesUnicas.size !== 8 || ordemUnica.size !== 8) {
      throw new BadRequestException('Fotos 360 invalidas: posicoes e ordens devem ser unicas e completas (1 a 8).');
    }

    const posicoesEsperadas = new Set(FOTOS_360_OBRIGATORIAS.map((f) => f.posicao));
    const faltantes = FOTOS_360_OBRIGATORIAS
      .filter((f) => !posicoesUnicas.has(f.posicao))
      .map((f) => `${f.ordem}. ${f.descricao}`);

    const extras = fotos360Normalizadas
      .filter((f) => !posicoesEsperadas.has(f.posicao))
      .map((f) => `${f.ordem}. ${f.posicao}`);

    if (faltantes.length || extras.length) {
      throw new BadRequestException(
        `Fotos 360 invalidas. Faltantes: ${faltantes.join(', ') || 'nenhuma'}. Extras: ${extras.join(', ') || 'nenhuma'}.`,
      );
    }

    // normaliza KM para BigInt (se seu schema é BigInt?)
    let veiculoKmBig: bigint | null = null;
    if (body.veiculoKm !== undefined && body.veiculoKm !== null) {
      // body.veiculoKm pode chegar como number | null (se DTO usa Transform) – convertemos para BigInt com segurança
      const kmNum = Math.trunc(Number(body.veiculoKm));
      if (!Number.isNaN(kmNum)) {
        veiculoKmBig = BigInt(kmNum);
      }
    }

    // assinaturas (aceita nomes antigos também)
    const assinaturaCliente =
      body.assinaturasclienteBase64 ?? body.assinaturaClienteBase64 ?? null;

    const assinaturaResponsavel =
      body.assinaturasresponsavelBase64 ?? body.assinaturaResponsavelBase64 ?? null;

    const checklist = await this.repo.create({
      osInterna: body.osInterna ?? null,
      dataHoraEntrada: body.dataHoraEntrada ? new Date(body.dataHoraEntrada) : null,
      observacoes: body.observacoes ?? null,
      combustivelPercentual: body.combustivelPercentual ?? null,

      clienteNome: body.clienteNome ?? null,
      clienteDoc: body.clienteDoc ?? null,
      clienteTel: body.clienteTel ?? null,
      clienteEnd: body.clienteEnd ?? null,

      veiculoNome: body.veiculoNome ?? null,
      veiculoPlaca: body.veiculoPlaca ?? null,
      veiculoCor: body.veiculoCor ?? null,
      veiculoKm: veiculoKmBig,

      assinaturasclienteBase64: assinaturaCliente,
      assinaturasresponsavelBase64: assinaturaResponsavel,

      ofi_checklists_items: body.checklist?.length
        ? {
            create: body.checklist.map((i) => ({
              item: i.item,
              status: i.status,
            })),
          }
        : undefined,

      ofi_checklists_avarias: body.avarias?.length
        ? {
            create: body.avarias.map((a) => ({
              tipo: a.tipo ?? null,
              peca: a.peca ?? null,
              observacoes: a.observacoes ?? null,
              posX: a.posX ?? null,
              posY: a.posY ?? null,
              posZ: a.posZ ?? null,
              normX: a.normX ?? null,
              normY: a.normY ?? null,
              normZ: a.normZ ?? null,
              fotoBase64: a.fotoBase64 ?? null,
              timestamp: a.timestamp ? new Date(a.timestamp) : null,
            })),
          }
        : undefined,
    });

    await Promise.all(fotos360Normalizadas.map(async (fotoMeta) => {
      const payloadFoto = {
        tipo: 'foto_360',
        posicao: fotoMeta.posicao,
        ordem: fotoMeta.ordem,
        descricao: fotoMeta.descricao,
        foto: fotoMeta.foto,
      };

      const fotoSerializada = JSON.stringify(payloadFoto);
      console.log('Criando foto 360 para checklist', { checklistId: checklist.id, fotoMeta: payloadFoto });
      await this.repo.createFoto({
        checklist_id: checklist.id,
        foto: fotoSerializada,
      });
    }));
  
    return checklist;
  }

  /** LIST (com paginação + busca) */
  async findAll(query: ListQuery) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 10)));
    const skip = (page - 1) * pageSize;

    const search = (query.search ?? '').toString().trim();
    const orderByField = (query.orderBy ?? 'createdAt') as
      | 'createdAt'
      | 'dataHoraEntrada';
    const orderDir = (query.orderDir ?? 'desc') as 'asc' | 'desc';

    // TIPAR explicitamente o where evita inferência ruim do TS

    const where: Prisma.ofi_checklistsWhereInput | undefined = search
      ? {
          OR: [
            { osInterna: { contains: search } },
            { clienteNome: { contains: search } },
            { veiculoPlaca: { contains: search } },
          ],
        }
      : undefined;

    const [total, data] = await this.repo.transaction(async (tx) => {
      const count = await tx.ofi_checklists.count({ where });
      const items = await tx.ofi_checklists.findMany({
        where,
        orderBy: { [orderByField]: orderDir },
        skip,
        take: pageSize,
        select: {
          id: true,
          osInterna: true,
          dataHoraEntrada: true,
          observacoes: true,
          combustivelPercentual: true,
          clienteNome: true,
          veiculoPlaca: true,
          veiculoNome: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return [count, items] as const;
    });

    return {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      data,
    };
  }

  /** GET BY ID (com relacionamentos) */
  async findOne(id: string) {
    const item = await this.repo.findUnique({ id }, {
      ofi_checklists_items: true,
      ofi_checklists_avarias: true,
    });

    if (!item) {
      throw new NotFoundException('Checklist não encontrado');
    }
    return item;
  }

  /** DELETE */
  async remove(id: string) {
    // garante que existe antes de excluir
    const exists = await this.repo.findUnique({ id });
    if (!exists) throw new NotFoundException('Checklist não encontrado');

    await this.repo.delete({ id });
    return { ok: true };
  }

  /** UPDATE */
  async update(id: string, data: any) {
    const exists = await this.repo.findUnique({ id });
    if (!exists) throw new NotFoundException('Checklist não encontrado');

    // Remover campos inválidos
    const { checklistId, ...validData } = data;

    // Processar itens relacionados
    if (validData.ofi_checklists_items) {
      validData.ofi_checklists_items = {
        update: validData.ofi_checklists_items.map((item: any) => {
          const { checklistId, ...validItem } = item; // Remover checklistId
          return {
            where: { id: validItem.id },
            data: { ...validItem },
          };
        }),
        create: validData.ofi_checklists_items 
          .filter((item: any) => !item.id) // Apenas itens sem ID serão criados
          .map((item: any) => {
            const { checklistId, ...validItem } = item; // Remover checklistId
            return { ...validItem };
          }),
      };
    }

    // Processar avarias relacionadas
    if (validData.ofi_checklists_avarias) {
      validData.ofi_checklists_avarias = {
        update: validData.ofi_checklists_avarias.map((avaria: any) => {
          const { checklistId, ...validAvaria } = avaria; // Remover checklistId
          return {
            where: { id: validAvaria.id },
            data: { ...validAvaria },
          };
        }),
        create: validData.ofi_checklists_avarias
          .filter((avaria: any) => !avaria.id) // Apenas avarias sem ID serão criadas
          .map((avaria: any) => {
            const { checklistId, ...validAvaria } = avaria; // Remover checklistId
            return { ...validAvaria };
          }),
      }; 
    }
  
    // Atualizar checklist principal
    const updatedChecklist = await this.repo.update({ id }, validData);

    return updatedChecklist;
  }

  async createFotoByOs(id: string, dto: CreateChecklistFotoDto) {
    const checklist = await this.repo.findFirst(
      { where: { id: id } },
    );
    if (!checklist) throw new NotFoundException('Checklist não encontrado para a OS informada');
    return this.repo.createFoto({ checklist_id: checklist.id, foto: dto.foto });
  }

  // Aliases para compatibilidade com os testes
  async findById(id: string) {
    return this.findOne(id);
  }

  async delete(id: string) {
    return this.remove(id);
  }

  async findByPlaca(placa: string) {
    const normalizedPlaca = placa.replace(/[-\s]/g, '');
    return this.repo.findMany({
      where: {
        veiculoPlaca: {
          contains: normalizedPlaca,
        },
      },
    });
  }

  async findByOs(os: string) {
    const item = await this.repo.findFirst(
      { where: { osInterna: os } },
      {
        ofi_checklists_items: true,
        ofi_checklists_avarias: true,
      }
    );
    if (!item) throw new NotFoundException('Checklist não encontrado');
    return item;
  }
}