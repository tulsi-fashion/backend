import express from 'express';
import HelloService from './service';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Handler from '../../common/handler';

class HelloRouterClass {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private async helloWorld(req: any, res: any): Promise<void> {
    try {
      const result = await HelloService.helloWorldService(req);
      res.status(result?.success?.statusCode || result?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private initializeRoutes(): void {
    this.router.get('/', this.helloWorld);
  }
}

export default new HelloRouterClass().router;
