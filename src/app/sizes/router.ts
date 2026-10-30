import { buildMasterRouter } from '../../common/masterRouter';
import SizeService from './service';
import { CreateSizeDTO, UpdateSizeDTO } from './dto';

export default buildMasterRouter(SizeService, CreateSizeDTO, UpdateSizeDTO);
