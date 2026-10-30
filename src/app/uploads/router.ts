import express from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from '../../config/r2';
import handleAuthorization from '../../middleware/handleAuthorization';
import Handler from '../../common/handler';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from '../../common/statusMessageCode';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const router = express.Router();

// POST /api/uploads/presign
// Body: { files: Array<{ filename: string; contentType: string; size: number }>, folder?: string }
// Returns: Array<{ uploadUrl, key, publicUrl, originalName }>
router.post('/presign', handleAuthorization, async (req: any, res: any) => {
  try {
    const { files, folder = 'products' } = req.body;

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(STATUS_CODE.EC400).json(
        Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'files array is required')
      );
    }

    if (files.length > 20) {
      return res.status(STATUS_CODE.EC400).json(
        Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'Maximum 20 files per request')
      );
    }

    const results: object[] = [];

    for (const file of files) {
      const { filename, contentType, size } = file;

      if (!filename || !contentType) {
        return res.status(STATUS_CODE.EC400).json(
          Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, 'Each file needs filename and contentType')
        );
      }

      if (!ALLOWED_TYPES.includes(contentType)) {
        return res.status(STATUS_CODE.EC400).json(
          Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, `File type ${contentType} not allowed. Use JPEG, PNG, WebP or GIF.`)
        );
      }

      if (size && Number(size) > MAX_SIZE_BYTES) {
        return res.status(STATUS_CODE.EC400).json(
          Handler.Error(RES_STATUS.E2, STATUS_CODE.EC400, `File ${filename} exceeds 10 MB limit`)
        );
      }

      const ext = path.extname(filename).toLowerCase() || '.jpg';
      const key = `${folder}/${req.shopId}/${uuidv4()}${ext}`;

      const command = new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });

      results.push({
        uploadUrl,
        key,
        publicUrl: `${R2_PUBLIC_URL}/${key}`,
        originalName: filename,
      });
    }

    res.json(Handler.Success(RES_STATUS.E1, STATUS_CODE.EC200, RES_MESSAGE.EM200, { files: results }));
  } catch {
    res.status(STATUS_CODE.EC500).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
  }
});

export default router;
