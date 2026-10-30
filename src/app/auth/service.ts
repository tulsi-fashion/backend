import bcrypt from 'bcrypt';
import Handler from '../../common/handler';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Shop from '../../models/Shop';
import User from '../../models/User';
import { db } from '../../config/db';

class AuthService {
  async registerService(req: any) {
    const t = await db.transaction();
    try {
      const { shopName, email, password, ownerName, phone } = req.body;

      // Check if email already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        await t.rollback();
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC409, RES_MESSAGE.EM409);
      }

      // Check if shop owner email already registered
      const existingShop = await Shop.findOne({ where: { owner_email: email } });
      if (existingShop) {
        await t.rollback();
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC409, 'Shop already registered with this email');
      }

      // Create shop
      const shop = await Shop.create(
        { name: shopName, owner_email: email, phone: phone || null },
        { transaction: t }
      );

      // Hash password
      const password_hash = await bcrypt.hash(password, 12);

      // Create user
      const user = await User.create(
        {
          shop_id: shop.id,
          name: ownerName,
          email,
          password_hash,
          plan_password: password,
          role: 'owner',
          is_active: true,
        },
        { transaction: t }
      );

      await t.commit();

      const token = Handler.generateToken({ userId: user.id, shopId: shop.id, role: user.role });
      const refreshToken = Handler.generateRefreshToken({ userId: user.id, shopId: shop.id });

      // Store refresh token
      await User.update({ refresh_token: refreshToken }, { where: { id: user.id } });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC201, RES_MESSAGE.REGISTER_SUCCESS, {
        token,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          shop_id: shop.id,
          shop_name: shop.name,
        },
      });
    } catch (error: any) {
      await t.rollback();
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async loginService(req: any) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({
        where: { email, is_active: true },
        include: [{ model: Shop }],
      });

      if (!user) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC401, RES_MESSAGE.INVALID_CREDENTIALS);
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC401, RES_MESSAGE.INVALID_CREDENTIALS);
      }

      const token = Handler.generateToken({ userId: user.id, shopId: user.shop_id, role: user.role });
      const refreshToken = Handler.generateRefreshToken({ userId: user.id, shopId: user.shop_id });

      // Store refresh token
      await User.update({ refresh_token: refreshToken }, { where: { id: user.id } });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.LOGIN_SUCCESS, {
        token,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          shop_id: user.shop_id,
          shop_name: (user as any).shop?.name,
          shop_logo: (user as any).shop?.logo_url,
        },
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async refreshTokenService(req: any) {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, RES_MESSAGE.EM400);
      }

      let decoded: any;
      try {
        decoded = Handler.verifyRefreshToken(refresh_token);
      } catch (err) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC401, RES_MESSAGE.TOKEN_EXPIRED);
      }

      const user = await User.findOne({
        where: { id: decoded.userId, refresh_token, is_active: true },
      });

      if (!user) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC401, RES_MESSAGE.INVALID_TOKEN);
      }

      const token = Handler.generateToken({ userId: user.id, shopId: user.shop_id, role: user.role });
      const newRefreshToken = Handler.generateRefreshToken({ userId: user.id, shopId: user.shop_id });

      await User.update({ refresh_token: newRefreshToken }, { where: { id: user.id } });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        token,
        refresh_token: newRefreshToken,
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async getMeService(req: any) {
    try {
      const user = await User.findOne({
        where: { id: req.userId, is_active: true },
        include: [{ model: Shop }],
        attributes: { exclude: ['password_hash', 'refresh_token'] },
      });

      if (!user) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, { user });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async logoutService(req: any) {
    try {
      await User.update({ refresh_token: '' }, { where: { id: req.userId } });
      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.LOGOUT_SUCCESS);
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async seedService() {
    const SEED_EMAIL    = 'tulsifashion02@gmail.com';
    const SEED_PASSWORD = 'Tulsi@123';
    const SEED_SHOP     = 'Tulshi Fashion';
    const SEED_OWNER    = 'Tulshi Fashion';

    const t = await db.transaction();
    try {
      const existingUser = await User.findOne({ where: { email: SEED_EMAIL }, transaction: t });

      if (existingUser) {
        await t.rollback();
        return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, 'User already exists, skipped.', {
          email: SEED_EMAIL,
          created: false,
        });
      }

      let shop = await Shop.findOne({ where: { owner_email: SEED_EMAIL }, transaction: t });
      if (!shop) {
        shop = await Shop.create(
          { name: SEED_SHOP, owner_email: SEED_EMAIL },
          { transaction: t }
        );
      }

      const password_hash = await bcrypt.hash(SEED_PASSWORD, 12);

      await User.create(
        {
          shop_id: shop.id,
          name: SEED_OWNER,
          email: SEED_EMAIL,
          password_hash,
          plan_password: SEED_PASSWORD,
          role: 'owner',
          is_active: true,
        },
        { transaction: t }
      );

      await t.commit();

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC201, 'Seed user created successfully.', {
        email: SEED_EMAIL,
        shop: SEED_SHOP,
        created: true,
      });
    } catch (error: any) {
      await t.rollback();
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }
}

export default new AuthService();


