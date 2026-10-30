import express from 'express';
import PartialPaymentService from './service';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Handler from '../../common/handler';
import handleAuthorization from '../../middleware/handleAuthorization';
import dtoValidationMiddleware from '../../middleware/validation';
import { SettlePartialPaymentDTO } from './dto';

class PartialPaymentRouterClass {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private async getAll(req: any, res: any): Promise<void> {
    try {
      const result = await PartialPaymentService.getAllPartialPaymentsService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async getByCustomer(req: any, res: any): Promise<void> {
    try {
      const result = await PartialPaymentService.getByCustomerService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async settle(req: any, res: any): Promise<void> {
    try {
      const result = await PartialPaymentService.settlePartialPaymentService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private initializeRoutes(): void {
    this.router.get('/', handleAuthorization, this.getAll.bind(this));
    this.router.get('/by-customer', handleAuthorization, this.getByCustomer.bind(this));
    this.router.post('/:id/settle', handleAuthorization, dtoValidationMiddleware(SettlePartialPaymentDTO), this.settle.bind(this));
  }
}

export default new PartialPaymentRouterClass().router;
