import { Op } from 'sequelize';
import Size from '../../models/Size';
import Product from '../../models/Product';
import { MasterCrud } from '../../common/masterCrud';


async function nextCode(shopId: string) {
  const used = new Set((await Size.findAll({ where: { shop_id: shopId }, attributes: ['code'] })).map((s) => s.code));
  for (let i = 1; i <= 99; i++) {
    const c = String(i).padStart(2, '0');
    if (!used.has(c)) return c;
  }
  return null;
}

const SizeService = new MasterCrud({
  model: Size,
  label: 'Size',
  defaults: [], // no auto-seeding, shop adds its own
  orderBy: [['sort_order', 'ASC'], ['name', 'ASC']],
  dropdownAttributes: ['id', 'name', 'code', 'sort_order'],
  fields: ['name', 'sort_order'],
  // 2-digit barcode code is generated, fixed after creation (old barcodes keep working)
  beforeCreate: async (shopId, body) => {
    const code = await nextCode(shopId);
    if (!code) return 'No free size codes left';
    return { code, sort_order: body.sort_order ?? 0 };
  },
  // products store the size name, keep them in sync on rename
  onRename: async (shopId, oldName, newName) => {
    await Product.update({ size: newName }, { where: { shop_id: shopId, size: { [Op.eq]: oldName } } });
  },
});

export default SizeService;
