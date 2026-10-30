import dotenv from 'dotenv';
dotenv.config();

import { Sequelize } from 'sequelize-typescript';
import db_config from './index';

import Shop from '../models/Shop';
import User from '../models/User';
import Product from '../models/Product';
import Purchase from '../models/Purchase';
import Customer from '../models/Customer';
import Sale from '../models/Sale';
import SaleItem from '../models/SaleItem';
import Credit from '../models/Credit';
import PartialPayment from '../models/PartialPayment';
import Category from '../models/Category';
import Size from '../models/Size';
import ProductVariant from '../models/ProductVariant';
import ProductFile from '../models/ProductFile';

export const db = new Sequelize({
  dialect: 'postgres',
  host: db_config.DB.DB_HOST,
  port: db_config.DB.DB_PORT,
  database: db_config.DB.DB_NAME,
  username: db_config.DB.DB_USER,
  password: db_config.DB.DB_PASSWORD,
  logging: db_config.SERVER_MODE === 'DEV' ? console.log : false,
  ...(db_config.SERVER_MODE !== 'DEV' && {
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }),
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  models: [Shop, User, Product, ProductVariant, ProductFile, Purchase, Customer, Sale, SaleItem, Credit, PartialPayment, Category, Size],
});
