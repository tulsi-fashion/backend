import express from 'express';
import DashboardService from './service';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Handler from '../../common/handler';
import handleAuthorization from '../../middleware/handleAuthorization';

class DashboardRouterClass {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private async getStats(req: any, res: any): Promise<void> {
    try {
      const result = await DashboardService.getDashboardStatsService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async getAnalytics(req: any, res: any): Promise<void> {
    try {
      const result = await DashboardService.getAnalyticsService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private initializeRoutes(): void {
    this.router.get('/stats', handleAuthorization, this.getStats.bind(this));
    this.router.get('/analytics', handleAuthorization, this.getAnalytics.bind(this));
  }
}

export default new DashboardRouterClass().router;
