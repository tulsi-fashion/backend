import { Response, NextFunction } from 'express';
import { STATUS_CODE, RES_STATUS, RES_MESSAGE } from '../common/statusMessageCode';
import Handler from '../common/handler';

const handleAuthorization = (req: any, res: Response, next: NextFunction) => {
  const token =
    (req.headers['access_token'] as string) ||
    (req.headers['authorization'] as string)?.replace('Bearer ', '');

  if (!token) {
    res
      .status(STATUS_CODE.EC401)
      .json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC401, RES_MESSAGE.EM401));
    return;
  }

  try {
    const decoded: any = Handler.verifyToken(token);
    req.user = decoded;
    req.userId = decoded.userId;
    req.shopId = decoded.shopId;
    next();
  } catch (err: any) {
    if (err?.name === 'TokenExpiredError') {
      res
        .status(STATUS_CODE.EC401)
        .json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC401, RES_MESSAGE.TOKEN_EXPIRED));
      return;
    }
    res
      .status(STATUS_CODE.EC401)
      .json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC401, RES_MESSAGE.EM401));
  }
};

export default handleAuthorization;
