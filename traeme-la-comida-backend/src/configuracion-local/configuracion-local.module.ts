import { Module } from '@nestjs/common';
import { ConfiguracionLocalController } from './configuracion-local.controller';
import { ConfiguracionLocalService } from './configuracion-local.service';

@Module({
  controllers: [ConfiguracionLocalController],
  providers: [ConfiguracionLocalService]
})
export class ConfiguracionLocalModule {}
