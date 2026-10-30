import express from 'express';
import ReportService from './service';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Handler from '../../common/handler';
import handleAuthorization from '../../middleware/handleAuthorization';

class ReportRouterClass {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private async getReports(req: any, res: any): Promise<void> {
    try {
      const result = await ReportService.getReportsService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async exportCsv(req: any, res: any): Promise<void> {
    try {
      const result = await ReportService.exportCsvService(req);
      if ((result as any)?.success) {
        const data = (result as any).success.data;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${data.filename}"`);
        res.status(200).send(data.csv);
      } else {
        res.status((result as any)?.error?.statusCode || 500).json(result);
      }
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private initializeRoutes(): void {
    this.router.get('/', handleAuthorization, this.getReports.bind(this));
    this.router.get('/export-csv', handleAuthorization, this.exportCsv.bind(this));
  }
}

export default new ReportRouterClass().router;
