import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { sanitize } from 'class-sanitizer';
import { Request, Response, NextFunction } from 'express';
import { STATUS_CODE, RES_STATUS, RES_MESSAGE } from '../common/statusMessageCode';
import Handler from '../common/handler';

function dtoValidationMiddleware(type: any, skipMissingProperties = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    const dto = plainToClass(type, req.body);
    sanitize(dto);
    validate(dto, { skipMissingProperties }).then((errors) => {
      if (errors.length > 0) {
        const message = errors
          .map((error) => Object.values(error.constraints || {}).join(', '))
          .join('; ');
        res
          .status(STATUS_CODE.EC422)
          .json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC422, message));
      } else {
        req.body = dto;
        next();
      }
    });
  };
}

export default dtoValidationMiddleware;
