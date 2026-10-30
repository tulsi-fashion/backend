import { Op } from 'sequelize';
import Category from '../../models/Category';
import Product from '../../models/Product';
import { MasterCrud } from '../../common/masterCrud';


const CategoryService = new MasterCrud({
  model: Category,
  label: 'Category',
  defaults: [], // no auto-seeding, shop adds its own
  orderBy: [['name', 'ASC']],
  dropdownAttributes: ['id', 'name', 'code'],
  fields: ['name'],
  // SKU letter is generated from the name and stays fixed after rename (existing SKUs keep working)
  beforeCreate: async (_shopId, body) => ({
    code: (String(body.name).match(/[A-Za-z0-9]/)?.[0] || 'O').toUpperCase(),
  }),
  // products store the category name, keep them in sync on rename
  onRename: async (shopId, oldName, newName) => {
    await Product.update({ category: newName }, { where: { shop_id: shopId, category: { [Op.eq]: oldName } } });
  },
});

export default CategoryService;
