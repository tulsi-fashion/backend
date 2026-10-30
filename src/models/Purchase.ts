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
import Product from './Product';

@Table({ tableName: 'purchases', timestamps: true, underscored: true })
export default class Purchase extends Model {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false })
  shop_id!: string;

  @ForeignKey(() => Product)
  @Column({ type: DataType.UUID, allowNull: false })
  product_id!: string;

  @BelongsTo(() => Product)
  product!: Product;

  @Column({ type: DataType.INTEGER, allowNull: false })
  qty!: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  unit_cost!: number;

  @Column({ type: DataType.STRING, allowNull: true })
  supplier!: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  date!: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  notes!: string;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
