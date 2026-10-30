import express from 'express';
import AuthService from './service';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Handler from '../../common/handler';
import handleAuthorization from '../../middleware/handleAuthorization';
import dtoValidationMiddleware from '../../middleware/validation';
import { RegisterDTO, LoginDTO, RefreshTokenDTO } from './dto';

class AuthRouterClass {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private async register(req: any, res: any): Promise<void> {
    try {
      const result = await AuthService.registerService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async login(req: any, res: any): Promise<void> {
    try {
      const result = await AuthService.loginService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async refreshToken(req: any, res: any): Promise<void> {
    try {
      const result = await AuthService.refreshTokenService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async getMe(req: any, res: any): Promise<void> {
    try {
      const result = await AuthService.getMeService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async logout(req: any, res: any): Promise<void> {
    try {
      const result = await AuthService.logoutService(req);
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private async seed(_req: any, res: any): Promise<void> {
    try {
      const result = await AuthService.seedService();
      res.status((result as any)?.success?.statusCode || (result as any)?.error?.statusCode).json(result);
    } catch (error: any) {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  }

  private initializeRoutes(): void {
    this.router.get('/seed', this.seed.bind(this));                                          // public — no auth
    this.router.post('/register', dtoValidationMiddleware(RegisterDTO), this.register.bind(this));
    this.router.post('/login', dtoValidationMiddleware(LoginDTO), this.login.bind(this));
    this.router.post('/refresh', dtoValidationMiddleware(RefreshTokenDTO), this.refreshToken.bind(this));
    this.router.get('/me', handleAuthorization, this.getMe.bind(this));
    this.router.post('/logout', handleAuthorization, this.logout.bind(this));
  }
}

export default new AuthRouterClass().router;
