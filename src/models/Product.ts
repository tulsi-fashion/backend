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
import Category from './Category';
import ProductVariant from './ProductVariant';
import ProductFile from './ProductFile';

@Table({ tableName: 'products', timestamps: true, underscored: true })
export default class Product extends Model {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false })
  shop_id!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  sku!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  name!: string;

  @ForeignKey(() => Category)
  @Column({ type: DataType.UUID, allowNull: true })
  category_id!: string;

  @BelongsTo(() => Category)
  category_info!: Category;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  purchase_price!: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  selling_price!: number;

  @Column({ type: DataType.STRING, allowNull: true })
  notes!: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  photo_url!: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  product_sequence!: number;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  is_active!: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  is_deleted!: boolean;

  @HasMany(() => ProductVariant)
  variants!: ProductVariant[];

  @HasMany(() => ProductFile)
  files!: ProductFile[];

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
