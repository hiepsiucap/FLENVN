require('dotenv').config();

const { SendMessageCommand, SQSClient } = require('@aws-sdk/client-sqs');
const { Pool } = require('pg');

function parseArgs(argv) {
  const options = {
    dryRun: false,
    batchSize: 100,
    userId: undefined,
  };

  for (const argument of argv) {
    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (argument.startsWith('--batch-size=')) {
      options.batchSize = Number(argument.slice('--batch-size='.length));
      continue;
    }
    if (argument.startsWith('--user-id=')) {
      options.userId = argument.slice('--user-id='.length);
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (
    !Number.isInteger(options.batchSize) ||
    options.batchSize < 1 ||
    options.batchSize > 1000
  ) {
    throw new Error('--batch-size must be an integer from 1 through 1000');
  }

  if (
    options.userId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      options.userId,
    )
  ) {
    throw new Error('--user-id must be a valid UUID');
  }

  return options;
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function createPool() {
  const useSsl = process.env.DB_SSL === 'true';
  return new Pool({
    host: requiredEnvironment('DB_HOST'),
    port: Number(process.env.DB_PORT || 5432),
    user: requiredEnvironment('DB_USER'),
    password: requiredEnvironment('DB_PASS'),
    database: requiredEnvironment('DB_NAME'),
    max: 2,
    ssl: useSsl
      ? {
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        }
      : false,
  });
}

function eligibleWhere(userId, parameterOffset = 0) {
  const values = [];
  let sql = `
    f."labelingStatus" = 'completed'
    AND NOT EXISTS (
      SELECT 1
      FROM "flashcard_labels" fl
      WHERE fl."flashcardId" = f."id"
        AND fl."source" = 'gemini'
    )`;

  if (userId) {
    values.push(userId);
    sql += ` AND f."userId" = $${parameterOffset + values.length}`;
  }

  return { sql, values };
}

async function countEligible(pool, userId) {
  const where = eligibleWhere(userId);
  const result = await pool.query(
    `SELECT COUNT(*)::integer AS count FROM "flashcards" f WHERE ${where.sql}`,
    where.values,
  );
  return result.rows[0].count;
}

async function claimBatch(pool, batchSize, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const where = eligibleWhere(userId, 1);
    const result = await client.query(
      `
        WITH candidates AS (
          SELECT f."id"
          FROM "flashcards" f
          WHERE ${where.sql}
          ORDER BY f."createdAt", f."id"
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "flashcards" f
        SET
          "labelingStatus" = 'pending',
          "labelingVersion" = f."labelingVersion" + 1,
          "labelingAttempts" = 0,
          "labelingQueuedAt" = NULL,
          "labeledAt" = NULL
        FROM candidates
        WHERE f."id" = candidates."id"
        RETURNING
          f."id" AS "flashcardId",
          f."userId" AS "userId",
          f."labelingVersion" AS "labelingVersion"
      `,
      [batchSize, ...where.values],
    );
    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function markPublished(pool, job) {
  await pool.query(
    `
      UPDATE "flashcards"
      SET "labelingQueuedAt" = NOW()
      WHERE "id" = $1 AND "labelingVersion" = $2
    `,
    [job.flashcardId, job.labelingVersion],
  );
}

async function publish(sqs, queueUrl, job) {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        type: 'classify-flashcard-labels',
        ...job,
      }),
    }),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pool = createPool();
  let sqs;

  try {
    const eligible = await countEligible(pool, options.userId);
    process.stdout.write(
      `Eligible flashcards: ${eligible}${options.userId ? ` for user ${options.userId}` : ''}\n`,
    );

    if (options.dryRun || eligible === 0) {
      process.stdout.write(
        options.dryRun
          ? 'Dry run complete; no records changed.\n'
          : 'Nothing to queue.\n',
      );
      return;
    }

    const queueUrl = requiredEnvironment('AUTO_LABELING_QUEUE_URL');
    sqs = new SQSClient({
      region: requiredEnvironment('AWS_REGION'),
    });
    let claimed = 0;
    let published = 0;
    let publishFailed = 0;

    while (true) {
      const jobs = await claimBatch(pool, options.batchSize, options.userId);
      if (jobs.length === 0) break;
      claimed += jobs.length;

      for (const job of jobs) {
        try {
          await publish(sqs, queueUrl, job);
          await markPublished(pool, job);
          published += 1;
        } catch (error) {
          publishFailed += 1;
          process.stderr.write(
            `Could not publish ${job.flashcardId}: ${error instanceof Error ? error.message : 'unknown error'}\n`,
          );
        }
      }

      process.stdout.write(
        `Progress: ${claimed}/${eligible} claimed, ${published} published, ${publishFailed} pending recovery\n`,
      );
    }

    process.stdout.write(
      `Backfill complete: ${published} published, ${publishFailed} left pending for recovery.\n`,
    );
    if (publishFailed > 0) process.exitCode = 1;
  } finally {
    sqs?.destroy();
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(
    `Label backfill failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  );
  process.exitCode = 1;
});
