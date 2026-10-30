import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class CreateCategoryDTO {
  @IsString() @MinLength(1) @MaxLength(100)
  name!: string;

  @IsOptional() @IsBoolean()
  is_active?: boolean;
}

export class UpdateCategoryDTO {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  name?: string;

  @IsOptional() @IsBoolean()
  is_active?: boolean;
}
