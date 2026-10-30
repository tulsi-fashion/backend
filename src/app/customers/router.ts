import express from 'express';
import CustomerService from './service';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Handler from '../../common/handler';
import handleAuthorization from '../../middleware/handleAuthorization';
import dtoValidationMiddleware from '../../middleware/validation';
import { CreateCustomerDTO, UpdateCustomerDTO } from './dto';

class CustomerRouterClass {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private async getAll(req: any, res: any): Promise<void> {
    try {
      const result = await CustomerService.getAllCustomersService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async create(req: any, res: any): Promise<void> {
    try {
      const result = await CustomerService.createCustomerService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async getById(req: any, res: any): Promise<void> {
    try {
      const result = await CustomerService.getCustomerByIdService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async update(req: any, res: any): Promise<void> {
    try {
      const result = await CustomerService.updateCustomerService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async remove(req: any, res: any): Promise<void> {
    try {
      const result = await CustomerService.deleteCustomerService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async getStats(req: any, res: any): Promise<void> {
    try {
      const result = await CustomerService.getCustomerStatsService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private initializeRoutes(): void {
    this.router.get('/', handleAuthorization, this.getAll.bind(this));
    this.router.post('/', handleAuthorization, dtoValidationMiddleware(CreateCustomerDTO), this.create.bind(this));
    this.router.get('/:id', handleAuthorization, this.getById.bind(this));
    this.router.get('/:id/stats', handleAuthorization, this.getStats.bind(this));
    this.router.put('/:id', handleAuthorization, dtoValidationMiddleware(UpdateCustomerDTO, true), this.update.bind(this));
    this.router.delete('/:id', handleAuthorization, this.remove.bind(this));
  }
}

export default new CustomerRouterClass().router;
