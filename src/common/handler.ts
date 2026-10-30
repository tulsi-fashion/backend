import jwt from 'jsonwebtoken';
import db_config from '../config';

export interface SuccessResponse {
  success: {
    status: boolean;
    statusCode: number;
    message: string;
    data: any;
  };
  error?: undefined;
}

export interface ErrorResponse {
  error: {
    status: boolean;
    statusCode: number;
    message: string;
    data: any;
  };
  success?: undefined;
}

export type ApiResponse = SuccessResponse | ErrorResponse;

class Handler {
  Success(status: boolean, statusCode: number, message: string, data?: any): ApiResponse {
    return {
      success: {
        status,
        statusCode,
        message,
        data: data ?? null,
      },
    };
  }

  Error(status: boolean, statusCode: number, message: string, data?: any): ApiResponse {
    return {
      error: {
        status,
        statusCode,
        message,
        data: data ?? null,
      },
    };
  }

  capitalizeFirstLetter(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  generateToken(payload: object, expiresIn: string = '7d'): string {
    return jwt.sign(payload, db_config.SECRET_KEY, { expiresIn } as any);
  }

  generateRefreshToken(payload: object, expiresIn: string = '30d'): string {
    const secret = process.env.JWT_REFRESH_SECRET || db_config.SECRET_KEY + '_refresh';
    return jwt.sign(payload, secret, { expiresIn } as any);
  }

  verifyToken(token: string): any {
    return jwt.verify(token, db_config.SECRET_KEY);
  }

  verifyRefreshToken(token: string): any {
    const secret = process.env.JWT_REFRESH_SECRET || db_config.SECRET_KEY + '_refresh';
    return jwt.verify(token, secret);
  }

  generateInvoiceNo(shopId: string, count: number): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const shopPrefix = shopId.slice(0, 4).toUpperCase();
    return `INV-${shopPrefix}-${date}-${String(count + 1).padStart(4, '0')}`;
  }

  generateSKU(category: string, sequence: number, categoryCode?: string): string {
    if (categoryCode) return `TF-${categoryCode.toUpperCase()}${String(sequence).padStart(4, '0')}`;
    const codes: Record<string, string> = {
      kurti: 'K',
      suit: 'S',
      saree: 'R',
      dupatta: 'D',
      other: 'O',
    };
    const code = codes[category?.toLowerCase()] || 'O';
    return `TF-${code}${String(sequence).padStart(4, '0')}`;
  }

  generateBarcode(productSequence: number, sizeCode: string, sizeCodeOverride?: string): string {
    const sizeCodes: Record<string, string> = {
      XS: '01',
      S: '02',
      M: '03',
      L: '04',
      XL: '05',
      '2XL': '06',
      '3XL': '07',
      '4XL': '08',
      '5XL': '09',
    };
    const sc = sizeCodeOverride || sizeCodes[sizeCode?.toUpperCase()] || '99';
    const seq = String(productSequence).padStart(4, '0');
    const checksum = (productSequence + parseInt(sc)) % 10;
    return `TF${seq}${sc}${checksum}`;
  }
}

export default new Handler();
