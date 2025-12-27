import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommentsTables1702924000000 implements MigrationInterface {
  name = 'CreateCommentsTables1702924000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create comments table
    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "post_id" uuid NOT NULL,
        "parent_id" uuid,
        "content" text NOT NULL,
        "likes_count" integer NOT NULL DEFAULT 0,
        "replies_count" integer NOT NULL DEFAULT 0,
        "is_edited" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_comments_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_comments_post" FOREIGN KEY ("post_id")
          REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_comments_parent" FOREIGN KEY ("parent_id")
          REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_comments_user_id" ON "comments" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_comments_post_id" ON "comments" ("post_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_comments_parent_id" ON "comments" ("parent_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_comments_created_at" ON "comments" ("created_at" DESC)`);

    // Create comment_likes table
    await queryRunner.query(`
      CREATE TABLE "comment_likes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "comment_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_comment_likes_user_comment" UNIQUE ("user_id", "comment_id"),
        CONSTRAINT "PK_comment_likes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_comment_likes_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_comment_likes_comment" FOREIGN KEY ("comment_id")
          REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_comment_likes_user_id" ON "comment_likes" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_comment_likes_comment_id" ON "comment_likes" ("comment_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "comment_likes"`);
    await queryRunner.query(`DROP TABLE "comments"`);
  }
}
