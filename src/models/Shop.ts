import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  HasMany,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';

@Table({ tableName: 'shops', timestamps: true, underscored: true })
export default class Shop extends Model {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  id!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  name!: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  logo_url!: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  owner_email!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  phone!: string;

  @Column({ type: DataType.STRING(5), allowNull: false, defaultValue: '91' })
  phone_code!: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  address!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  gstin!: string;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
