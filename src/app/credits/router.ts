import express from 'express';
import CreditService from './service';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Handler from '../../common/handler';
import handleAuthorization from '../../middleware/handleAuthorization';
import dtoValidationMiddleware from '../../middleware/validation';
import { CreateCreditDTO } from './dto';

class CreditRouterClass {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private async getAll(req: any, res: any): Promise<void> {
    try {
      const result = await CreditService.getAllCreditsService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async create(req: any, res: any): Promise<void> {
    try {
      const result = await CreditService.createCreditPaymentService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async getByPhone(req: any, res: any): Promise<void> {
    try {
      const result = await CreditService.getCustomerCreditsService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private initializeRoutes(): void {
    this.router.get('/', handleAuthorization, this.getAll.bind(this));
    this.router.post('/', handleAuthorization, dtoValidationMiddleware(CreateCreditDTO), this.create.bind(this));
    this.router.get('/customer/:phone', handleAuthorization, this.getByPhone.bind(this));
  }
}

export default new CreditRouterClass().router;
