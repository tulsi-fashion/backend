import { Op } from 'sequelize';
import Handler from '../../common/handler';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Product from '../../models/Product';
import ProductVariant from '../../models/ProductVariant';
import ProductFile from '../../models/ProductFile';
import Category from '../../models/Category';
import Size from '../../models/Size';
import Purchase from '../../models/Purchase';
import { db } from '../../config/db';

class ProductService {
  async createProductService(req: any) {
    const t = await db.transaction();
    try {
      const {
        name,
        category_id,
        variants, // Array<{ size_id: string; qty?: number; purchase_price?: number; selling_price?: number }>
        purchase_price,
        selling_price,
        notes,
        sku_override,
        photo_url,
      } = req.body;
      const shopId = req.shopId;

      if (!variants || variants.length === 0) {
        await t.rollback();
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'At least one size variant is required');
      }

      const categoryRow = await Category.findOne({
        where: { id: category_id, shop_id: shopId, is_deleted: false, is_active: true },
        transaction: t,
      });
      if (!categoryRow) {
        await t.rollback();
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'Category is not available');
      }

      const sizeIds = variants.map((v: any) => v.size_id);
      const uniqueSizeIds = new Set(sizeIds);
      if (uniqueSizeIds.size !== sizeIds.length) {
        await t.rollback();
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'Duplicate sizes are not allowed');
      }

      const sizeRows = await Size.findAll({
        where: { id: { [Op.in]: sizeIds }, shop_id: shopId, is_deleted: false, is_active: true },
        transaction: t,
      });
      if (sizeRows.length !== sizeIds.length) {
        await t.rollback();
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'One or more sizes are not available');
      }
      const sizeMap = new Map(sizeRows.map(s => [s.id, s]));

      const distinctSkuCount = await Product.count({
        where: { shop_id: shopId },
        distinct: true,
        col: 'sku',
      });
      const sequence = distinctSkuCount + 1;
      const sku = sku_override || Handler.generateSKU(categoryRow.name, sequence, categoryRow.code);

      const product = await Product.create(
        {
          shop_id: shopId,
          sku,
          name,
          category_id,
          purchase_price: Number(purchase_price),
          selling_price: Number(selling_price),
          notes: notes || null,
          photo_url: photo_url || null,
          product_sequence: sequence,
          is_active: true,
          is_deleted: false,
        },
        { transaction: t }
      );

      const createdVariants: any[] = [];

      for (const variant of variants) {
        const sizeRow = sizeMap.get(variant.size_id);
        if (!sizeRow) continue;

        const barcode = Handler.generateBarcode(sequence, sizeRow.name, sizeRow.code);

        const existingBarcode = await ProductVariant.findOne({
          where: { barcode, shop_id: shopId },
          transaction: t,
        });
        if (existingBarcode) {
          await t.rollback();
          return Handler.Error(
            RES_STATUS.E2,
            STATUS_CODE.EC409,
            `Barcode collision for size ${sizeRow.name}`
          );
        }

        const pv = await ProductVariant.create(
          {
            shop_id: shopId,
            product_id: product.id,
            size_id: variant.size_id,
            barcode,
            purchase_price: variant.purchase_price != null ? Number(variant.purchase_price) : null,
            selling_price: variant.selling_price != null ? Number(variant.selling_price) : null,
            stock: Number(variant.qty) || 0,
            reorder_level: 0,
            photo_url: variant.photo_url || null,
            is_active: true,
            is_deleted: false,
          },
          { transaction: t }
        );

        const variantPhotoUrls: string[] = variant.photo_urls || [];
        for (let i = 0; i < variantPhotoUrls.length; i++) {
          await ProductFile.create(
            {
              shop_id: shopId,
              product_id: product.id,
              variant_id: pv.id,
              file_url: variantPhotoUrls[i],
              file_type: 'image',
              sort_order: i,
            },
            { transaction: t }
          );
        }

        createdVariants.push({
          id: pv.id,
          size: sizeRow.name,
          size_id: sizeRow.id,
          barcode: pv.barcode,
          stock: pv.stock,
          purchase_price: pv.purchase_price,
          selling_price: pv.selling_price,
        });

        if (Number(variant.qty) > 0) {
          await Purchase.create(
            {
              shop_id: shopId,
              product_id: product.id,
              qty: Number(variant.qty),
              unit_cost: variant.purchase_price != null ? Number(variant.purchase_price) : Number(purchase_price),
              supplier: 'Opening Stock',
              date: new Date().toISOString().slice(0, 10),
              notes: 'Opening stock entry',
            },
            { transaction: t }
          );
        }
      }

      // Save additional product photos as ProductFile records
      const photoUrls: string[] = req.body.photo_urls || [];
      for (let i = 0; i < photoUrls.length; i++) {
        await ProductFile.create(
          {
            shop_id: shopId,
            product_id: product.id,
            variant_id: null,
            file_url: photoUrls[i],
            file_type: 'image',
            sort_order: i,
          },
          { transaction: t }
        );
      }

      await t.commit();

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC201, RES_MESSAGE.EM201, {
        product: { ...product.toJSON(), variants: createdVariants },
        sku,
      });
    } catch (error: any) {
      await t.rollback();
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async getAllProductsService(req: any) {
    try {
      const shopId = req.shopId;
      const { search, category_id, low_stock, page = 1, limit = 100, show_inactive } = req.query;

      const where: any = { shop_id: shopId, is_deleted: false };
      if (show_inactive !== 'true') {
        where.is_active = true;
      }

      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { sku: { [Op.iLike]: `%${search}%` } },
          { '$variants.barcode$': { [Op.iLike]: `%${search}%` } },
        ];
      }

      if (category_id) {
        where.category_id = category_id;
      }

      const offset = (Number(page) - 1) * Number(limit);

      const { count, rows: products } = await Product.findAndCountAll({
        where,
        include: [
          {
            model: Category,
            as: 'category_info',
            attributes: ['id', 'name', 'code'],
          },
          {
            model: ProductVariant,
            as: 'variants',
            where: { is_deleted: false },
            required: false,
            include: [
              {
                model: Size,
                as: 'size_info',
                attributes: ['id', 'name', 'code'],
              },
              {
                model: ProductFile,
                as: 'files',
                attributes: ['id', 'file_url', 'file_type', 'sort_order'],
                required: false,
              },
            ],
          },
          {
            model: ProductFile,
            as: 'files',
            where: { variant_id: null },
            attributes: ['id', 'file_url', 'file_type', 'sort_order'],
            required: false,
          },
        ],
        order: [['created_at', 'DESC']],
        limit: Number(limit),
        offset,
        distinct: true,
        subQuery: false,
      });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        products,
        total: count,
        page: Number(page),
        totalPages: Math.ceil(count / Number(limit)),
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async getProductByBarcodeService(req: any) {
    try {
      const { barcode } = req.params;
      const shopId = req.shopId;

      const variant = await ProductVariant.findOne({
        where: { barcode, shop_id: shopId, is_active: true, is_deleted: false },
        include: [
          {
            model: Product,
            as: 'product',
            where: { is_deleted: false },
            include: [{ model: Category, as: 'category_info', attributes: ['id', 'name'] }],
          },
          { model: Size, as: 'size_info', attributes: ['id', 'name', 'code'] },
        ],
      });

      if (!variant) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      const product = variant.product;
      const result = {
        id: variant.id,
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: variant.barcode,
        size: variant.size_info?.name,
        category: product.category_info?.name,
        purchase_price: variant.purchase_price ?? product.purchase_price,
        selling_price: variant.selling_price ?? product.selling_price,
        stock: variant.stock,
        photo_url: product.photo_url,
        is_active: variant.is_active,
      };

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, { product: result });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async getProductBySkuService(req: any) {
    try {
      const { sku } = req.params;
      const shopId = req.shopId;

      const product = await Product.findOne({
        where: { sku, shop_id: shopId, is_deleted: false },
        include: [
          { model: Category, as: 'category_info', attributes: ['id', 'name'] },
          {
            model: ProductVariant,
            as: 'variants',
            where: { is_deleted: false, is_active: true },
            required: false,
            include: [{ model: Size, as: 'size_info', attributes: ['id', 'name', 'code'] }],
          },
        ],
      });

      if (!product) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, { product });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async getProductByIdService(req: any) {
    try {
      const { id } = req.params;
      const shopId = req.shopId;

      const product = await Product.findOne({
        where: { id, shop_id: shopId, is_deleted: false },
        include: [
          { model: Category, as: 'category_info', attributes: ['id', 'name', 'code'] },
          {
            model: ProductVariant,
            as: 'variants',
            where: { is_deleted: false },
            required: false,
            include: [
              { model: Size, as: 'size_info', attributes: ['id', 'name', 'code'] },
              {
                model: ProductFile,
                as: 'files',
                attributes: ['id', 'file_url', 'file_type', 'sort_order'],
                required: false,
              },
            ],
          },
          {
            model: ProductFile,
            as: 'files',
            where: { variant_id: null },
            attributes: ['id', 'file_url', 'file_type', 'sort_order'],
            required: false,
          },
        ],
      });

      if (!product) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, { product });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async updateProductService(req: any) {
    try {
      const { id } = req.params;
      const shopId = req.shopId;
      const { name, category_id, purchase_price, selling_price, notes, photo_url, photo_urls, is_active } = req.body;

      const product = await Product.findOne({ where: { id, shop_id: shopId, is_deleted: false } });
      if (!product) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (category_id !== undefined) updateData.category_id = category_id;
      if (purchase_price !== undefined) updateData.purchase_price = Number(purchase_price);
      if (selling_price !== undefined) updateData.selling_price = Number(selling_price);
      if (notes !== undefined) updateData.notes = notes;
      if (photo_url !== undefined) updateData.photo_url = photo_url;
      if (is_active !== undefined) updateData.is_active = is_active;

      await product.update(updateData);

      if (photo_urls !== undefined) {
        await ProductFile.destroy({ where: { product_id: id, variant_id: null, shop_id: shopId } });
        for (let i = 0; i < photo_urls.length; i++) {
          await ProductFile.create({
            shop_id: shopId,
            product_id: id,
            variant_id: null,
            file_url: photo_urls[i],
            file_type: 'image',
            sort_order: i,
          });
        }
      }

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM208, { product });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async updateVariantService(req: any) {
    try {
      const { id } = req.params;
      const shopId = req.shopId;
      const { purchase_price, selling_price, stock, photo_url, photo_urls, is_active } = req.body;

      const variant = await ProductVariant.findOne({ where: { id, shop_id: shopId, is_deleted: false } });
      if (!variant) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      const updateData: any = {};
      if (purchase_price !== undefined) updateData.purchase_price = purchase_price === null ? null : Number(purchase_price);
      if (selling_price !== undefined) updateData.selling_price = selling_price === null ? null : Number(selling_price);
      if (stock !== undefined) updateData.stock = Number(stock);
      if (photo_url !== undefined) updateData.photo_url = photo_url === null ? null : photo_url;
      if (is_active !== undefined) updateData.is_active = is_active;

      await variant.update(updateData);

      if (photo_urls !== undefined) {
        await ProductFile.destroy({ where: { variant_id: id, shop_id: shopId } });
        for (let i = 0; i < photo_urls.length; i++) {
          await ProductFile.create({
            shop_id: shopId,
            product_id: variant.product_id,
            variant_id: id,
            file_url: photo_urls[i],
            file_type: 'image',
            sort_order: i,
          });
        }
      }

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM208, { variant });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async addVariantsService(req: any) {
    const t = await db.transaction();
    try {
      const shopId = req.shopId;
      const { product_id, variants } = req.body;

      if (!variants || variants.length === 0) {
        await t.rollback();
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'At least one variant is required');
      }

      const product = await Product.findOne({
        where: { id: product_id, shop_id: shopId, is_deleted: false },
        transaction: t,
      });
      if (!product) {
        await t.rollback();
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, 'Product not found');
      }

      const sizeIds = variants.map((v: any) => v.size_id);
      const sizeRows = await Size.findAll({
        where: { id: { [Op.in]: sizeIds }, shop_id: shopId, is_deleted: false, is_active: true },
        transaction: t,
      });
      const sizeMap = new Map(sizeRows.map(s => [s.id, s]));

      const createdVariants: any[] = [];

      for (const variant of variants) {
        const sizeRow = sizeMap.get(variant.size_id);
        if (!sizeRow) continue;

        const existing = await ProductVariant.findOne({
          where: { product_id, size_id: variant.size_id, shop_id: shopId, is_deleted: false },
          transaction: t,
        });
        if (existing) {
          await t.rollback();
          return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC409, `Size ${sizeRow.name} already exists for this product`);
        }

        const barcode = Handler.generateBarcode(product.product_sequence, sizeRow.name, sizeRow.code);

        const pv = await ProductVariant.create(
          {
            shop_id: shopId,
            product_id,
            size_id: variant.size_id,
            barcode,
            purchase_price: variant.purchase_price != null ? Number(variant.purchase_price) : null,
            selling_price: variant.selling_price != null ? Number(variant.selling_price) : null,
            stock: Number(variant.qty) || 0,
            reorder_level: 0,
            photo_url: variant.photo_url || null,
            is_active: true,
            is_deleted: false,
          },
          { transaction: t }
        );

        const variantPhotoUrls: string[] = variant.photo_urls || [];
        for (let i = 0; i < variantPhotoUrls.length; i++) {
          await ProductFile.create(
            {
              shop_id: shopId,
              product_id,
              variant_id: pv.id,
              file_url: variantPhotoUrls[i],
              file_type: 'image',
              sort_order: i,
            },
            { transaction: t }
          );
        }

        createdVariants.push({
          id: pv.id,
          size: sizeRow.name,
          barcode: pv.barcode,
          stock: pv.stock,
        });
      }

      await t.commit();
      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC201, 'Variants added', { variants: createdVariants });
    } catch (error: any) {
      await t.rollback();
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async updateStockService(req: any) {
    const t = await db.transaction();
    try {
      const { id } = req.params;
      const shopId = req.shopId;
      const { qty, unit_cost, supplier, date, notes } = req.body;

      const variant = await ProductVariant.findOne({
        where: { id, shop_id: shopId, is_deleted: false },
        transaction: t,
      });

      if (!variant) {
        await t.rollback();
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      const newStock = variant.stock + Number(qty);
      await variant.update(
        { stock: newStock, purchase_price: Number(unit_cost) },
        { transaction: t }
      );

      const purchase = await Purchase.create(
        {
          shop_id: shopId,
          product_id: variant.product_id,
          qty: Number(qty),
          unit_cost: Number(unit_cost),
          supplier: supplier || null,
          date: date || new Date().toISOString().slice(0, 10),
          notes: notes || null,
        },
        { transaction: t }
      );

      await t.commit();

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM208, {
        variant,
        purchase,
        new_stock: newStock,
      });
    } catch (error: any) {
      await t.rollback();
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async reduceStockService(req: any) {
    try {
      const { id } = req.params;
      const shopId = req.shopId;
      const { qty } = req.body;

      const variant = await ProductVariant.findOne({
        where: { id, shop_id: shopId, is_deleted: false },
      });

      if (!variant) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      const reduceBy = Number(qty);
      if (reduceBy > variant.stock) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, `Cannot reduce more than current stock (${variant.stock})`);
      }

      const newStock = variant.stock - reduceBy;
      await variant.update({ stock: newStock });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM208, {
        variant,
        new_stock: newStock,
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async deleteProductService(req: any) {
    const t = await db.transaction();
    try {
      const { id } = req.params;
      const shopId = req.shopId;

      const product = await Product.findOne({ where: { id, shop_id: shopId, is_deleted: false }, transaction: t });
      if (!product) {
        await t.rollback();
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      await product.update({ is_deleted: true, is_active: false }, { transaction: t });
      await ProductVariant.update(
        { is_deleted: true, is_active: false },
        { where: { product_id: id, shop_id: shopId }, transaction: t }
      );

      await t.commit();
      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM210, null);
    } catch (error: any) {
      await t.rollback();
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async deleteVariantService(req: any) {
    try {
      const { id } = req.params;
      const shopId = req.shopId;

      const variant = await ProductVariant.findOne({ where: { id, shop_id: shopId, is_deleted: false } });
      if (!variant) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      await variant.update({ is_deleted: true, is_active: false });
      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM210, null);
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }
}

export default new ProductService();
