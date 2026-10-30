import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaleItemInput {
  @IsString()
  product_id!: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  qty!: number;

  @IsNumber()
  @Type(() => Number)
  price!: number;
}

export class CreateSaleDTO {
  @IsOptional()
  @IsString()
  customer_id?: string;

  @IsString()
  customer_name!: string;

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemInput)
  items!: SaleItemInput[];

  @IsNumber()
  @Type(() => Number)
  discount!: number;

  @IsNumber()
  @Type(() => Number)
  amount_paid!: number;

  @IsString()
  payment_method!: string;

  @IsString()
  date!: string;

  @IsOptional()
  @IsString()
  time?: string;
}

export class EditSaleDTO {
  @IsOptional()
  @IsString()
  customer_name?: string;

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemInput)
  items?: SaleItemInput[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  amount_paid?: number;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  date?: string;
}
