import { fn, col, Op } from 'sequelize';
import Handler from '../../common/handler';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Sale from '../../models/Sale';
import SaleItem from '../../models/SaleItem';
import { db } from '../../config/db';

function toArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}
function toNum(v: any): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}
function diffDaysInclusive(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00');
  const b = new Date(to + 'T00:00:00');
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}
function shiftDate(d: string, days: number): string {
  const dt = new Date(d + 'T00:00:00');
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

class ReportService {
  private buildSaleWhere(shopId: string, from: string, to: string, filters: any) {
    const where: any = {
      shop_id: shopId,
      date: { [Op.between]: [from, to] },
    };
    const paymentMethods = toArray(filters.payment_methods);
    const paymentStatuses = toArray(filters.payment_statuses);
    const customer = (filters.customer || '').toString().trim();
    const minTotal = toNum(filters.min_total);
    const maxTotal = toNum(filters.max_total);

    if (paymentMethods.length) where.payment_method = { [Op.in]: paymentMethods };
    if (paymentStatuses.length) where.payment_status = { [Op.in]: paymentStatuses };
    if (customer) {
      where[Op.or] = [
        { customer_name: { [Op.iLike]: `%${customer}%` } },
        { customer_phone: { [Op.iLike]: `%${customer}%` } },
        { invoice_no: { [Op.iLike]: `%${customer}%` } },
      ];
    }
    if (minTotal !== undefined || maxTotal !== undefined) {
      where.total = {};
      if (minTotal !== undefined) where.total[Op.gte] = minTotal;
      if (maxTotal !== undefined) where.total[Op.lte] = maxTotal;
    }
    return where;
  }

  private buildRawSaleFilter(filters: any, params: any) {
    const parts: string[] = [];
    const paymentMethods = toArray(filters.payment_methods);
    const paymentStatuses = toArray(filters.payment_statuses);
    const customer = (filters.customer || '').toString().trim();
    const minTotal = toNum(filters.min_total);
    const maxTotal = toNum(filters.max_total);

    if (paymentMethods.length) { parts.push(`s.payment_method IN (:paymentMethods)`); params.paymentMethods = paymentMethods; }
    if (paymentStatuses.length) { parts.push(`s.payment_status IN (:paymentStatuses)`); params.paymentStatuses = paymentStatuses; }
    if (customer) {
      parts.push(`(s.customer_name ILIKE :customer OR s.customer_phone ILIKE :customer OR s.invoice_no ILIKE :customer)`);
      params.customer = `%${customer}%`;
    }
    if (minTotal !== undefined) { parts.push(`s.total >= :minTotal`); params.minTotal = minTotal; }
    if (maxTotal !== undefined) { parts.push(`s.total <= :maxTotal`); params.maxTotal = maxTotal; }
    return parts.length ? ' AND ' + parts.join(' AND ') : '';
  }

  async getReportsService(req: any) {
    try {
      const shopId = req.shopId;
      const { from, to } = req.query;
      const filters = req.query;

      if (!from || !to) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'Both from and to date parameters are required');
      }

      const where = this.buildSaleWhere(shopId, from, to, filters);

      // Aggregate sales in range
      const salesAgg = await Sale.findOne({
        where,
        attributes: [
          [fn('SUM', col('total')), 'total_sales'],
          [fn('SUM', col('cogs')), 'total_cogs'],
          [fn('SUM', col('gross_profit')), 'gross_profit'],
          [fn('SUM', col('discount')), 'total_discount'],
          [fn('SUM', col('amount_paid')), 'total_paid'],
          [fn('SUM', col('amount_due')), 'total_due'],
          [fn('COUNT', col('id')), 'invoice_count'],
          [fn('AVG', col('total')), 'avg_invoice_value'],
          [fn('MIN', col('total')), 'min_invoice_value'],
          [fn('MAX', col('total')), 'max_invoice_value'],
        ],
        raw: true,
      }) as any;

      const totalSales = Number(salesAgg?.total_sales || 0);
      const totalCogs = Number(salesAgg?.total_cogs || 0);
      const grossProfit = Number(salesAgg?.gross_profit || 0);
      const grossMarginPct = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

      // Previous-period comparison (same length window immediately before `from`)
      const periodLen = diffDaysInclusive(from, to);
      const prevTo = shiftDate(from, -1);
      const prevFrom = shiftDate(prevTo, -(periodLen - 1));
      const prevWhere = this.buildSaleWhere(shopId, prevFrom, prevTo, filters);
      const prevAgg = await Sale.findOne({
        where: prevWhere,
        attributes: [
          [fn('SUM', col('total')), 'total_sales'],
          [fn('SUM', col('gross_profit')), 'gross_profit'],
          [fn('COUNT', col('id')), 'invoice_count'],
        ],
        raw: true,
      }) as any;
      const prevSales = Number(prevAgg?.total_sales || 0);
      const prevProfit = Number(prevAgg?.gross_profit || 0);
      const prevInvoices = Number(prevAgg?.invoice_count || 0);
      const pctChange = (curr: number, prev: number): number | null => {
        if (prev === 0) return curr === 0 ? 0 : null;
        return ((curr - prev) / Math.abs(prev)) * 100;
      };

      // Group-by selection
      const groupBy = (filters.group_by || 'day').toString();

      // Daily breakdown (always computed; used when group_by=day)
      const dailySales = await Sale.findAll({
        where,
        attributes: [
          'date',
          [fn('SUM', col('total')), 'sales'],
          [fn('SUM', col('gross_profit')), 'gross_profit'],
          [fn('COUNT', col('id')), 'invoice_count'],
        ],
        group: ['date'],
        order: [['date', 'ASC']],
        raw: true,
      }) as any[];

      const dailyBreakdown = dailySales.map((d: any) => ({
        date: d.date,
        sales: Number(d.sales),
        gross_profit: Number(d.gross_profit),
        invoice_count: Number(d.invoice_count),
      }));

      // Weekly + Monthly breakdown via raw SQL (respect filters)
      const rawParams: any = { shopId, from, to };
      const rawFilterSql = this.buildRawSaleFilter(filters, rawParams);

      const monthlySales = await db.query(`
        SELECT
          TO_CHAR(s.date::date, 'YYYY-MM') as period,
          SUM(s.total) as sales,
          SUM(s.gross_profit) as gross_profit,
          COUNT(s.id) as invoice_count
        FROM sales s
        WHERE s.shop_id = :shopId
          AND s.date BETWEEN :from AND :to
          ${rawFilterSql}
        GROUP BY TO_CHAR(s.date::date, 'YYYY-MM')
        ORDER BY period ASC
      `, { replacements: rawParams, type: 'SELECT' as any }) as any[];

      const monthlyBreakdown = monthlySales.map((m: any) => ({
        period: m.period,
        sales: Number(m.sales),
        gross_profit: Number(m.gross_profit),
        invoice_count: Number(m.invoice_count),
      }));

      const weeklySales = await db.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('week', s.date::date), 'IYYY-"W"IW') as period,
          MIN(s.date) as period_start,
          SUM(s.total) as sales,
          SUM(s.gross_profit) as gross_profit,
          COUNT(s.id) as invoice_count
        FROM sales s
        WHERE s.shop_id = :shopId
          AND s.date BETWEEN :from AND :to
          ${rawFilterSql}
        GROUP BY DATE_TRUNC('week', s.date::date)
        ORDER BY DATE_TRUNC('week', s.date::date) ASC
      `, { replacements: rawParams, type: 'SELECT' as any }) as any[];

      const weeklyBreakdown = weeklySales.map((w: any) => ({
        period: w.period,
        period_start: w.period_start,
        sales: Number(w.sales),
        gross_profit: Number(w.gross_profit),
        invoice_count: Number(w.invoice_count),
      }));

      // Best selling (respects filters via join)
      const bestSelling = await db.query(`
        SELECT
          si.product_id,
          si.sku,
          si.name,
          si.size,
          si.barcode,
          SUM(si.qty) as units_sold,
          SUM(si.qty * si.price) as revenue,
          SUM(si.qty * (si.price - si.cost)) as profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE s.shop_id = :shopId
          AND s.date BETWEEN :from AND :to
          ${rawFilterSql}
        GROUP BY si.product_id, si.sku, si.name, si.size, si.barcode
        ORDER BY units_sold DESC
        LIMIT 50
      `, { replacements: rawParams, type: 'SELECT' as any }) as any[];

      // Category-wise revenue (via product_id join)
      const categoryWise = await db.query(`
        SELECT
          COALESCE(c.name, 'Uncategorized') as category,
          SUM(si.qty) as units_sold,
          SUM(si.qty * si.price) as revenue,
          SUM(si.qty * (si.price - si.cost)) as profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        LEFT JOIN products p ON p.id = si.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE s.shop_id = :shopId
          AND s.date BETWEEN :from AND :to
          ${rawFilterSql}
        GROUP BY c.name
        ORDER BY revenue DESC
      `, { replacements: rawParams, type: 'SELECT' as any }) as any[];

      // Payment method breakdown
      const paymentWise = await Sale.findAll({
        where,
        attributes: [
          'payment_method',
          [fn('COUNT', col('id')), 'count'],
          [fn('SUM', col('total')), 'total'],
        ],
        group: ['payment_method'],
        raw: true,
      }) as any[];

      // Payment status breakdown
      const statusWise = await Sale.findAll({
        where,
        attributes: [
          'payment_status',
          [fn('COUNT', col('id')), 'count'],
          [fn('SUM', col('total')), 'total'],
          [fn('SUM', col('amount_due')), 'due_amount'],
        ],
        group: ['payment_status'],
        raw: true,
      }) as any[];

      // Top customers
      const topCustomers = await db.query(`
        SELECT
          COALESCE(NULLIF(s.customer_name, ''), 'Walk-in') as customer_name,
          s.customer_phone,
          COUNT(s.id) as invoice_count,
          SUM(s.total) as total_spent,
          SUM(s.gross_profit) as total_profit
        FROM sales s
        WHERE s.shop_id = :shopId
          AND s.date BETWEEN :from AND :to
          ${rawFilterSql}
        GROUP BY COALESCE(NULLIF(s.customer_name, ''), 'Walk-in'), s.customer_phone
        ORDER BY total_spent DESC
        LIMIT 20
      `, { replacements: rawParams, type: 'SELECT' as any }) as any[];

      // Invoices list (full detail)
      const invoicesList = await Sale.findAll({
        where,
        include: [{ model: SaleItem }],
        order: [['date', 'ASC'], ['created_at', 'ASC']],
      });

      // Payment-method options (all unique values in this shop so UI can offer them)
      const allMethods = await Sale.findAll({
        where: { shop_id: shopId },
        attributes: [[fn('DISTINCT', col('payment_method')), 'payment_method']],
        raw: true,
      }) as any[];

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        summary: {
          total_sales: totalSales,
          total_cogs: totalCogs,
          gross_profit: grossProfit,
          gross_margin_pct: Number(grossMarginPct.toFixed(2)),
          total_discount: Number(salesAgg?.total_discount || 0),
          total_paid: Number(salesAgg?.total_paid || 0),
          total_due: Number(salesAgg?.total_due || 0),
          invoice_count: Number(salesAgg?.invoice_count || 0),
          avg_invoice_value: Number(salesAgg?.avg_invoice_value || 0),
          min_invoice_value: Number(salesAgg?.min_invoice_value || 0),
          max_invoice_value: Number(salesAgg?.max_invoice_value || 0),
        },
        comparison: {
          prev_from: prevFrom,
          prev_to: prevTo,
          prev_sales: prevSales,
          prev_profit: prevProfit,
          prev_invoice_count: prevInvoices,
          sales_change_pct: pctChange(totalSales, prevSales),
          profit_change_pct: pctChange(grossProfit, prevProfit),
          invoices_change_pct: pctChange(Number(salesAgg?.invoice_count || 0), prevInvoices),
        },
        group_by: groupBy,
        daily_breakdown: dailyBreakdown,
        weekly_breakdown: weeklyBreakdown,
        monthly_breakdown: monthlyBreakdown,
        best_selling: bestSelling,
        category_wise: categoryWise,
        payment_wise: paymentWise.map((p: any) => ({
          payment_method: p.payment_method,
          count: Number(p.count),
          total: Number(p.total),
        })),
        status_wise: statusWise.map((p: any) => ({
          payment_status: p.payment_status,
          count: Number(p.count),
          total: Number(p.total),
          due_amount: Number(p.due_amount || 0),
        })),
        top_customers: topCustomers,
        invoices_list: invoicesList,
        date_range: { from, to },
        available_payment_methods: allMethods.map((m: any) => m.payment_method).filter(Boolean),
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, error?.message || RES_MESSAGE.EM500);
    }
  }

  async exportCsvService(req: any) {
    try {
      const shopId = req.shopId;
      const { from, to } = req.query;
      const filters = req.query;

      if (!from || !to) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'Both from and to date parameters are required');
      }

      const where = this.buildSaleWhere(shopId, from, to, filters);
      const sales = await Sale.findAll({
        where,
        include: [{ model: SaleItem }],
        order: [['date', 'ASC']],
      });

      const rows: string[] = [
        'Invoice No,Date,Customer Name,Customer Phone,Subtotal,Discount,Total,Amount Paid,Amount Due,COGS,Gross Profit,Payment Method,Payment Status',
      ];
      for (const sale of sales) {
        rows.push(
          [
            sale.invoice_no,
            sale.date,
            `"${(sale.customer_name || '').replace(/"/g, '""')}"`,
            sale.customer_phone || '',
            sale.subtotal,
            sale.discount,
            sale.total,
            sale.amount_paid,
            sale.amount_due,
            sale.cogs,
            sale.gross_profit,
            sale.payment_method,
            sale.payment_status,
          ].join(',')
        );
      }
      const csv = rows.join('\n');
      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        csv,
        filename: `sales_${from}_to_${to}.csv`,
        row_count: sales.length,
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, error?.message || RES_MESSAGE.EM500);
    }
  }
}

export default new ReportService();
