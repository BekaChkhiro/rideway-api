import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStoriesTables1702923000000 implements MigrationInterface {
  name = 'CreateStoriesTables1702923000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create stories table
    await queryRunner.query(`
      CREATE TABLE "stories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "media_url" character varying(500) NOT NULL,
        "thumbnail_url" character varying(500),
        "media_type" character varying(10) NOT NULL DEFAULT 'image',
        "caption" character varying(500),
        "views_count" integer NOT NULL DEFAULT 0,
        "expires_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stories_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_stories_user_id" ON "stories" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_stories_expires_at" ON "stories" ("expires_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_stories_created_at" ON "stories" ("created_at" DESC)`);

    // Create story_views table
    await queryRunner.query(`
      CREATE TABLE "story_views" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "story_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "viewed_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_story_views_story_user" UNIQUE ("story_id", "user_id"),
        CONSTRAINT "PK_story_views" PRIMARY KEY ("id"),
        CONSTRAINT "FK_story_views_story" FOREIGN KEY ("story_id")
          REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_story_views_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_story_views_story_id" ON "story_views" ("story_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_story_views_user_id" ON "story_views" ("user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "story_views"`);
    await queryRunner.query(`DROP TABLE "stories"`);
  }
}
