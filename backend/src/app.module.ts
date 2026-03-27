import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { StorageModule } from '@storage/storage.module';
import { DomainModule } from '@domain/domain.module';
import { AuthModule } from '@modules/auth/auth.module';
import { CatalogModule } from '@modules/catalog/catalog.module';
import { ClientsModule } from '@modules/clients/clients.module';
import { ClientDocumentsModule } from '@modules/client-documents/client-documents.module';
import { PdfModule } from '@modules/pdf/pdf.module';
import { ClosuresModule } from '@modules/closures/closures.module';
import { AdvancesModule } from '@modules/advances/advances.module';
import { PricingModule } from '@modules/pricing/pricing.module';
import { CollectionsModule } from '@modules/collections/collections.module';
import { ValidationsModule } from '@modules/validations/validations.module';
import { IncidentsModule } from '@modules/incidents/incidents.module';
import { AuditModule } from '@modules/audit/audit.module';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TransformInterceptor } from '@common/interceptors/transform.interceptor';
import { AuditInterceptor } from '@common/interceptors/audit.interceptor';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    DomainModule,
    AuthModule,
    CatalogModule,
    ClientsModule,
    ClientDocumentsModule,
    PdfModule,
    ClosuresModule,
    AdvancesModule,
    PricingModule,
    CollectionsModule,
    ValidationsModule,
    IncidentsModule,
    AuditModule,
  ],
  providers: [
    // Guard JWT global — excluido con @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Guard de roles — activo cuando se usa @Roles()
    { provide: APP_GUARD, useClass: RolesGuard },
    // Interceptor de transformación uniforme de respuestas
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    // Interceptor de auditoría — innermost, ve la respuesta cruda del handler
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    // Filtro global de excepciones HTTP
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
