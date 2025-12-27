import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSocialTables1702922000000 implements MigrationInterface {
  name = 'CreateSocialTables1702922000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create posts table
    await queryRunner.query(`
      CREATE TABLE "posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "content" text NOT NULL,
        "visibility" character varying(20) NOT NULL DEFAULT 'public',
        "likes_count" integer NOT NULL DEFAULT 0,
        "comments_count" integer NOT NULL DEFAULT 0,
        "shares_count" integer NOT NULL DEFAULT 0,
        "is_edited" boolean NOT NULL DEFAULT false,
        "original_post_id" uuid,
        CONSTRAINT "PK_posts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_posts_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_posts_original" FOREIGN KEY ("original_post_id")
          REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_posts_user_id" ON "posts" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_posts_original_post_id" ON "posts" ("original_post_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_posts_created_at" ON "posts" ("created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_posts_visibility" ON "posts" ("visibility")`);

    // Create post_images table
    await queryRunner.query(`
      CREATE TABLE "post_images" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "url" character varying(500) NOT NULL,
        "thumbnail_url" character varying(500),
        "width" integer,
        "height" integer,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_images" PRIMARY KEY ("id"),
        CONSTRAINT "FK_post_images_post" FOREIGN KEY ("post_id")
          REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_post_images_post_id" ON "post_images" ("post_id")`);

    // Create post_likes table
    await queryRunner.query(`
      CREATE TABLE "post_likes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "post_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_post_likes_user_post" UNIQUE ("user_id", "post_id"),
        CONSTRAINT "PK_post_likes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_post_likes_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_post_likes_post" FOREIGN KEY ("post_id")
          REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_post_likes_user_id" ON "post_likes" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_post_likes_post_id" ON "post_likes" ("post_id")`);

    // Create hashtags table
    await queryRunner.query(`
      CREATE TABLE "hashtags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "posts_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_hashtags_name" UNIQUE ("name"),
        CONSTRAINT "PK_hashtags" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_hashtags_name" ON "hashtags" ("name")`);

    // Create post_hashtags table (composite PK)
    await queryRunner.query(`
      CREATE TABLE "post_hashtags" (
        "post_id" uuid NOT NULL,
        "hashtag_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_hashtags" PRIMARY KEY ("post_id", "hashtag_id"),
        CONSTRAINT "FK_post_hashtags_post" FOREIGN KEY ("post_id")
          REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_post_hashtags_hashtag" FOREIGN KEY ("hashtag_id")
          REFERENCES "hashtags"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_post_hashtags_post_id" ON "post_hashtags" ("post_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_post_hashtags_hashtag_id" ON "post_hashtags" ("hashtag_id")`);

    // Create post_mentions table
    await queryRunner.query(`
      CREATE TABLE "post_mentions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "mentioned_user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_post_mentions_post_user" UNIQUE ("post_id", "mentioned_user_id"),
        CONSTRAINT "PK_post_mentions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_post_mentions_post" FOREIGN KEY ("post_id")
          REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_post_mentions_user" FOREIGN KEY ("mentioned_user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_post_mentions_post_id" ON "post_mentions" ("post_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_post_mentions_user_id" ON "post_mentions" ("mentioned_user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "post_mentions"`);
    await queryRunner.query(`DROP TABLE "post_hashtags"`);
    await queryRunner.query(`DROP TABLE "hashtags"`);
    await queryRunner.query(`DROP TABLE "post_likes"`);
    await queryRunner.query(`DROP TABLE "post_images"`);
    await queryRunner.query(`DROP TABLE "posts"`);
  }
}
