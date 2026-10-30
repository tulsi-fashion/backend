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

@Table({ tableName: 'customers', timestamps: true, underscored: true })
export default class Customer extends Model {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false })
  shop_id!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  name!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  phone!: string;

  @Column({ type: DataType.STRING(5), allowNull: false, defaultValue: '91' })
  phone_code!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  email!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  company!: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  address!: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  notes!: string;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
