import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateAdvanceDto {
  @ApiProperty({
    example: '1500.00',
    description: 'Importe del adelanto en euros (máximo 75% del total del cierre)',
  })
  @IsString()
  @IsNotEmpty({ message: 'El importe es obligatorio' })
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'El importe debe ser un número positivo con hasta 2 decimales' })
  amount!: string;

  @ApiProperty({ enum: PaymentMethod, description: 'Método de pago del adelanto' })
  @IsEnum(PaymentMethod, { message: 'El método de pago debe ser CASH, TRANSFER u OTHER' })
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ description: 'Observaciones sobre el adelanto' })
  @IsOptional()
  @IsString()
  observations?: string;
}
