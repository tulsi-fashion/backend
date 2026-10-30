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
import ProductVariant from './ProductVariant';

@Table({ tableName: 'product_files', timestamps: true, underscored: true })
export default class ProductFile extends Model {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false })
  shop_id!: string;

  @ForeignKey(() => Product)
  @Column({ type: DataType.UUID, allowNull: true })
  product_id!: string;

  @BelongsTo(() => Product)
  product!: Product;

  @ForeignKey(() => ProductVariant)
  @Column({ type: DataType.UUID, allowNull: true })
  variant_id!: string;

  @BelongsTo(() => ProductVariant)
  variant!: ProductVariant;

  @Column({ type: DataType.TEXT, allowNull: false })
  file_url!: string;

  @Column({ type: DataType.STRING(50), allowNull: false, defaultValue: 'image' })
  file_type!: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  sort_order!: number;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
