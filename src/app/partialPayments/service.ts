import { Op } from 'sequelize';
import Handler from '../../common/handler';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import PartialPayment from '../../models/PartialPayment';
import Sale from '../../models/Sale';
import SaleItem from '../../models/SaleItem';
import Credit from '../../models/Credit';
import Customer from '../../models/Customer';
import { db } from '../../config/db';

class PartialPaymentService {
  async getAllPartialPaymentsService(req: any) {
    try {
      const shopId = req.shopId;
      const { status = 'open', search, from, to, page = 1, limit = 50 } = req.query;

      const where: any = { shop_id: shopId };

      if (status && status !== 'all') {
        where.status = status;
      }

      if (from && to) {
        where.date = { [Op.between]: [from, to] };
      } else if (from) {
        where.date = { [Op.gte]: from };
      } else if (to) {
        where.date = { [Op.lte]: to };
      }

      if (search) {
        where[Op.or] = [
          { customer_name: { [Op.iLike]: `%${search}%` } },
          { customer_phone: { [Op.iLike]: `%${search}%` } },
          { invoice_no: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const offset = (Number(page) - 1) * Number(limit);

      const { count, rows: partialPayments } = await PartialPayment.findAndCountAll({
        where,
        include: [
          { model: Customer, attributes: ['id', 'name', 'phone'], required: false },
        ],
        order: [['date', 'DESC'], ['created_at', 'DESC']],
        limit: Number(limit),
        offset,
      });

      // Total open dues
      const totalDue = await PartialPayment.sum('amount_due', {
        where: { shop_id: shopId, status: 'open' },
      });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        partial_payments: partialPayments,
        total: count,
        page: Number(page),
        totalPages: Math.ceil(count / Number(limit)),
        total_open_due: totalDue || 0,
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async settlePartialPaymentService(req: any) {
    const t = await db.transaction();
    try {
      const { id } = req.params;
      const shopId = req.shopId;
      const { amount, payment_method, notes, date } = req.body;

      const partialPayment = await PartialPayment.findOne({
        where: { id, shop_id: shopId, status: 'open' },
        transaction: t,
      });

      if (!partialPayment) {
        await t.rollback();
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, 'Partial payment not found or already settled');
      }

      const dueAmt = Number(partialPayment.amount_due);
      const payAmount = Number(amount);
      if (!payAmount || payAmount <= 0) {
        await t.rollback();
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'Payment amount must be greater than 0');
      }
      if (payAmount > dueAmt) {
        await t.rollback();
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, `Payment cannot exceed remaining due of ${dueAmt}`);
      }
      const newAmountPaid = Number(partialPayment.amount_paid) + payAmount;
      const newAmountDue = Math.max(0, Number(partialPayment.amount_due) - payAmount);
      const newStatus = newAmountDue <= 0 ? 'settled' : 'open';
      const settleDate = date || new Date().toISOString().slice(0, 10);

      await partialPayment.update(
        {
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          status: newStatus,
          payment_method: payment_method || partialPayment.payment_method,
          notes: notes ? `${partialPayment.notes || ''} | Payment: ${notes}`.trim() : partialPayment.notes,
        },
        { transaction: t }
      );

      // Create Credit record for this partial_settlement
      await Credit.create(
        {
          shop_id: shopId,
          customer_id: partialPayment.customer_id,
          customer_name: partialPayment.customer_name,
          customer_phone: partialPayment.customer_phone,
          type: 'partial_settlement',
          amount: payAmount,
          reference: partialPayment.invoice_no,
          notes: notes || `Settlement of invoice ${partialPayment.invoice_no}`,
          date: settleDate,
        },
        { transaction: t }
      );

      // Update Sale record
      const sale = await Sale.findOne({
        where: { id: partialPayment.sale_id, shop_id: shopId },
        transaction: t,
      });

      if (sale) {
        const saleNewAmountPaid = Number(sale.amount_paid) + payAmount;
        const saleNewAmountDue = Math.max(0, Number(sale.amount_due) - payAmount);
        let salePaymentStatus: string;
        if (saleNewAmountDue <= 0) {
          salePaymentStatus = 'paid';
        } else if (saleNewAmountPaid > 0) {
          salePaymentStatus = 'partial';
        } else {
          salePaymentStatus = 'due';
        }

        await sale.update(
          {
            amount_paid: saleNewAmountPaid,
            amount_due: saleNewAmountDue,
            payment_status: salePaymentStatus,
          },
          { transaction: t }
        );
      }

      await t.commit();

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM208, {
        partial_payment: partialPayment,
        amount_settled: payAmount,
        new_status: newStatus,
        remaining_due: newAmountDue,
      });
    } catch (error: any) {
      await t.rollback();
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async getByCustomerService(req: any) {
    try {
      const shopId = req.shopId;
      const { search, page: pageParam = 1, limit: limitParam = 10 } = req.query;
      const page = Math.max(1, Number(pageParam) || 1);
      const limit = Math.min(100, Math.max(1, Number(limitParam) || 10));

      // Backfill: for any Sale with amount_due > 0 that doesn't yet have a
      // PartialPayment row (e.g. legacy sales), create one. This keeps the
      // dues page self-healing and ensures nothing with a real balance is hidden.
      const salesWithDue = await Sale.findAll({
        where: { shop_id: shopId, amount_due: { [Op.gt]: 0 } },
      });
      if (salesWithDue.length) {
        const existing = await PartialPayment.findAll({
          where: { shop_id: shopId, sale_id: { [Op.in]: salesWithDue.map(s => s.id) } },
          attributes: ['sale_id'],
        });
        const haveSet = new Set(existing.map(e => e.sale_id));
        const missing = salesWithDue.filter(s => !haveSet.has(s.id));
        if (missing.length) {
          await PartialPayment.bulkCreate(missing.map(s => ({
            shop_id: shopId,
            sale_id: s.id,
            customer_id: (s as any).customer_id || null,
            customer_name: s.customer_name || 'Walk-in',
            customer_phone: s.customer_phone || null,
            invoice_no: s.invoice_no,
            bill_total: Number(s.total),
            amount_paid: Number(s.amount_paid),
            amount_due: Number(s.amount_due),
            date: s.date,
            payment_method: s.payment_method || 'cash',
            status: 'open' as any,
          })));
        }
      }

      // Pull every partial payment for this shop (open + settled) so we can show
      // per-bill history. Filter by customer name/phone/invoice if a search is given.
      const where: any = { shop_id: shopId };
      if (search) {
        where[Op.or] = [
          { customer_name: { [Op.iLike]: `%${search}%` } },
          { customer_phone: { [Op.iLike]: `%${search}%` } },
          { invoice_no: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const payments = await PartialPayment.findAll({
        where,
        order: [['date', 'DESC'], ['created_at', 'DESC']],
      });

      const saleIds = payments.map(p => p.sale_id).filter(Boolean);
      const invoiceNos = payments.map(p => p.invoice_no).filter(Boolean);

      const [items, settlements] = await Promise.all([
        saleIds.length
          ? SaleItem.findAll({ where: { sale_id: { [Op.in]: saleIds } } })
          : Promise.resolve([] as SaleItem[]),
        invoiceNos.length
          ? Credit.findAll({
              where: {
                shop_id: shopId,
                type: 'partial_settlement',
                reference: { [Op.in]: invoiceNos },
              },
              order: [['created_at', 'ASC']],
            })
          : Promise.resolve([] as Credit[]),
      ]);

      const itemsBySale = new Map<string, SaleItem[]>();
      for (const it of items) {
        const arr = itemsBySale.get(it.sale_id) || [];
        arr.push(it);
        itemsBySale.set(it.sale_id, arr);
      }

      const settlementsByInvoice = new Map<string, Credit[]>();
      for (const s of settlements) {
        const arr = settlementsByInvoice.get(s.reference) || [];
        arr.push(s);
        settlementsByInvoice.set(s.reference, arr);
      }

      // Group bills by customer. Use customer_id when present; otherwise fall back
      // to phone as the grouping key so walk-ins with phone still group correctly.
      type Group = {
        customer_id: string | null;
        customer_name: string;
        customer_phone: string | null;
        total_due: number;
        open_bills: number;
        bills_count: number;
        bills: any[];
      };
      const groups = new Map<string, Group>();

      for (const p of payments) {
        const key = p.customer_id || p.customer_phone || `__anon_${p.id}`;
        let g = groups.get(key);
        if (!g) {
          g = {
            customer_id: p.customer_id || null,
            customer_name: p.customer_name,
            customer_phone: p.customer_phone || null,
            total_due: 0,
            open_bills: 0,
            bills_count: 0,
            bills: [],
          };
          groups.set(key, g);
        }
        g.total_due += Number(p.amount_due) || 0;
        g.bills_count += 1;
        if (p.status === 'open') g.open_bills += 1;

        const billItems = itemsBySale.get(p.sale_id) || [];
        const billSettlements = settlementsByInvoice.get(p.invoice_no) || [];

        g.bills.push({
          id: p.id,
          sale_id: p.sale_id,
          invoice_no: p.invoice_no,
          date: p.date,
          bill_total: Number(p.bill_total),
          amount_paid: Number(p.amount_paid),
          amount_due: Number(p.amount_due),
          status: p.status,
          payment_method: p.payment_method,
          items: billItems.map(i => ({
            id: i.id,
            name: i.name,
            sku: i.sku,
            size: i.size,
            qty: Number(i.qty),
            price: Number(i.price),
            line_total: Number(i.price) * Number(i.qty),
          })),
          items_count: billItems.reduce((n, i) => n + Number(i.qty), 0),
          settlements: billSettlements.map(s => ({
            id: s.id,
            amount: Number(s.amount),
            date: s.date,
            created_at: s.created_at,
            notes: s.notes,
          })),
        });
      }

      const list = Array.from(groups.values()).sort((a, b) => {
        if (b.open_bills !== a.open_bills) return b.open_bills - a.open_bills;
        return b.total_due - a.total_due;
      });

      // Aggregates computed over the full filtered set (not the paged slice)
      // so the summary cards always reflect the real totals.
      const totalOpenDue = list.reduce((sum, c) => {
        return sum + c.bills.filter((b: any) => b.status === 'open').reduce((s: number, b: any) => s + b.amount_due, 0);
      }, 0);
      const totalEverPaid = list.reduce((sum, c) =>
        sum + c.bills.reduce((s: number, b: any) => s + Number(b.amount_paid || 0), 0), 0
      );
      const totalBills = list.reduce((n, c) => n + c.bills_count, 0);
      const openBillsCount = list.reduce((n, c) => n + c.open_bills, 0);
      const settledBillsCount = totalBills - openBillsCount;

      const total = list.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, totalPages);
      const customers = list.slice((safePage - 1) * limit, safePage * limit);

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        customers,
        page: safePage,
        limit,
        total,
        totalPages,
        total_open_due: totalOpenDue,
        total_ever_paid: totalEverPaid,
        total_bills: totalBills,
        open_bills_count: openBillsCount,
        settled_bills_count: settledBillsCount,
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }
}

export default new PartialPaymentService();


