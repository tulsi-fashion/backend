import express from 'express';
import SettingsService from './service';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Handler from '../../common/handler';
import handleAuthorization from '../../middleware/handleAuthorization';
import dtoValidationMiddleware from '../../middleware/validation';
import { UpdateBrandingDTO } from './dto';

class SettingsRouterClass {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private async getSettings(req: any, res: any): Promise<void> {
    try {
      const result = await SettingsService.getSettingsService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async updateBranding(req: any, res: any): Promise<void> {
    try {
      const result = await SettingsService.updateBrandingService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async testR2(req: any, res: any): Promise<void> {
    try {
      const result = await SettingsService.testR2ConnectionService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async updateProfile(req: any, res: any): Promise<void> {
    try {
      const result = await SettingsService.updateProfileService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async changePassword(req: any, res: any): Promise<void> {
    try {
      const result = await SettingsService.changePasswordService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private initializeRoutes(): void {
    this.router.get('/', handleAuthorization, this.getSettings.bind(this));
    this.router.put('/branding', handleAuthorization, dtoValidationMiddleware(UpdateBrandingDTO, true), this.updateBranding.bind(this));
    this.router.put('/profile', handleAuthorization, this.updateProfile.bind(this));
    this.router.post('/test-r2', handleAuthorization, this.testR2.bind(this));
    this.router.post('/change-password', handleAuthorization, this.changePassword.bind(this));
  }
}

export default new SettingsRouterClass().router;
