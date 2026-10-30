import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import Handler from '../../common/handler';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';
import Shop from '../../models/Shop';
import User from '../../models/User';
import db_config from '../../config';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: db_config.R2.R2_S3_API_URL,
  credentials: {
    accessKeyId: db_config.R2.R2_ACCESS_KEY_ID,
    secretAccessKey: db_config.R2.R2_SECRET_ACCESS_KEY,
  },
});

class SettingsService {
  async getSettingsService(req: any) {
    try {
      const shopId = req.shopId;
      const userId = req.userId;

      const shop = await Shop.findOne({ where: { id: shopId } });
      if (!shop) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      const user = await User.findOne({
        where: { id: userId },
        attributes: { exclude: ['password_hash', 'refresh_token'] },
      });

      // Get all staff users for this shop
      const staff = await User.findAll({
        where: { shop_id: shopId, is_active: true },
        attributes: { exclude: ['password_hash', 'refresh_token'] },
      });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, {
        shop,
        user,
        staff,
      });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async updateBrandingService(req: any) {
    try {
      const shopId = req.shopId;
      const { name, logo_url, phone, address, gstin } = req.body;

      const shop = await Shop.findOne({ where: { id: shopId } });
      if (!shop) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (logo_url !== undefined) updateData.logo_url = logo_url;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (gstin !== undefined) updateData.gstin = gstin;

      await shop.update(updateData);

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM208, { shop });
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async testR2ConnectionService(req: any) {
    try {
      if (!db_config.R2.R2_S3_API_URL || !db_config.R2.R2_ACCESS_KEY_ID) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'R2 credentials not configured');
      }

      // Try to upload a small test file
      const testKey = `test/${req.shopId}/connection-test-${Date.now()}.txt`;
      await r2Client.send(
        new PutObjectCommand({
          Bucket: db_config.R2.R2_PUBLIC_BUCKET_NAME,
          Key: testKey,
          Body: Buffer.from('Tulshi Fashion R2 connection test'),
          ContentType: 'text/plain',
        })
      );

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, 'R2 connection successful!', {
        bucket: db_config.R2.R2_PUBLIC_BUCKET_NAME,
        endpoint: db_config.R2.R2_S3_API_URL,
        test_key: testKey,
        public_url: `${db_config.R2.R2_PUBLIC_URL}/${testKey}`,
      });
    } catch (error: any) {
      return Handler.Error(
        RES_STATUS.E2,
        STATUS_CODE.EC500,
        `R2 connection failed: ${error.message}`
      );
    }
  }

  async updateProfileService(req: any) {
    try {
      const userId = req.userId;
      const { name, profile_pic } = req.body;

      const user = await User.findOne({ where: { id: userId } });
      if (!user) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (profile_pic !== undefined) updateData.profile_pic = profile_pic;

      await user.update(updateData);

      const { password_hash, refresh_token, ...safe } = user.toJSON();
      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM208, { user: safe });
    } catch {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }

  async changePasswordService(req: any) {
    try {
      const userId = req.userId;
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'current_password and new_password are required');
      }

      if (new_password.length < 8) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'New password must be at least 8 characters');
      }

      const user = await User.findOne({ where: { id: userId } });
      if (!user) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404);
      }

      const bcrypt = await import('bcrypt');
      const isValid = await bcrypt.compare(current_password, user.password_hash);
      if (!isValid) {
        return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC401, 'Current password is incorrect');
      }

      const newHash = await bcrypt.hash(new_password, 12);
      await user.update({ password_hash: newHash, plan_password: new_password, refresh_token: '' });

      return Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, 'Password changed successfully');
    } catch (error: any) {
      return Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500);
    }
  }
}

export default new SettingsService();


