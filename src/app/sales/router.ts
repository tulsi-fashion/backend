import express from 'express';
import multer from 'multer';
import SaleService from './service';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Handler from '../../common/handler';
import handleAuthorization from '../../middleware/handleAuthorization';
import dtoValidationMiddleware from '../../middleware/validation';
import { CreateSaleDTO, EditSaleDTO } from './dto';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for invoice upload'));
    }
  },
});

class SaleRouterClass {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private async getAll(req: any, res: any): Promise<void> {
    try {
      const result = await SaleService.getAllSalesService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async create(req: any, res: any): Promise<void> {
    try {
      const result = await SaleService.createSaleService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async getById(req: any, res: any): Promise<void> {
    try {
      const result = await SaleService.getSaleByIdService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async edit(req: any, res: any): Promise<void> {
    try {
      const result = await SaleService.editSaleService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async getPublic(req: any, res: any): Promise<void> {
    try {
      const result = await SaleService.getPublicSaleService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async uploadPdf(req: any, res: any): Promise<void> {
    try {
      const result = await SaleService.uploadInvoicePdfService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private initializeRoutes(): void {
    this.router.get('/', handleAuthorization, this.getAll.bind(this));
    this.router.post('/', handleAuthorization, dtoValidationMiddleware(CreateSaleDTO), this.create.bind(this));
    // Public invoice link — no auth required. Needs matching invoice_no + customer_id.
    this.router.get('/public/:invoice_no/:customer_id', this.getPublic.bind(this));
    this.router.get('/:id', handleAuthorization, this.getById.bind(this));
    this.router.put('/:id', handleAuthorization, dtoValidationMiddleware(EditSaleDTO, true), this.edit.bind(this));
    this.router.post('/:id/upload-pdf', handleAuthorization, upload.single('invoice'), this.uploadPdf.bind(this));
  }
}

export default new SaleRouterClass().router;
