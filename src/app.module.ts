import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ChecklistsModule } from './oficina/checkList/checklist.module';
import { GenerateChecklistPdfModule } from './oficina/checkList/pdf/generate-pdf.module';
import { OrdemServicoModule } from './oficina/checkList/ordem-servico/ordem-servico.module';
import { ImagesModule } from './oficina/checkList/img/img.module';
import { S3Module } from './storage/s3.module';
import { UploadsModule } from './oficina/s3/s3.module';

@Module({
imports: [
    PrismaModule,
    ChecklistsModule,
    GenerateChecklistPdfModule,
    ImagesModule,
    OrdemServicoModule,
    S3Module,
    UploadsModule,

    // ⬇️ Prefixa *somente* esses módulos com /compras
    RouterModule.register([
      { path: 'oficina', module: ChecklistsModule },
      { path: 'oficina', module: GenerateChecklistPdfModule },
      { path: 'oficina', module: OrdemServicoModule },
      { path: 'oficina', module: ImagesModule },
      { path: 'oficina', module: UploadsModule },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
