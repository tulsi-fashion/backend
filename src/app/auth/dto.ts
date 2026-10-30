import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDTO {
  @IsString()
  shopName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  ownerName!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class LoginDTO {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RefreshTokenDTO {
  @IsString()
  refresh_token!: string;
}
