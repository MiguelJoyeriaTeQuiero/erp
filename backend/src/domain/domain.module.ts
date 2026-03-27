import { Global, Module } from '@nestjs/common';
import { PricingCalculatorService } from './pricing-calculator.service';
import { ConversionService } from './conversion.service';
import { StateMachineService } from './state-machine.service';
import { ReconciliationService } from './reconciliation.service';
import { IncidentGeneratorService } from './incident-generator.service';

const DOMAIN_SERVICES = [
  PricingCalculatorService,
  ConversionService,
  StateMachineService,
  ReconciliationService,
  IncidentGeneratorService,
];

@Global()
@Module({
  providers: DOMAIN_SERVICES,
  exports: DOMAIN_SERVICES,
})
export class DomainModule {}
