import { IsString, IsOptional, IsBoolean, IsInt, Min, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSizeDTO {
  @IsString() @MinLength(1) @MaxLength(50)
  name!: string;

  @IsOptional() @IsInt() @Type(() => Number) @Min(0)
  sort_order?: number;

  @IsOptional() @IsBoolean()
  is_active?: boolean;
}

export class UpdateSizeDTO {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50)
  name?: string;

  @IsOptional() @IsInt() @Type(() => Number) @Min(0)
  sort_order?: number;

  @IsOptional() @IsBoolean()
  is_active?: boolean;
}
