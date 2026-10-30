import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Handler from '../../common/handler';

class HelloService {
  async helloWorldService(req: any) {
    try {
      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        message: 'Hello World from Tulshi Fashion API!',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.log('Error From Hello Service:', error);
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }
}

export default new HelloService();
