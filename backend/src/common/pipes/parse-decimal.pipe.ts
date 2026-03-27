import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/client';

@Injectable()
export class ParseDecimalPipe implements PipeTransform<string, Decimal> {
  transform(value: string): Decimal {
    const normalized = value.replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
      throw new BadRequestException(`"${value}" no es un número decimal válido`);
    }
    try {
      return new Decimal(normalized);
    } catch {
      throw new BadRequestException(`"${value}" no es un número decimal válido`);
    }
  }
}
