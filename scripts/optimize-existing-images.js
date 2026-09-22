require('dotenv').config();

const { createHash } = require('crypto');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');
const sharp = require('sharp');

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_CONCURRENCY = 4;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

const TARGETS = {
  flashcards: {
    table: 'flashcards',
    column: 'imageUrl',
    keyColumn: 'imageKey',
    width: 320,
    height: 240,
  },
  books: {
    table: 'books',
    column: 'coverImage',
    keyColumn: 'coverImageKey',
    width: 480,
    height: 640,
  },
};

function parsePositiveInteger(argument, name, maximum) {
  const value = Number(argument.slice(name.length + 1));
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer from 1 through ${maximum}`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    apply: false,
    batchSize: DEFAULT_BATCH_SIZE,
    concurrency: DEFAULT_CONCURRENCY,
    only: 'all',
  };

  for (const argument of argv) {
    if (argument === '--apply') {
      options.apply = true;
    } else if (argument.startsWith('--batch-size=')) {
      options.batchSize = parsePositiveInteger(argument, '--batch-size', 1000);
    } else if (argument.startsWith('--concurrency=')) {
      options.concurrency = parsePositiveInteger(argument, '--concurrency', 20);
    } else if (argument.startsWith('--only=')) {
      options.only = argument.slice('--only='.length);
      if (!['all', 'flashcards', 'books'].includes(options.only)) {
        throw new Error('--only must be all, flashcards, or books');
      }
    } else if (argument === '--help') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function printHelp() {
  process.stdout.write(`Optimize existing flashcard images and book covers.

Usage:
  npm run images:optimize-existing
  npm run images:optimize-existing -- --apply

Options:
  --apply                 Upload optimized images and update the database.
                          Without this flag, the script is a read-only dry run.
  --only=TYPE             all (default), flashcards, or books.
  --batch-size=NUMBER     Database page size (default: ${DEFAULT_BATCH_SIZE}).
  --concurrency=NUMBER    Simultaneous image jobs (default: ${DEFAULT_CONCURRENCY}).
  --help                  Show this message.
`);
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function createPool() {
  return new Pool({
    host: requiredEnvironment('DB_HOST'),
    port: Number(process.env.DB_PORT || 5432),
    user: requiredEnvironment('DB_USER'),
    password: requiredEnvironment('DB_PASS'),
    database: requiredEnvironment('DB_NAME'),
    max: 4,
    ssl:
      process.env.DB_SSL === 'true'
        ? {
            rejectUnauthorized:
              process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
          }
        : false,
  });
}

function createS3Client(region) {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  return new S3Client({
    region,
    credentials:
      accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined,
  });
}

function sourceIsAllowed(rawUrl, bucket) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'images.pexels.com' || hostname === 'images.unsplash.com') {
    return true;
  }

  return (
    hostname === `${bucket}.s3.amazonaws.com`.toLowerCase() ||
    (hostname.startsWith(`${bucket}.s3.`.toLowerCase()) &&
      hostname.endsWith('.amazonaws.com'))
  );
}

async function readResponseWithLimit(response) {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_SOURCE_BYTES) {
    throw new Error(`source is larger than ${MAX_SOURCE_BYTES} bytes`);
  }
  if (!response.body) throw new Error('source returned an empty response');

  const chunks = [];
  let totalBytes = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error(`source is larger than ${MAX_SOURCE_BYTES} bytes`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, totalBytes);
}

async function downloadImage(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`download returned HTTP ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(
      `download returned ${contentType || 'an unknown content type'}`,
    );
  }
  return readResponseWithLimit(response);
}

async function optimizeImage(source, target) {
  const image = sharp(source, {
    failOn: 'error',
    limitInputPixels: 40_000_000,
  });
  const output = await image
    .rotate()
    .resize({
      width: target.width,
      height: target.height,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 72, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: output.data,
    width: output.info.width,
    height: output.info.height,
  };
}

function publicS3Url(bucket, region, objectKey) {
  return `https://${bucket}.s3.${region}.amazonaws.com/${objectKey}`;
}

async function getRows(pool, target, afterId, limit) {
  const parameters = [limit];
  let cursorSql = '';
  if (afterId) {
    parameters.push(afterId);
    cursorSql = 'AND "id" > $2';
  }

  return pool.query(
    `
      SELECT "id", "${target.column}" AS "sourceUrl"
      FROM "${target.table}"
      WHERE "${target.column}" IS NOT NULL
        AND "${target.column}" <> ''
        AND "${target.column}" NOT LIKE '%/images/logo.png%'
        AND "${target.column}" NOT LIKE '%/optimized-images/%'
        ${cursorSql}
      ORDER BY "id"
      LIMIT $1
    `,
    parameters,
  );
}

async function countRows(pool, target) {
  const result = await pool.query(
    `
      SELECT COUNT(*)::integer AS "count"
      FROM "${target.table}"
      WHERE "${target.column}" IS NOT NULL
        AND "${target.column}" <> ''
        AND "${target.column}" NOT LIKE '%/images/logo.png%'
        AND "${target.column}" NOT LIKE '%/optimized-images/%'
    `,
  );
  return result.rows[0].count;
}

async function updateRow(pool, target, row, optimizedUrl, objectKey) {
  const result = await pool.query(
    `
      UPDATE "${target.table}"
      SET "${target.column}" = $1, "${target.keyColumn}" = $2
      WHERE "id" = $3 AND "${target.column}" = $4
    `,
    [optimizedUrl, objectKey, row.id, row.sourceUrl],
  );
  return result.rowCount === 1;
}

async function mapConcurrent(items, concurrency, operation) {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await operation(items[index]);
      }
    },
  );
  await Promise.all(workers);
}

async function inspectTarget(pool, name, target, options, bucket) {
  const total = await countRows(pool, target);
  let supported = 0;
  let unsupported = 0;
  let afterId;

  while (true) {
    const result = await getRows(pool, target, afterId, options.batchSize);
    if (result.rows.length === 0) break;
    for (const row of result.rows) {
      if (sourceIsAllowed(row.sourceUrl, bucket)) supported += 1;
      else unsupported += 1;
    }
    afterId = result.rows[result.rows.length - 1].id;
  }

  process.stdout.write(
    `${name}: ${total} existing images; ${supported} supported, ${unsupported} skipped (unrecognized or non-HTTPS source).\n`,
  );
  return supported;
}

async function migrateTarget(context, name, target) {
  const { pool, s3, bucket, region, options, optimizedAssets } = context;
  let afterId;
  const stats = { examined: 0, updated: 0, skipped: 0, failed: 0 };

  while (true) {
    const result = await getRows(pool, target, afterId, options.batchSize);
    if (result.rows.length === 0) break;

    await mapConcurrent(result.rows, options.concurrency, async (row) => {
      stats.examined += 1;
      if (!sourceIsAllowed(row.sourceUrl, bucket)) {
        stats.skipped += 1;
        return;
      }

      try {
        const profile = `${name}-${target.width}x${target.height}-q72`;
        const assetId = createHash('sha256')
          .update(`${profile}\0${row.sourceUrl}`)
          .digest('hex');
        const objectKey = `optimized-images/${name}/${assetId}.webp`;
        const cacheKey = `${profile}\0${row.sourceUrl}`;

        if (!optimizedAssets.has(cacheKey)) {
          optimizedAssets.set(
            cacheKey,
            (async () => {
              const source = await downloadImage(row.sourceUrl);
              const optimized = await optimizeImage(source, target);
              await s3.send(
                new PutObjectCommand({
                  Bucket: bucket,
                  Key: objectKey,
                  Body: optimized.buffer,
                  ContentType: 'image/webp',
                  CacheControl: 'public, max-age=31536000, immutable',
                }),
              );
              return {
                url: publicS3Url(bucket, region, objectKey),
                oldBytes: source.length,
                newBytes: optimized.buffer.length,
              };
            })(),
          );
        }

        const asset = await optimizedAssets.get(cacheKey);
        const changed = await updateRow(
          pool,
          target,
          row,
          asset.url,
          objectKey,
        );
        if (changed) {
          stats.updated += 1;
        } else {
          stats.skipped += 1;
        }
      } catch (error) {
        stats.failed += 1;
        process.stderr.write(
          `${name} ${row.id} failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
        );
      }
    });

    afterId = result.rows[result.rows.length - 1].id;
    process.stdout.write(
      `${name}: ${stats.examined} processed, ${stats.updated} updated, ${stats.skipped} skipped, ${stats.failed} failed.\n`,
    );
  }

  return stats;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const pool = createPool();
  const targetEntries = Object.entries(TARGETS).filter(
    ([name]) => options.only === 'all' || options.only === name,
  );
  let s3;

  try {
    if (!options.apply) {
      const bucket = process.env.AWS_S3_BUCKET?.trim() || 'flenvn';
      let supported = 0;
      for (const [name, target] of targetEntries) {
        supported += await inspectTarget(pool, name, target, options, bucket);
      }
      process.stdout.write(
        `Dry run complete; ${supported} images can be optimized. No files or database records were changed.\n`,
      );
      return;
    }

    const bucket = requiredEnvironment('AWS_S3_BUCKET');
    const region =
      process.env.AWS_S3_REGION?.trim() || requiredEnvironment('AWS_REGION');
    s3 = createS3Client(region);
    const context = {
      pool,
      s3,
      bucket,
      region,
      options,
      optimizedAssets: new Map(),
    };

    let failures = 0;
    for (const [name, target] of targetEntries) {
      const stats = await migrateTarget(context, name, target);
      failures += stats.failed;
    }

    process.stdout.write(
      `Image optimization complete. Original objects were retained.${failures ? ` ${failures} records failed and can be retried.` : ''}\n`,
    );
    if (failures > 0) process.exitCode = 1;
  } finally {
    s3?.destroy();
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(
    `Image optimization failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  );
  process.exitCode = 1;
});
