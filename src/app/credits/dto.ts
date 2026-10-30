import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCreditDTO {
  @IsOptional()
  @IsString()
  customer_id?: string;

  @IsString()
  customer_name!: string;

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsString()
  @IsIn(['credit', 'payment', 'partial_settlement'])
  type!: string;

  @IsNumber()
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  date!: string;
}
