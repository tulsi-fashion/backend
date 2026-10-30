import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  ForeignKey,
  BelongsTo,
  HasMany,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import Customer from './Customer';
import SaleItem from './SaleItem';

@Table({ tableName: 'sales', timestamps: true, underscored: true })
export default class Sale extends Model {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false })
  shop_id!: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  invoice_no!: string;

  @ForeignKey(() => Customer)
  @Column({ type: DataType.UUID, allowNull: true })
  customer_id!: string;

  @BelongsTo(() => Customer)
  customer!: Customer;

  @Column({ type: DataType.STRING, allowNull: true })
  customer_name!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  customer_phone!: string;

  @Column({ type: DataType.DECIMAL(10, 2), defaultValue: 0 })
  subtotal!: number;

  @Column({ type: DataType.DECIMAL(10, 2), defaultValue: 0 })
  discount!: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  total!: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  amount_paid!: number;

  @Column({ type: DataType.DECIMAL(10, 2), defaultValue: 0 })
  amount_due!: number;

  @Column({ type: DataType.DECIMAL(10, 2), defaultValue: 0 })
  cogs!: number;

  @Column({ type: DataType.DECIMAL(10, 2), defaultValue: 0 })
  gross_profit!: number;

  @Column({ type: DataType.STRING, defaultValue: 'cash' })
  payment_method!: string;

  @Column({ type: DataType.ENUM('paid', 'partial', 'due'), defaultValue: 'paid' })
  payment_status!: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  invoice_pdf_url!: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  date!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  time!: string;

  @HasMany(() => SaleItem, { foreignKey: 'sale_id' })
  items!: SaleItem[];

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
