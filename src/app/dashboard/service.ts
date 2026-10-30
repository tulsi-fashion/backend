import { fn, col, literal, Op } from 'sequelize';
import Handler from '../../common/handler';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Sale from '../../models/Sale';
import SaleItem from '../../models/SaleItem';
import Product from '../../models/Product';
import ProductVariant from '../../models/ProductVariant';
import Size from '../../models/Size';
import PartialPayment from '../../models/PartialPayment';
import Customer from '../../models/Customer';

class DashboardService {
  async getDashboardStatsService(req: any) {
    try {
      const shopId = req.shopId;
      const today = new Date().toISOString().slice(0, 10);

      const todaySalesData = await Sale.findOne({
        where: { shop_id: shopId, date: today },
        attributes: [
          [fn('SUM', col('total')), 'total_sales'],
          [fn('SUM', col('gross_profit')), 'total_profit'],
          [fn('COUNT', col('id')), 'sale_count'],
        ],
        raw: true,
      }) as any;

      const totalStock = await ProductVariant.sum('stock', {
        where: { shop_id: shopId, is_active: true, is_deleted: false },
      });

      const lowStockCount = await ProductVariant.count({
        where: {
          shop_id: shopId,
          is_active: true,
          is_deleted: false,
          [Op.and]: [
            literal(`stock <= reorder_level`),
            { stock: { [Op.gt]: 0 } },
          ],
        },
      });

      const outOfStockCount = await ProductVariant.count({
        where: { shop_id: shopId, is_active: true, is_deleted: false, stock: 0 },
      });

      const recentBills = await Sale.findAll({
        where: { shop_id: shopId },
        include: [{ model: SaleItem }],
        order: [['created_at', 'DESC']],
        limit: 5,
      });

      const stockAlerts = await ProductVariant.findAll({
        where: {
          shop_id: shopId,
          is_active: true,
          is_deleted: false,
          [Op.and]: [literal(`stock <= reorder_level`)],
        },
        include: [
          { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
          { model: Size, as: 'size_info', attributes: ['id', 'name'] },
        ],
        order: [['stock', 'ASC']],
        limit: 10,
      });

      const totalDues = await PartialPayment.sum('amount_due', {
        where: { shop_id: shopId, status: 'open' },
      });

      const monthStart = today.slice(0, 7) + '-01';
      const monthSalesData = await Sale.findOne({
        where: {
          shop_id: shopId,
          date: { [Op.between]: [monthStart, today] },
        },
        attributes: [
          [fn('SUM', col('total')), 'total_sales'],
          [fn('SUM', col('gross_profit')), 'total_profit'],
          [fn('COUNT', col('id')), 'sale_count'],
        ],
        raw: true,
      }) as any;

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        today: {
          sales: Number(todaySalesData?.total_sales || 0),
          profit: Number(todaySalesData?.total_profit || 0),
          sale_count: Number(todaySalesData?.sale_count || 0),
        },
        this_month: {
          sales: Number(monthSalesData?.total_sales || 0),
          profit: Number(monthSalesData?.total_profit || 0),
          sale_count: Number(monthSalesData?.sale_count || 0),
        },
        inventory: {
          total_stock: Number(totalStock || 0),
          low_stock_count: lowStockCount,
          out_of_stock_count: outOfStockCount,
        },
        total_dues: Number(totalDues || 0),
        recent_bills: recentBills,
        stock_alerts: stockAlerts,
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  // ───────────── Advanced analytics ─────────────
  // Returns current + comparison aggregates, time-bucketed series,
  // top products and payment-method breakdown for the requested period.
  async getAnalyticsService(req: any) {
    try {
      const shopId = req.shopId;
      const {
        preset = 'this_month',
        from: fromParam,
        to: toParam,
        compare = 'previous_period', // previous_period | previous_year | custom | none
        compare_from: compareFromParam,
        compare_to: compareToParam,
        granularity: granParam,
      } = req.query as any;

      // ── Resolve the current period ─────────────────────────
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const toISO = (d: Date) => d.toISOString().slice(0, 10);

      function startOf(unit: 'week' | 'month' | 'year', d: Date): Date {
        const n = new Date(d);
        n.setHours(0, 0, 0, 0);
        if (unit === 'week') {
          const day = n.getDay() || 7; // Mon=1..Sun=7
          n.setDate(n.getDate() - (day - 1));
        } else if (unit === 'month') {
          n.setDate(1);
        } else if (unit === 'year') {
          n.setMonth(0, 1);
        }
        return n;
      }

      let fromDate: Date;
      let toDate: Date = new Date(today);

      switch (preset) {
        case 'today': fromDate = new Date(today); break;
        case 'yesterday': {
          const d = new Date(today); d.setDate(d.getDate() - 1);
          fromDate = d; toDate = new Date(d);
          break;
        }
        case 'this_week': fromDate = startOf('week', today); break;
        case 'last_week': {
          const start = startOf('week', today); start.setDate(start.getDate() - 7);
          fromDate = start;
          toDate = new Date(start); toDate.setDate(toDate.getDate() + 6);
          break;
        }
        case 'this_month': fromDate = startOf('month', today); break;
        case 'last_month': {
          const start = startOf('month', today); start.setMonth(start.getMonth() - 1);
          fromDate = start;
          toDate = new Date(today.getFullYear(), today.getMonth(), 0);
          break;
        }
        case 'this_year': fromDate = startOf('year', today); break;
        case 'last_year': {
          fromDate = new Date(today.getFullYear() - 1, 0, 1);
          toDate = new Date(today.getFullYear() - 1, 11, 31);
          break;
        }
        case 'custom':
        default: {
          fromDate = fromParam ? new Date(fromParam) : startOf('month', today);
          toDate = toParam ? new Date(toParam) : new Date(today);
          break;
        }
      }

      const fromStr = toISO(fromDate);
      const toStr = toISO(toDate);
      const spanDays = Math.max(
        1,
        Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      );

      // ── Resolve comparison period ───────────────────────────
      let prevFromStr: string | null = null;
      let prevToStr: string | null = null;
      if (compare === 'previous_period') {
        const prevTo = new Date(fromDate); prevTo.setDate(prevTo.getDate() - 1);
        const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (spanDays - 1));
        prevFromStr = toISO(prevFrom); prevToStr = toISO(prevTo);
      } else if (compare === 'previous_year') {
        const prevFrom = new Date(fromDate); prevFrom.setFullYear(prevFrom.getFullYear() - 1);
        const prevTo = new Date(toDate); prevTo.setFullYear(prevTo.getFullYear() - 1);
        prevFromStr = toISO(prevFrom); prevToStr = toISO(prevTo);
      } else if (compare === 'custom' && compareFromParam && compareToParam) {
        const prevFrom = new Date(compareFromParam);
        let prevTo = new Date(compareToParam);
        const prevSpan = Math.round((prevTo.getTime() - prevFrom.getTime()) / 86400000) + 1;
        if (prevSpan < spanDays) {
          prevTo = new Date(prevFrom);
          prevTo.setDate(prevTo.getDate() + (spanDays - 1));
        }
        prevFromStr = toISO(prevFrom); prevToStr = toISO(prevTo);
      }

      // ── Granularity (auto if not given) ─────────────────────
      let granularity: 'day' | 'month' | 'year' = granParam;
      if (!granularity) {
        if (spanDays <= 62) granularity = 'day';
        else if (spanDays <= 730) granularity = 'month';
        else granularity = 'year';
      }

      // ── Aggregate helpers ───────────────────────────────────
      const dialect = (Sale.sequelize?.getDialect?.() || 'postgres');
      const isPg = dialect === 'postgres';
      const dateCol = col('date');
      const bucketExpr = (() => {
        if (granularity === 'year') {
          return isPg
            ? literal(`to_char("date", 'YYYY')`)
            : fn('strftime', '%Y', dateCol);
        }
        if (granularity === 'month') {
          return isPg
            ? literal(`to_char("date", 'YYYY-MM')`)
            : fn('strftime', '%Y-%m', dateCol);
        }
        return isPg
          ? literal(`to_char("date", 'YYYY-MM-DD')`)
          : fn('strftime', '%Y-%m-%d', dateCol);
      })();

      async function periodAggregates(start: string, end: string) {
        const sumRow = (await Sale.findOne({
          where: { shop_id: shopId, date: { [Op.between]: [start, end] } },
          attributes: [
            [fn('SUM', col('total')), 'sales'],
            [fn('SUM', col('gross_profit')), 'profit'],
            [fn('SUM', col('amount_paid')), 'collected'],
            [fn('SUM', col('amount_due')), 'due'],
            [fn('COUNT', col('id')), 'bills_count'],
          ],
          raw: true,
        })) as any;

        // Get sale IDs separately to avoid ambiguous joins
        const saleIdRows = (await Sale.findAll({
          where: { shop_id: shopId, date: { [Op.between]: [start, end] } },
          attributes: ['id'],
          raw: true,
        })) as any[];
        const saleIds = saleIdRows.map(r => r.id);

        const itemsRow = saleIds.length
          ? ((await SaleItem.findOne({
              where: { sale_id: { [Op.in]: saleIds } },
              attributes: [[fn('SUM', col('qty')), 'items_sold']],
              raw: true,
            })) as any)
          : null;

        const sales = Number(sumRow?.sales || 0);
        const profit = Number(sumRow?.profit || 0);
        const billsCount = Number(sumRow?.bills_count || 0);

        return {
          from: start,
          to: end,
          sales,
          profit,
          collected: Number(sumRow?.collected || 0),
          due: Number(sumRow?.due || 0),
          bills_count: billsCount,
          avg_bill: billsCount ? sales / billsCount : 0,
          items_sold: Number(itemsRow?.items_sold || 0),
        };
      }

      // ── Series (time-bucketed) for the current period ───────
      const seriesRows = (await Sale.findAll({
        where: { shop_id: shopId, date: { [Op.between]: [fromStr, toStr] } },
        attributes: [
          [bucketExpr, 'bucket'],
          [fn('SUM', col('total')), 'sales'],
          [fn('SUM', col('gross_profit')), 'profit'],
          [fn('COUNT', col('id')), 'bills_count'],
        ],
        group: [bucketExpr as any],
        order: [[bucketExpr as any, 'ASC']],
        raw: true,
      })) as any[];

      const series = seriesRows.map(r => ({
        bucket: String(r.bucket),
        sales: Number(r.sales || 0),
        profit: Number(r.profit || 0),
        bills_count: Number(r.bills_count || 0),
      }));

      // ── Top products (by qty) in current period ─────────────
      // Fetch sale IDs in range first, then aggregate on SaleItem — avoids
      // ambiguous column names from Sequelize joins.
      const currentSaleIdRows = (await Sale.findAll({
        where: { shop_id: shopId, date: { [Op.between]: [fromStr, toStr] } },
        attributes: ['id'],
        raw: true,
      })) as any[];
      const currentSaleIds = currentSaleIdRows.map(r => r.id);

      const topProductsRaw = currentSaleIds.length
        ? ((await SaleItem.findAll({
            where: { sale_id: { [Op.in]: currentSaleIds } },
            attributes: [
              'product_id',
              'name',
              [fn('SUM', col('qty')), 'total_qty'],
              [fn('SUM', literal('qty * price')), 'revenue'],
            ],
            group: ['product_id', 'name'],
            order: [[fn('SUM', col('qty')), 'DESC']],
            limit: 5,
            raw: true,
          })) as any[])
        : [];

      const topProducts = topProductsRaw.map(r => ({
        product_id: r.product_id,
        name: r.name,
        qty: Number(r.total_qty || 0),
        revenue: Number(r.revenue || 0),
      }));

      // ── Payment method breakdown ────────────────────────────
      const paymentRows = (await Sale.findAll({
        where: { shop_id: shopId, date: { [Op.between]: [fromStr, toStr] } },
        attributes: [
          'payment_method',
          [fn('SUM', col('total')), 'total'],
          [fn('COUNT', col('id')), 'count'],
        ],
        group: ['payment_method'],
        raw: true,
      })) as any[];

      const byPaymentMethod = paymentRows.map(r => ({
        method: r.payment_method || 'Unknown',
        total: Number(r.total || 0),
        count: Number(r.count || 0),
      }));

      const current = await periodAggregates(fromStr, toStr);
      const previous = prevFromStr && prevToStr ? await periodAggregates(prevFromStr, prevToStr) : null;

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        preset,
        granularity,
        compare,
        current,
        previous,
        series,
        top_products: topProducts,
        by_payment_method: byPaymentMethod,
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }
}

export default new DashboardService();
