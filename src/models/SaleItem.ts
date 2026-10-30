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

// Forward reference to avoid circular dependency
@Table({ tableName: 'sale_items', timestamps: true, underscored: true })
export default class SaleItem extends Model {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false })
  sale_id!: string;

  @ForeignKey(() => Product)
  @Column({ type: DataType.UUID, allowNull: true })
  product_id!: string;

  @BelongsTo(() => Product)
  product!: Product;

  @Column({ type: DataType.STRING, allowNull: true })
  sku!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  barcode!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  name!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  size!: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  qty!: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  price!: number;

  @Column({ type: DataType.DECIMAL(10, 2), defaultValue: 0 })
  cost!: number;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
