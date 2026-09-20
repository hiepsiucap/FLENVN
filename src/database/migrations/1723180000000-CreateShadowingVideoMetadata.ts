import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShadowingVideoMetadata1723180000000 implements MigrationInterface {
  name = 'CreateShadowingVideoMetadata1723180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shadowing_video_metadata" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "videoId" varchar(11) NOT NULL,
        "title" varchar(300) NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shadowing_video_metadata_videoId" ON "shadowing_video_metadata" ("videoId")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "shadowing_video_metadata"');
  }
}
