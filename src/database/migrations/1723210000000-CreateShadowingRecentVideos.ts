import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShadowingRecentVideos1723210000000 implements MigrationInterface {
  name = 'CreateShadowingRecentVideos1723210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shadowing_recent_videos" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "videoId" varchar(11) NOT NULL,
        "url" varchar(500) NOT NULL,
        "title" varchar(300) NOT NULL,
        "language" varchar(10) NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shadowing_recent_videos" PRIMARY KEY ("id"),
        CONSTRAINT "FK_shadowing_recent_videos_userId_users_id"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shadowing_recent_videos_userId_videoId" ON "shadowing_recent_videos" ("userId", "videoId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_shadowing_recent_videos_userId_updatedAt" ON "shadowing_recent_videos" ("userId", "updatedAt" DESC)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "shadowing_recent_videos"');
  }
}
