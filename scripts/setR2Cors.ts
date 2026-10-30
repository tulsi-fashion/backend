/**
 * Sets CORS policy on the R2 bucket via the Cloudflare API.
 *
 * Requires a Cloudflare API Token (not the R2 access key).
 * Create one at: https://dash.cloudflare.com/profile/api-tokens
 *   → "Edit Cloudflare Workers" template  OR  custom token with
 *     permission: Account > Cloudflare R2 Storage > Edit
 *
 * Add to .env:
 *   CF_ACCOUNT_ID=6b63176bf1c31637b601099d31b93018
 *   CF_API_TOKEN=your_cloudflare_api_token_here
 *
 * Run: npx ts-node scripts/setR2Cors.ts
 */
import 'dotenv/config';

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const API_TOKEN  = process.env.CF_API_TOKEN;
const BUCKET     = process.env.R2_PUBLIC_BUCKET_NAME;

if (!ACCOUNT_ID || !API_TOKEN || !BUCKET) {
  console.error('Missing CF_ACCOUNT_ID, CF_API_TOKEN, or R2_PUBLIC_BUCKET_NAME in .env');
  process.exit(1);
}

const corsRules = [
  {
    allowed_origins: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
    ],
    allowed_methods: ['PUT', 'GET', 'HEAD'],
    allowed_headers: ['Content-Type', 'Content-Length'],
    max_age_seconds: 3600,
  },
];

async function run() {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/cors`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rules: corsRules }),
  });

  const json = await res.json() as any;

  if (!res.ok || !json.success) {
    console.error('✗ Failed:', JSON.stringify(json.errors ?? json, null, 2));
    process.exit(1);
  }

  console.log('✓ CORS rules applied to bucket:', BUCKET);
}

run().catch(err => { console.error(err); process.exit(1); });
