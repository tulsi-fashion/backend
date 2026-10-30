import { buildMasterRouter } from '../../common/masterRouter';
import CategoryService from './service';
import { CreateCategoryDTO, UpdateCategoryDTO } from './dto';

export default buildMasterRouter(CategoryService, CreateCategoryDTO, UpdateCategoryDTO);
