import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import Customer from './Customer';
import Sale from './Sale';

@Table({ tableName: 'partial_payments', timestamps: true, underscored: true })
export default class PartialPayment extends Model {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false })
  shop_id!: string;

  @ForeignKey(() => Sale)
  @Column({ type: DataType.UUID, allowNull: true })
  sale_id!: string;

  @BelongsTo(() => Sale)
  sale!: Sale;

  @ForeignKey(() => Customer)
  @Column({ type: DataType.UUID, allowNull: true })
  customer_id!: string;

  @BelongsTo(() => Customer)
  customer!: Customer;

  @Column({ type: DataType.STRING, allowNull: false })
  customer_name!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  customer_phone!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  invoice_no!: string;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  bill_total!: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  amount_paid!: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  amount_due!: number;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  date!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  payment_method!: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  notes!: string;

  @Column({ type: DataType.ENUM('open', 'settled'), defaultValue: 'open' })
  status!: string;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
