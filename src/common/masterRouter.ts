import express from 'express';
import { MasterCrud } from './masterCrud';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from './statusMessageCode';
import Handler from './handler';
import handleAuthorization from '../middleware/handleAuthorization';
import dtoValidationMiddleware from '../middleware/validation';

/** Standard master-data router: dropdown, list, get, create, update, status, delete. */
export function buildMasterRouter(crud: MasterCrud, CreateDTO: any, UpdateDTO: any) {
  const router = express.Router();

  const run = (fn: (req: any) => Promise<any>) => async (req: any, res: any) => {
    try {
      const result = await fn(req);
      res.status(result?.success?.statusCode || result?.error?.statusCode).json(result);
    } catch {
      res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
    }
  };

  router.get('/dropdown', handleAuthorization, run(crud.dropdown));
  router.get('/', handleAuthorization, run(crud.list));
  router.get('/:id', handleAuthorization, run(crud.getById));
  router.post('/', handleAuthorization, dtoValidationMiddleware(CreateDTO), run(crud.create));
  router.put('/:id', handleAuthorization, dtoValidationMiddleware(UpdateDTO, true), run(crud.update));
  router.patch('/:id/status', handleAuthorization, run(crud.setStatus));
  router.patch('/:id/restore', handleAuthorization, run(crud.restore));
  router.delete('/:id', handleAuthorization, run(crud.remove));

  return router;
}
