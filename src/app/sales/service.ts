import { Op } from 'sequelize';
import Handler from '../../common/handler';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Sale from '../../models/Sale';
import SaleItem from '../../models/SaleItem';
import Product from '../../models/Product';
import ProductVariant from '../../models/ProductVariant';
import Size from '../../models/Size';
import Customer from '../../models/Customer';
import Credit from '../../models/Credit';
import PartialPayment from '../../models/PartialPayment';
import { db } from '../../config/db';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import db_config from '../../config';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: db_config.R2.R2_S3_API_URL,
  credentials: {
    accessKeyId: db_config.R2.R2_ACCESS_KEY_ID,
    secretAccessKey: db_config.R2.R2_SECRET_ACCESS_KEY,
  },
});

async function uploadInvoicePDF(buffer: Buffer, invoiceNo: string, shopId: string): Promise<string> {
  const key = `invoices/${shopId}/${invoiceNo}.pdf`;
  await r2Client.send(
    new PutObjectCommand({
      Bucket: db_config.R2.R2_PUBLIC_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
    })
  );
  return `${db_config.R2.R2_PUBLIC_URL}/${key}`;
}

class SaleService {
  async createSaleService(req: any) {
    const t = await db.transaction();
    try {
      const {
        customer_id,
        customer_name,
        customer_phone,
        items,
        discount,
        amount_paid,
        payment_method,
        date,
        time,
      } = req.body;
      const shopId = req.shopId;

      const variantIds = items.map((i: any) => i.variant_id || i.product_id);
      const variants = await ProductVariant.findAll({
        where: { id: variantIds, shop_id: shopId, is_active: true, is_deleted: false },
        include: [
          { model: Product, as: 'product' },
          { model: Size, as: 'size_info', attributes: ['id', 'name'] },
        ],
        transaction: t,
      });

      const variantMap = new Map(variants.map((v) => [v.id, v]));

      for (const item of items) {
        const variantId = item.variant_id || item.product_id;
        const variant = variantMap.get(variantId);
        if (!variant) {
          await t.rollback();
          return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, `Product variant ${variantId} not found`);
        }
        if (variant.stock < item.qty) {
          await t.rollback();
          return Handler.Error(
            RES_STATUS.E2,
            STATUS_CODE.EC400,
            `Insufficient stock for ${variant.product?.name} (${variant.size_info?.name}). Available: ${variant.stock}`
          );
        }
      }

      let subtotal = 0;
      let cogs = 0;

      for (const item of items) {
        const variantId = item.variant_id || item.product_id;
        const variant = variantMap.get(variantId)!;
        subtotal += Number(item.price) * Number(item.qty);
        const costPrice = variant.purchase_price ?? variant.product?.purchase_price ?? 0;
        cogs += Number(costPrice) * Number(item.qty);
      }

      const discountAmt = Number(discount) || 0;
      const total = subtotal - discountAmt;
      const amountPaid = Number(amount_paid);
      const amountDue = Math.max(0, total - amountPaid);
      const grossProfit = total - cogs;

      let paymentStatus: string;
      if (amountDue <= 0) {
        paymentStatus = 'paid';
      } else if (amountPaid > 0 && amountDue < total) {
        paymentStatus = 'partial';
      } else {
        paymentStatus = 'due';
      }

      const saleCount = await Sale.count({ where: { shop_id: shopId }, transaction: t });
      const invoiceNo = Handler.generateInvoiceNo(shopId, saleCount);

      let customerId = customer_id || null;
      if (customer_name && customer_name.toLowerCase() !== 'walk-in' && customer_phone && !customerId) {
        let customer = await Customer.findOne({
          where: { phone: customer_phone, shop_id: shopId },
          transaction: t,
        });
        if (!customer) {
          customer = await Customer.create(
            { shop_id: shopId, name: customer_name, phone: customer_phone, phone_code: '91' },
            { transaction: t }
          );
        }
        customerId = customer.id;
      }

      const sale = await Sale.create(
        {
          shop_id: shopId,
          invoice_no: invoiceNo,
          customer_id: customerId,
          customer_name: customer_name || 'Walk-in',
          customer_phone: customer_phone || null,
          subtotal,
          discount: discountAmt,
          total,
          amount_paid: amountPaid,
          amount_due: amountDue,
          cogs,
          gross_profit: grossProfit,
          payment_method: payment_method || 'cash',
          payment_status: paymentStatus,
          date,
          time: time || new Date().toTimeString().slice(0, 8),
        },
        { transaction: t }
      );

      const saleItems: SaleItem[] = [];
      for (const item of items) {
        const variantId = item.variant_id || item.product_id;
        const variant = variantMap.get(variantId)!;
        const product = variant.product!;
        const costPrice = variant.purchase_price ?? product.purchase_price ?? 0;

        const saleItem = await SaleItem.create(
          {
            sale_id: sale.id,
            product_id: product.id,
            sku: product.sku,
            barcode: variant.barcode,
            name: product.name,
            size: variant.size_info?.name || '',
            qty: Number(item.qty),
            price: Number(item.price),
            cost: Number(costPrice),
          },
          { transaction: t }
        );
        saleItems.push(saleItem);

        await ProductVariant.update(
          { stock: variant.stock - Number(item.qty) },
          { where: { id: variant.id }, transaction: t }
        );
      }

      if (amountDue > 0) {
        await PartialPayment.create(
          {
            shop_id: shopId,
            sale_id: sale.id,
            customer_id: customerId,
            customer_name: customer_name || 'Walk-in',
            customer_phone: customer_phone || null,
            invoice_no: invoiceNo,
            bill_total: total,
            amount_paid: amountPaid,
            amount_due: amountDue,
            date,
            payment_method: payment_method || 'cash',
            status: 'open',
          },
          { transaction: t }
        );

        await Credit.create(
          {
            shop_id: shopId,
            customer_id: customerId,
            customer_name: customer_name || 'Walk-in',
            customer_phone: customer_phone || null,
            type: 'credit',
            amount: amountDue,
            reference: invoiceNo,
            notes: `Credit from invoice ${invoiceNo}`,
            date,
          },
          { transaction: t }
        );
      }

      await t.commit();

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC201, RES_MESSAGE.EM201, {
        sale: { ...sale.toJSON(), items: saleItems.map(si => si.toJSON()) },
      });
    } catch (error: any) {
      await t.rollback();
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async getAllSalesService(req: any) {
    try {
      const shopId = req.shopId;
      const { from, to, payment_status, customer_id, search, page = 1, limit = 50 } = req.query;

      const where: any = { shop_id: shopId };

      if (from && to) {
        where.date = { [Op.between]: [from, to] };
      } else if (from) {
        where.date = { [Op.gte]: from };
      } else if (to) {
        where.date = { [Op.lte]: to };
      }

      if (payment_status) {
        where.payment_status = payment_status;
      }

      if (customer_id) {
        where.customer_id = customer_id;
      }

      if (search) {
        const q = String(search).trim();
        where[Op.or] = [
          { invoice_no: { [Op.iLike]: `%${q}%` } },
          { customer_name: { [Op.iLike]: `%${q}%` } },
          { customer_phone: { [Op.iLike]: `%${q}%` } },
        ];
      }

      const offset = (Number(page) - 1) * Number(limit);

      const { count, rows: sales } = await Sale.findAndCountAll({
        where,
        include: [
          { model: SaleItem },
          { model: Customer, attributes: ['id', 'name', 'phone'] },
        ],
        order: [['date', 'DESC'], ['created_at', 'DESC']],
        limit: Number(limit),
        offset,
      });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        sales,
        total: count,
        page: Number(page),
        totalPages: Math.ceil(count / Number(limit)),
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async getSaleByIdService(req: any) {
    try {
      const { id } = req.params;
      const shopId = req.shopId;

      const sale = await Sale.findOne({
        where: { id, shop_id: shopId },
        include: [
          { model: SaleItem },
          { model: Customer, attributes: ['id', 'name', 'phone', 'email', 'address'] },
        ],
      });

      if (!sale) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      // Payment history: partial-settlement credits tied to this invoice
      const [settlements, shop] = await Promise.all([
        Credit.findAll({
          where: {
            shop_id: shopId,
            type: 'partial_settlement',
            reference: sale.invoice_no,
          },
          order: [['created_at', 'ASC']],
        }),
        (await import('../../models/Shop')).default.findOne({ where: { id: shopId } }),
      ]);

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        sale,
        shop,
        settlements: settlements.map(s => ({
          id: s.id,
          amount: Number(s.amount),
          date: s.date,
          created_at: s.created_at,
          notes: s.notes,
        })),
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async getPublicSaleService(req: any) {
    try {
      const { invoice_no, customer_id } = req.params;
      if (!invoice_no || !customer_id) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'Missing invoice or customer identifier');
      }

      const sale = await Sale.findOne({
        where: { invoice_no, customer_id },
        include: [{ model: SaleItem }],
      });

      if (!sale) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, 'Invoice not found');
      }

      const Shop = (await import('../../models/Shop')).default;
      const [shop, settlements] = await Promise.all([
        Shop.findOne({ where: { id: sale.shop_id } }),
        Credit.findAll({
          where: {
            shop_id: sale.shop_id,
            type: 'partial_settlement',
            reference: sale.invoice_no,
          },
          order: [['created_at', 'ASC']],
        }),
      ]);

      // Only expose fields that are safe to show on a public link
      const safeShop = shop ? {
        name: shop.name,
        logo_url: shop.logo_url,
        phone: shop.phone,
        phone_code: (shop as any).phone_code || '91',
        address: shop.address,
        gstin: shop.gstin,
      } : null;

      const safeSale = {
        id: sale.id,
        invoice_no: sale.invoice_no,
        customer_name: sale.customer_name,
        customer_phone: sale.customer_phone,
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        total: Number(sale.total),
        amount_paid: Number(sale.amount_paid),
        amount_due: Number(sale.amount_due),
        payment_method: sale.payment_method,
        payment_status: sale.payment_status,
        date: sale.date,
        time: sale.time,
        items: ((sale as any).items || (sale as any).SaleItems || []).map((i: any) => ({
          name: i.name, sku: i.sku, size: i.size, qty: Number(i.qty), price: Number(i.price),
        })),
      };

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        sale: safeSale,
        shop: safeShop,
        settlements: settlements.map(s => ({
          id: s.id,
          amount: Number(s.amount),
          date: s.date,
          created_at: s.created_at,
          notes: s.notes,
        })),
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async uploadInvoicePdfService(req: any) {
    try {
      const { id } = req.params;
      const shopId = req.shopId;

      const sale = await Sale.findOne({ where: { id, shop_id: shopId } });
      if (!sale) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      let pdfBuffer: Buffer | null = null;

      if (req.file && req.file.buffer) {
        pdfBuffer = req.file.buffer;
      } else if (req.body.pdf_base64) {
        pdfBuffer = Buffer.from(req.body.pdf_base64, 'base64');
      }

      if (!pdfBuffer) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'No PDF provided. Send file or pdf_base64');
      }

      const url = await uploadInvoicePDF(pdfBuffer, sale.invoice_no, shopId);
      await sale.update({ invoice_pdf_url: url });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM208, {
        invoice_pdf_url: url,
        invoice_no: sale.invoice_no,
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async editSaleService(req: any) {
    const t = await db.transaction();
    try {
      const { id } = req.params;
      const shopId = req.shopId;
      const { customer_name, customer_phone, items, discount, amount_paid, payment_method, date } = req.body;

      const sale = await Sale.findOne({
        where: { id, shop_id: shopId },
        include: [{ model: SaleItem }],
        transaction: t,
      });

      if (!sale) {
        await t.rollback();
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      // Restore stock for old items (find variant by barcode)
      for (const oldItem of (sale as any).items) {
        if (oldItem.barcode) {
          const variant = await ProductVariant.findOne({
            where: { barcode: oldItem.barcode, shop_id: shopId },
            transaction: t,
          });
          if (variant) {
            await variant.update({ stock: variant.stock + oldItem.qty }, { transaction: t });
          }
        }
      }

      await SaleItem.destroy({ where: { sale_id: sale.id }, transaction: t });

      let newItems = items;
      let newSubtotal = Number(sale.subtotal);
      let newCogs = Number(sale.cogs);
      let newDiscount = discount !== undefined ? Number(discount) : Number(sale.discount);
      let newAmountPaid = amount_paid !== undefined ? Number(amount_paid) : Number(sale.amount_paid);
      let newPaymentMethod = payment_method || sale.payment_method;

      if (newItems && newItems.length > 0) {
        const variantIds = newItems.map((i: any) => i.variant_id || i.product_id);
        const variants = await ProductVariant.findAll({
          where: { id: variantIds, shop_id: shopId, is_active: true, is_deleted: false },
          include: [
            { model: Product, as: 'product' },
            { model: Size, as: 'size_info', attributes: ['id', 'name'] },
          ],
          transaction: t,
        });
        const variantMap = new Map(variants.map((v) => [v.id, v]));

        newSubtotal = 0;
        newCogs = 0;

        for (const item of newItems) {
          const variantId = item.variant_id || item.product_id;
          const variant = variantMap.get(variantId);
          if (!variant) {
            await t.rollback();
            return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, `Product variant ${variantId} not found`);
          }
          if (variant.stock < item.qty) {
            await t.rollback();
            return Handler.Error(
              RES_STATUS.E2,
              STATUS_CODE.EC400,
              `Insufficient stock for ${variant.product?.name} (${variant.size_info?.name}). Available: ${variant.stock}`
            );
          }

          const costPrice = variant.purchase_price ?? variant.product?.purchase_price ?? 0;
          newSubtotal += Number(item.price) * Number(item.qty);
          newCogs += Number(costPrice) * Number(item.qty);

          await SaleItem.create(
            {
              sale_id: sale.id,
              product_id: variant.product_id,
              sku: variant.product?.sku || '',
              barcode: variant.barcode,
              name: variant.product?.name || '',
              size: variant.size_info?.name || '',
              qty: Number(item.qty),
              price: Number(item.price),
              cost: Number(costPrice),
            },
            { transaction: t }
          );

          await ProductVariant.update(
            { stock: variant.stock - Number(item.qty) },
            { where: { id: variant.id }, transaction: t }
          );
        }
      }

      const newTotal = newSubtotal - newDiscount;
      const newAmountDue = Math.max(0, newTotal - newAmountPaid);
      const newGrossProfit = newTotal - newCogs;

      let newPaymentStatus: string;
      if (newAmountDue <= 0) {
        newPaymentStatus = 'paid';
      } else if (newAmountPaid > 0 && newAmountDue < newTotal) {
        newPaymentStatus = 'partial';
      } else {
        newPaymentStatus = 'due';
      }

      const updateFields: any = {
        subtotal: newSubtotal,
        discount: newDiscount,
        total: newTotal,
        amount_paid: newAmountPaid,
        amount_due: newAmountDue,
        cogs: newCogs,
        gross_profit: newGrossProfit,
        payment_method: newPaymentMethod,
        payment_status: newPaymentStatus,
      };
      if (customer_name !== undefined) updateFields.customer_name = customer_name;
      if (customer_phone !== undefined) updateFields.customer_phone = customer_phone;
      if (date !== undefined) updateFields.date = date;

      await sale.update(updateFields, { transaction: t });

      await PartialPayment.update(
        {
          bill_total: newTotal,
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          status: newAmountDue <= 0 ? 'settled' : 'open',
        },
        { where: { sale_id: sale.id, shop_id: shopId }, transaction: t }
      );

      await t.commit();

      const updatedSale = await Sale.findOne({
        where: { id: sale.id },
        include: [{ model: SaleItem }],
      });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM208, { sale: updatedSale });
    } catch (error: any) {
      await t.rollback();
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }
}

export default new SaleService();
