import { Op, fn, col, where as sqlWhere } from 'sequelize';
import Handler from './handler';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from './statusMessageCode';

export function slugify(text: string): string {
  return String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export interface MasterConfig {
  model: any; // sequelize model with shop_id, name, is_active, is_deleted
  label: string; // "Category" | "Size" - used in messages
  defaults: Record<string, any>[]; // seeded once per shop
  orderBy: any[]; // default ordering
  dropdownAttributes: string[];
  fields: string[]; // body fields allowed on create/update
  beforeCreate?: (shopId: string, body: any) => Promise<Record<string, any> | string>; // extra fields, or an error message
  beforeUpdate?: (shopId: string, record: any, data: any) => Promise<Record<string, any> | string>;
  onRename?: (shopId: string, oldName: string, newName: string) => Promise<void>;
}

const ok = (code: number, msg: string, data?: any) => Handler.Success(RES_STATUS.E1, code, msg, data);
const fail = (code: number, msg: string) => Handler.Error(RES_STATUS.E2, code, msg);

export class MasterCrud {
  constructor(private cfg: MasterConfig) {}

  private notDeleted(shopId: string) {
    return { shop_id: shopId, is_deleted: false };
  }

  private nameWhere(name: string) {
    return sqlWhere(fn('lower', col('name')), String(name).trim().toLowerCase());
  }

  /** Slug from name, unique among the shop's non-deleted rows (a deleted row's slug can be reused). */
  private uniqueSlug = async (shopId: string, name: string, excludeId?: string) => {
    const base = slugify(name);
    let slug = base;
    for (let i = 2; ; i++) {
      const where: any = { ...this.notDeleted(shopId), slug };
      if (excludeId) where.id = { [Op.ne]: excludeId };
      if (!(await this.cfg.model.findOne({ where, attributes: ['id'] }))) return slug;
      slug = `${base}-${i}`;
    }
  };

  /** Rows created before slugs existed get one on first list. */
  private backfillSlugs = async (shopId: string) => {
    const missing = await this.cfg.model.findAll({ where: { shop_id: shopId, slug: null } });
    for (const row of missing) {
      await row.update({ slug: row.is_deleted ? slugify(row.name) : await this.uniqueSlug(shopId, row.name, row.id) });
    }
  };

  /** Seed default rows the first time a shop opens this master (deleted rows count, so they never come back). */
  ensureDefaults = async (shopId: string) => {
    const { model, defaults } = this.cfg;
    if (!defaults.length) return;
    const existing = await model.count({ where: { shop_id: shopId } });
    if (existing > 0) return;
    await model.bulkCreate(defaults.map((d) => ({ ...d, shop_id: shopId })));
  };

  /** Dropdown: only active and not deleted. */
  dropdown = async (req: any) => {
    try {
      const shopId = req.shopId;
      await this.ensureDefaults(shopId);
      const rows = await this.cfg.model.findAll({
        where: { ...this.notDeleted(shopId), is_active: true },
        attributes: this.cfg.dropdownAttributes,
        order: this.cfg.orderBy,
      });
      return ok(STATUS_CODE.EC200, RES_MESSAGE.EM200, rows);
    } catch {
      return fail(STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  };

  /**
   * Management list. Filters: search, status (all | active | inactive | deleted | any), sort, page, limit.
   * "all" (default) = not deleted, "any" = everything including deleted. Also returns shop-wide counts.
   */
  list = async (req: any) => {
    try {
      const shopId = req.shopId;
      await this.ensureDefaults(shopId);
      await this.backfillSlugs(shopId);
      const { search, is_active, status = 'all', sort, from, to, page = 1, limit = 10 } = req.query;

      const where: any = { shop_id: shopId };
      switch (status) {
        case 'active': where.is_deleted = false; where.is_active = true; break;
        case 'inactive': where.is_deleted = false; where.is_active = false; break;
        case 'deleted': where.is_deleted = true; break;
        case 'any': break;
        default: where.is_deleted = false;
      }
      if (is_active === 'true') where.is_active = true;
      if (is_active === 'false') where.is_active = false;
      if (search) {
        const q = `%${String(search).trim()}%`;
        where[Op.or] = [{ name: { [Op.iLike]: q } }, { slug: { [Op.iLike]: q } }];
      }
      const created: any = {};
      if (from) created[Op.gte] = new Date(`${from}T00:00:00`);
      if (to) created[Op.lte] = new Date(`${to}T23:59:59.999`);
      if (from || to) where.created_at = created;

      const sorts: Record<string, any[]> = {
        name_asc: [['name', 'ASC']],
        name_desc: [['name', 'DESC']],
        newest: [['created_at', 'DESC']],
        oldest: [['created_at', 'ASC']],
      };
      const order = sorts[String(sort)] || this.cfg.orderBy;

      const pageNo = Math.max(Number(page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 500);

      const { count, rows } = await this.cfg.model.findAndCountAll({
        where,
        order,
        limit: pageSize,
        offset: (pageNo - 1) * pageSize,
      });

      const base = { shop_id: shopId };
      const [cAll, cActive, cInactive, cDeleted] = await Promise.all([
        this.cfg.model.count({ where: { ...base, is_deleted: false } }),
        this.cfg.model.count({ where: { ...base, is_deleted: false, is_active: true } }),
        this.cfg.model.count({ where: { ...base, is_deleted: false, is_active: false } }),
        this.cfg.model.count({ where: { ...base, is_deleted: true } }),
      ]);

      return ok(STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        items: rows,
        counts: { all: cAll, active: cActive, inactive: cInactive, deleted: cDeleted },
        total: count,
        page: pageNo,
        totalPages: Math.ceil(count / pageSize),
      });
    } catch {
      return fail(STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  };

  getById = async (req: any) => {
    try {
      const record = await this.cfg.model.findOne({
        where: { id: req.params.id, ...this.notDeleted(req.shopId) },
      });
      if (!record) return fail(STATUS_CODE.EC404, RES_MESSAGE.EM404);
      return ok(STATUS_CODE.EC200, RES_MESSAGE.EM200, record);
    } catch {
      return fail(STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  };

  create = async (req: any) => {
    try {
      const shopId = req.shopId;
      const { model, label, fields, beforeCreate } = this.cfg;
      const name = String(req.body.name).trim();

      const dup = await model.findOne({ where: { ...this.notDeleted(shopId), [Op.and]: [this.nameWhere(name)] } });
      if (dup) return fail(STATUS_CODE.EC409, `${label} "${name}" already exists`);

      const payload: any = { shop_id: shopId, name, slug: await this.uniqueSlug(shopId, name), is_active: req.body.is_active ?? true, is_deleted: false };
      for (const f of fields) if (req.body[f] !== undefined && f !== 'name') payload[f] = req.body[f];

      if (beforeCreate) {
        const extra = await beforeCreate(shopId, { ...req.body, name });
        if (typeof extra === 'string') return fail(STATUS_CODE.EC409, extra);
        Object.assign(payload, extra);
      }

      const record = await model.create(payload);
      return ok(STATUS_CODE.EC201, RES_MESSAGE.EM201, record);
    } catch {
      return fail(STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  };

  update = async (req: any) => {
    try {
      const shopId = req.shopId;
      const { model, label, fields, beforeUpdate, onRename } = this.cfg;
      const record = await model.findOne({ where: { id: req.params.id, ...this.notDeleted(shopId) } });
      if (!record) return fail(STATUS_CODE.EC404, RES_MESSAGE.EM404);

      const data: any = {};
      for (const f of fields) if (req.body[f] !== undefined) data[f] = req.body[f];
      if (req.body.is_active !== undefined) data.is_active = req.body.is_active;

      const oldName = record.name;
      if (data.name !== undefined) {
        data.name = String(data.name).trim();
        const dup = await model.findOne({
          where: { ...this.notDeleted(shopId), id: { [Op.ne]: record.id }, [Op.and]: [this.nameWhere(data.name)] },
        });
        if (dup) return fail(STATUS_CODE.EC409, `${label} "${data.name}" already exists`);
        data.slug = await this.uniqueSlug(shopId, data.name, record.id);
      }

      if (beforeUpdate) {
        const extra = await beforeUpdate(shopId, record, data);
        if (typeof extra === 'string') return fail(STATUS_CODE.EC409, extra);
        Object.assign(data, extra);
      }

      await record.update(data);
      if (onRename && data.name && data.name !== oldName) await onRename(shopId, oldName, data.name);

      return ok(STATUS_CODE.EC200, RES_MESSAGE.EM208, record);
    } catch {
      return fail(STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  };

  /** PATCH /:id/status - body { is_active }, toggles when omitted. */
  setStatus = async (req: any) => {
    try {
      const record = await this.cfg.model.findOne({
        where: { id: req.params.id, ...this.notDeleted(req.shopId) },
      });
      if (!record) return fail(STATUS_CODE.EC404, RES_MESSAGE.EM404);
      const next = typeof req.body?.is_active === 'boolean' ? req.body.is_active : !record.is_active;
      await record.update({ is_active: next });
      return ok(STATUS_CODE.EC200, RES_MESSAGE.EM208, record);
    } catch {
      return fail(STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  };

  /** Soft delete: the row stays (existing products keep their value) but disappears everywhere. */
  remove = async (req: any) => {
    try {
      const record = await this.cfg.model.findOne({
        where: { id: req.params.id, ...this.notDeleted(req.shopId) },
      });
      if (!record) return fail(STATUS_CODE.EC404, RES_MESSAGE.EM404);
      await record.update({ is_deleted: true, is_active: false });
      return ok(STATUS_CODE.EC200, RES_MESSAGE.EM210, null);
    } catch {
      return fail(STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  };

  /** PATCH /:id/restore - bring a deleted row back (as inactive) unless its name is taken again. */
  restore = async (req: any) => {
    try {
      const shopId = req.shopId;
      const { model, label } = this.cfg;
      const record = await model.findOne({ where: { id: req.params.id, shop_id: shopId, is_deleted: true } });
      if (!record) return fail(STATUS_CODE.EC404, RES_MESSAGE.EM404);

      const dup = await model.findOne({ where: { ...this.notDeleted(shopId), [Op.and]: [this.nameWhere(record.name)] } });
      if (dup) return fail(STATUS_CODE.EC409, `${label} "${record.name}" already exists, cannot restore`);

      await record.update({ is_deleted: false, is_active: false, slug: await this.uniqueSlug(shopId, record.name, record.id) });
      return ok(STATUS_CODE.EC200, RES_MESSAGE.EM208, record);
    } catch {
      return fail(STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  };

  /** Used by the product module: an active, non-deleted entry by name (case-insensitive). */
  findActiveByName = async (shopId: string, name: string, transaction?: any) => {
    await this.ensureDefaults(shopId);
    return this.cfg.model.findOne({
      where: { ...this.notDeleted(shopId), is_active: true, [Op.and]: [this.nameWhere(name)] },
      transaction,
    });
  };
}
