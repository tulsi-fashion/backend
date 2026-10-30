import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';

@Table({
  tableName: 'sizes',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['shop_id', 'is_deleted', 'is_active'] }],
})
export default class Size extends Model {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false })
  shop_id!: string;

  @Column({ type: DataType.STRING(50), allowNull: false })
  name!: string; // e.g. XL, 2XL, Free Size

  @Column({ type: DataType.STRING(2), allowNull: false })
  code!: string; // 2-digit code used in barcode e.g. 04 -> TF00420401

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  sort_order!: number;

  @Column({ type: DataType.STRING(150), allowNull: true })
  slug!: string; // generated from name, unique among non-deleted rows

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  is_active!: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  is_deleted!: boolean;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
