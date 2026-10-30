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
import Product from './Product';
import Size from './Size';
import ProductFile from './ProductFile';

@Table({ tableName: 'product_variants', timestamps: true, underscored: true })
export default class ProductVariant extends Model {
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

  @ForeignKey(() => Size)
  @Column({ type: DataType.UUID, allowNull: false })
  size_id!: string;

  @BelongsTo(() => Size)
  size_info!: Size;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  barcode!: string;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: true })
  purchase_price!: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: true })
  selling_price!: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  stock!: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  reorder_level!: number;

  @Column({ type: DataType.TEXT, allowNull: true })
  photo_url!: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  is_active!: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  is_deleted!: boolean;

  @HasMany(() => ProductFile)
  files!: ProductFile[];

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
