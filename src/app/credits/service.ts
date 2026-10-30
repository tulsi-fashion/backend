import { Op, fn, col, literal } from 'sequelize';
import Handler from '../../common/handler';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Credit from '../../models/Credit';
import Customer from '../../models/Customer';
import PartialPayment from '../../models/PartialPayment';
import Sale from '../../models/Sale';
import { db } from '../../config/db';

class CreditService {
  async createCreditPaymentService(req: any) {
    const t = await db.transaction();
    try {
      const { customer_id, customer_name, customer_phone, type, amount, reference, notes, date } = req.body;
      const shopId = req.shopId;

      // Create credit record
      const credit = await Credit.create(
        {
          shop_id: shopId,
          customer_id: customer_id || null,
          customer_name,
          customer_phone: customer_phone || null,
          type,
          amount: Number(amount),
          reference: reference || null,
          notes: notes || null,
          date,
        },
        { transaction: t }
      );

      // If it's a payment and has a reference (invoice_no), update the partial payment
      if ((type === 'payment' || type === 'partial_settlement') && reference) {
        const partialPayment = await PartialPayment.findOne({
          where: { invoice_no: reference, shop_id: shopId, status: 'open' },
          transaction: t,
        });

        if (partialPayment) {
          const newAmountPaid = Number(partialPayment.amount_paid) + Number(amount);
          const newAmountDue = Math.max(0, Number(partialPayment.amount_due) - Number(amount));
          const newStatus = newAmountDue <= 0 ? 'settled' : 'open';

          await partialPayment.update(
            {
              amount_paid: newAmountPaid,
              amount_due: newAmountDue,
              status: newStatus,
            },
            { transaction: t }
          );

          // Also update the Sale record
          const sale = await Sale.findOne({
            where: { invoice_no: reference, shop_id: shopId },
            transaction: t,
          });

          if (sale) {
            const saleAmountPaid = Number(sale.amount_paid) + Number(amount);
            const saleAmountDue = Math.max(0, Number(sale.amount_due) - Number(amount));
            let salePaymentStatus: string;
            if (saleAmountDue <= 0) {
              salePaymentStatus = 'paid';
            } else if (saleAmountPaid > 0) {
              salePaymentStatus = 'partial';
            } else {
              salePaymentStatus = 'due';
            }

            await sale.update(
              {
                amount_paid: saleAmountPaid,
                amount_due: saleAmountDue,
                payment_status: salePaymentStatus,
              },
              { transaction: t }
            );
          }
        }
      }

      await t.commit();

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC201, RES_MESSAGE.EM201, { credit });
    } catch (error: any) {
      await t.rollback();
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async getAllCreditsService(req: any) {
    try {
      const shopId = req.shopId;
      const { from, to, customer_id, type, page = 1, limit = 50 } = req.query;

      const where: any = { shop_id: shopId };

      if (from && to) {
        where.date = { [Op.between]: [from, to] };
      } else if (from) {
        where.date = { [Op.gte]: from };
      } else if (to) {
        where.date = { [Op.lte]: to };
      }

      if (customer_id) where.customer_id = customer_id;
      if (type) where.type = type;

      const offset = (Number(page) - 1) * Number(limit);

      const { count, rows: credits } = await Credit.findAndCountAll({
        where,
        include: [{ model: Customer, attributes: ['id', 'name', 'phone'] }],
        order: [['date', 'DESC'], ['created_at', 'DESC']],
        limit: Number(limit),
        offset,
      });

      // Compute customer balances grouped
      const customerBalances = await Credit.findAll({
        where: { shop_id: shopId },
        attributes: [
          'customer_name',
          'customer_phone',
          'customer_id',
          [
            literal(`SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END)`),
            'total_credit',
          ],
          [
            literal(`SUM(CASE WHEN type IN ('payment', 'partial_settlement') THEN amount ELSE 0 END)`),
            'total_paid',
          ],
          [
            literal(`SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END)`),
            'balance',
          ],
        ],
        group: ['customer_name', 'customer_phone', 'customer_id'],
        having: literal(`SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) > 0`),
        raw: true,
      });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        credits,
        total: count,
        page: Number(page),
        totalPages: Math.ceil(count / Number(limit)),
        customer_balances: customerBalances,
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async getCustomerCreditsService(req: any) {
    try {
      const { phone } = req.params;
      const shopId = req.shopId;

      const credits = await Credit.findAll({
        where: { customer_phone: phone, shop_id: shopId },
        order: [['date', 'ASC'], ['created_at', 'ASC']],
      });

      // Calculate running balance
      let runningBalance = 0;
      const ledger = credits.map((c) => {
        if (c.type === 'credit') {
          runningBalance += Number(c.amount);
        } else {
          runningBalance -= Number(c.amount);
        }
        return { ...c.toJSON(), running_balance: runningBalance };
      });

      const totalBalance = credits.reduce((sum, c) => {
        if (c.type === 'credit') return sum + Number(c.amount);
        return sum - Number(c.amount);
      }, 0);

      // Get open partial payments for this customer
      const openDues = await PartialPayment.findAll({
        where: { customer_phone: phone, shop_id: shopId, status: 'open' },
        order: [['date', 'DESC']],
      });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        ledger,
        total_balance: totalBalance,
        open_dues: openDues,
        total_due: openDues.reduce((sum, p) => sum + Number(p.amount_due), 0),
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }
}

export default new CreditService();


