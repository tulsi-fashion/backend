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
import Shop from './Shop';

@Table({ tableName: 'users', timestamps: true, underscored: true })
export default class User extends Model {
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => Shop)
  @Column({ type: DataType.UUID, allowNull: false })
  shop_id!: string;

  @BelongsTo(() => Shop)
  shop!: Shop;

  @Column({ type: DataType.STRING, allowNull: false })
  name!: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  email!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  password_hash!: string;

  @Column({ type: DataType.ENUM('owner', 'staff'), defaultValue: 'owner' })
  role!: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  profile_pic!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  plan_password!: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  is_active!: boolean;

  @Column({ type: DataType.TEXT, allowNull: true })
  refresh_token!: string;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
