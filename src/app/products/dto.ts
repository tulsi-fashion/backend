import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, Min, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class SizeVariantDTO {
  @IsUUID()
  size_id!: string;

  @IsOptional() @IsNumber() @Type(() => Number) @Min(0)
  qty?: number;

  @IsOptional() @IsNumber() @Type(() => Number) @Min(0)
  purchase_price?: number;

  @IsOptional() @IsNumber() @Type(() => Number) @Min(0)
  selling_price?: number;

  @IsOptional() @IsString()
  photo_url?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  photo_urls?: string[];
}

export class CreateProductDTO {
  @IsString()
  name!: string;

  @IsUUID()
  category_id!: string;

  @IsNumber() @Type(() => Number)
  purchase_price!: number;

  @IsNumber() @Type(() => Number)
  selling_price!: number;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  sku_override?: string;

  @IsOptional() @IsString()
  photo_url?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  photo_urls?: string[];

  @IsArray() @ValidateNested({ each: true }) @Type(() => SizeVariantDTO)
  variants!: SizeVariantDTO[];
}

export class UpdateProductDTO {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsUUID()
  category_id?: string;

  @IsOptional() @IsNumber() @Type(() => Number)
  purchase_price?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  selling_price?: number;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  photo_url?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  photo_urls?: string[];

  @IsOptional() @IsBoolean()
  is_active?: boolean;
}

export class UpdateVariantDTO {
  @IsOptional() @IsNumber() @Type(() => Number)
  purchase_price?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  selling_price?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  stock?: number;

  @IsOptional() @IsString()
  photo_url?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  photo_urls?: string[];

  @IsOptional() @IsBoolean()
  is_active?: boolean;
}

export class UpdateStockDTO {
  @IsNumber() @Type(() => Number) @Min(1)
  qty!: number;

  @IsNumber() @Type(() => Number)
  unit_cost!: number;

  @IsOptional() @IsString()
  supplier?: string;

  @IsOptional() @IsString()
  date?: string;

  @IsOptional() @IsString()
  notes?: string;
}
