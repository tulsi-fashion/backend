import express from 'express';
import ProductService from './service';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Handler from '../../common/handler';
import handleAuthorization from '../../middleware/handleAuthorization';
import dtoValidationMiddleware from '../../middleware/validation';
import { CreateProductDTO, UpdateProductDTO, UpdateVariantDTO, UpdateStockDTO } from './dto';

class ProductRouterClass {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private async getAll(req: any, res: any): Promise<void> {
    try {
      const result = await ProductService.getAllProductsService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async create(req: any, res: any): Promise<void> {
    try {
      const result = await ProductService.createProductService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async getByBarcode(req: any, res: any): Promise<void> {
    try {
      const result = await ProductService.getProductByBarcodeService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async getBySku(req: any, res: any): Promise<void> {
    try {
      const result = await ProductService.getProductBySkuService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async getById(req: any, res: any): Promise<void> {
    try {
      const result = await ProductService.getProductByIdService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async update(req: any, res: any): Promise<void> {
    try {
      const result = await ProductService.updateProductService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async updateVariant(req: any, res: any): Promise<void> {
    try {
      const result = await ProductService.updateVariantService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async updateStock(req: any, res: any): Promise<void> {
    try {
      const result = await ProductService.updateStockService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async reduceStock(req: any, res: any): Promise<void> {
    try {
      const result = await ProductService.reduceStockService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async addVariants(req: any, res: any): Promise<void> {
    try {
      const result = await ProductService.addVariantsService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async remove(req: any, res: any): Promise<void> {
    try {
      const result = await ProductService.deleteProductService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async deleteVariant(req: any, res: any): Promise<void> {
    try {
      const result = await ProductService.deleteVariantService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private initializeRoutes(): void {
    this.router.get('/', handleAuthorization, this.getAll.bind(this));
    this.router.post('/', handleAuthorization, dtoValidationMiddleware(CreateProductDTO), this.create.bind(this));
    this.router.post('/add-variants', handleAuthorization, this.addVariants.bind(this));
    this.router.get('/barcode/:barcode', handleAuthorization, this.getByBarcode.bind(this));
    this.router.get('/sku/:sku', handleAuthorization, this.getBySku.bind(this));
    this.router.get('/:id', handleAuthorization, this.getById.bind(this));
    this.router.put('/:id', handleAuthorization, dtoValidationMiddleware(UpdateProductDTO, true), this.update.bind(this));
    this.router.put('/variant/:id', handleAuthorization, dtoValidationMiddleware(UpdateVariantDTO, true), this.updateVariant.bind(this));
    this.router.put('/variant/:id/stock', handleAuthorization, dtoValidationMiddleware(UpdateStockDTO), this.updateStock.bind(this));
    this.router.put('/variant/:id/reduce-stock', handleAuthorization, this.reduceStock.bind(this));
    this.router.delete('/variant/:id', handleAuthorization, this.deleteVariant.bind(this));
    this.router.delete('/:id', handleAuthorization, this.remove.bind(this));
  }
}

export default new ProductRouterClass().router;
