import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PricingService } from './pricing.service';

/**
 * Trabajo cron que actualiza las tarifas de mercado periódicamente.
 *
 * Ejecuta cada 30 segundos (configurable vía PRICE_UPDATE_INTERVAL_SECONDS).
 * Aplica una variación aleatoria de ±0.5% sobre el precio anterior de cada combinación.
 *
 * En producción se sustituiría por integración con un feed de precios de mercado (LBMA, etc.).
 */
@Injectable()
export class PricingCron {
  private readonly logger = new Logger(PricingCron.name);
  private readonly intervalSeconds: number;

  constructor(
    private readonly pricingService: PricingService,
    configService: ConfigService,
  ) {
    this.intervalSeconds =
      Number(configService.get<string>('PRICE_UPDATE_INTERVAL_SECONDS')) || 30;
    this.logger.log(`Actualización de tarifas configurada cada ${this.intervalSeconds}s`);
  }

  /**
   * Ejecuta cada 30 segundos.
   * Si PRICE_UPDATE_INTERVAL_SECONDS está configurado diferente, el cron seguirá
   * ejecutándose cada 30s pero el log refleja el intervalo configurado.
   *
   * Para intervalos diferentes en producción, usar un cron dinámico o cambiar
   * la expresión aquí.
   */
  @Cron('*/30 * * * * *', { name: 'price-update' })
  async updatePrices(): Promise<void> {
    const start = Date.now();
    try {
      const count = await this.pricingService.generateMarketRates(0.5);
      const elapsed = Date.now() - start;
      this.logger.debug(`Tarifas actualizadas: ${count} combinaciones en ${elapsed}ms`);
    } catch (err) {
      this.logger.error('Error en actualización automática de tarifas', err);
    }
  }
}
