import { Op, fn, col, literal } from 'sequelize';
import Handler from '../../common/handler';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Customer from '../../models/Customer';
import Sale from '../../models/Sale';
import SaleItem from '../../models/SaleItem';
import Credit from '../../models/Credit';
import PartialPayment from '../../models/PartialPayment';

class CustomerService {
  async createCustomerService(req: any) {
    try {
      const { name, phone, email, company, address, notes } = req.body;
      const shopId = req.shopId;

      // Check for duplicate phone in shop
      const existing = await Customer.findOne({ where: { phone, shop_id: shopId } });
      if (existing) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC409, 'A customer with this phone number already exists');
      }

      const customer = await Customer.create({
        shop_id: shopId,
        name,
        phone,
        phone_code: '91',
        email: email || null,
        company: company || null,
        address: address || null,
        notes: notes || null,
      });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC201, RES_MESSAGE.EM201, { customer });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async getAllCustomersService(req: any) {
    try {
      const shopId = req.shopId;
      const { search, page = 1, limit = 50 } = req.query;

      const where: any = { shop_id: shopId };

      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { phone: { [Op.iLike]: `%${search}%` } },
          { company: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const offset = (Number(page) - 1) * Number(limit);

      const { count, rows: customers } = await Customer.findAndCountAll({
        where,
        order: [['name', 'ASC']],
        limit: Number(limit),
        offset,
      });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        customers,
        total: count,
        page: Number(page),
        totalPages: Math.ceil(count / Number(limit)),
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async getCustomerByIdService(req: any) {
    try {
      const { id } = req.params;
      const shopId = req.shopId;

      const customer = await Customer.findOne({
        where: { id, shop_id: shopId },
      });

      if (!customer) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      // Get all sales
      const sales = await Sale.findAll({
        where: { customer_id: id, shop_id: shopId },
        include: [{ model: SaleItem }],
        order: [['date', 'DESC']],
        limit: 20,
      });

      // Get credit ledger
      const credits = await Credit.findAll({
        where: { customer_id: id, shop_id: shopId },
        order: [['date', 'DESC']],
        limit: 20,
      });

      // Get open partial payments
      const partialPayments = await PartialPayment.findAll({
        where: { customer_id: id, shop_id: shopId, status: 'open' },
        order: [['date', 'DESC']],
      });

      // Calculate stats
      const totalPurchases = sales.reduce((sum, s) => sum + Number(s.total), 0);
      const totalDue = partialPayments.reduce((sum, p) => sum + Number(p.amount_due), 0);

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        customer,
        sales,
        credits,
        partial_payments: partialPayments,
        stats: {
          total_purchases: totalPurchases,
          total_due: totalDue,
          invoice_count: sales.length,
        },
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async updateCustomerService(req: any) {
    try {
      const { id } = req.params;
      const shopId = req.shopId;
      const { name, phone, email, company, address, notes } = req.body;

      const customer = await Customer.findOne({ where: { id, shop_id: shopId } });
      if (!customer) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      // Check phone uniqueness if changing
      if (phone && phone !== customer.phone) {
        const existing = await Customer.findOne({ where: { phone, shop_id: shopId } });
        if (existing) {
          return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC409, 'A customer with this phone number already exists');
        }
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      if (company !== undefined) updateData.company = company;
      if (address !== undefined) updateData.address = address;
      if (notes !== undefined) updateData.notes = notes;

      await customer.update(updateData);

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM208, { customer });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async deleteCustomerService(req: any) {
    try {
      const { id } = req.params;
      const shopId = req.shopId;

      const customer = await Customer.findOne({ where: { id, shop_id: shopId } });
      if (!customer) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      await customer.destroy();

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM210, null);
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async getCustomerStatsService(req: any) {
    try {
      const { id } = req.params;
      const shopId = req.shopId;

      const customer = await Customer.findOne({ where: { id, shop_id: shopId } });
      if (!customer) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      const salesAgg = await Sale.findOne({
        where: { customer_id: id, shop_id: shopId },
        attributes: [
          [fn('SUM', col('total')), 'total_purchases'],
          [fn('COUNT', col('id')), 'invoice_count'],
        ],
        raw: true,
      }) as any;

      const dueAgg = await PartialPayment.findOne({
        where: { customer_id: id, shop_id: shopId, status: 'open' },
        attributes: [
          [fn('SUM', col('amount_due')), 'total_due'],
        ],
        raw: true,
      }) as any;

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        customer,
        stats: {
          total_purchases: Number(salesAgg?.total_purchases || 0),
          invoice_count: Number(salesAgg?.invoice_count || 0),
          total_due: Number(dueAgg?.total_due || 0),
        },
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }
}

export default new CustomerService();


