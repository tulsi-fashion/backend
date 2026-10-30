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

@Table({ tableName: 'credits', timestamps: true, underscored: true })
export default class Credit extends Model {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false })
  shop_id!: string;

  @ForeignKey(() => Customer)
  @Column({ type: DataType.UUID, allowNull: true })
  customer_id!: string;

  @BelongsTo(() => Customer)
  customer!: Customer;

  @Column({ type: DataType.STRING, allowNull: false })
  customer_name!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  customer_phone!: string;

  @Column({
    type: DataType.ENUM('credit', 'payment', 'partial_settlement'),
    allowNull: false,
  })
  type!: string;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  amount!: number;

  @Column({ type: DataType.STRING, allowNull: true })
  reference!: string; // invoice_no

  @Column({ type: DataType.TEXT, allowNull: true })
  notes!: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  date!: string;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
