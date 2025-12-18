import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1702918800000 implements MigrationInterface {
  name = 'InitialSchema1702918800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "email" character varying(255) NOT NULL,
        "phone" character varying(20),
        "password_hash" character varying(255) NOT NULL,
        "is_email_verified" boolean NOT NULL DEFAULT false,
        "is_phone_verified" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_login_at" TIMESTAMP,
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_phone" UNIQUE ("phone"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_phone" ON "users" ("phone")`);

    // Create user_profiles table
    await queryRunner.query(`
      CREATE TABLE "user_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "username" character varying(50) NOT NULL,
        "full_name" character varying(100),
        "bio" text,
        "avatar_url" character varying(500),
        "cover_url" character varying(500),
        "location" character varying(100),
        "website" character varying(255),
        "date_of_birth" date,
        "gender" character varying(20),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_profiles_user_id" UNIQUE ("user_id"),
        CONSTRAINT "UQ_user_profiles_username" UNIQUE ("username"),
        CONSTRAINT "PK_user_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_profiles_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_user_profiles_username" ON "user_profiles" ("username")`);

    // Create refresh_tokens table
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying(255) NOT NULL,
        "device_info" character varying(255),
        "ip_address" character varying(45),
        "expires_at" TIMESTAMP NOT NULL,
        "revoked_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")`);

    // Create otp_codes table
    await queryRunner.query(`
      CREATE TABLE "otp_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "code" character varying(6) NOT NULL,
        "type" character varying(20) NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "used_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_otp_codes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_otp_codes_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_otp_codes_user_id" ON "otp_codes" ("user_id")`);

    // Create user_follows table
    await queryRunner.query(`
      CREATE TABLE "user_follows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "follower_id" uuid NOT NULL,
        "following_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_follows" UNIQUE ("follower_id", "following_id"),
        CONSTRAINT "PK_user_follows" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_follows_follower" FOREIGN KEY ("follower_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_user_follows_following" FOREIGN KEY ("following_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_user_follows_follower_id" ON "user_follows" ("follower_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_follows_following_id" ON "user_follows" ("following_id")`);

    // Create user_blocks table
    await queryRunner.query(`
      CREATE TABLE "user_blocks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "blocker_id" uuid NOT NULL,
        "blocked_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_blocks" UNIQUE ("blocker_id", "blocked_id"),
        CONSTRAINT "PK_user_blocks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_blocks_blocker" FOREIGN KEY ("blocker_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_user_blocks_blocked" FOREIGN KEY ("blocked_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_user_blocks_blocker_id" ON "user_blocks" ("blocker_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_blocks_blocked_id" ON "user_blocks" ("blocked_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_blocks"`);
    await queryRunner.query(`DROP TABLE "user_follows"`);
    await queryRunner.query(`DROP TABLE "otp_codes"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "user_profiles"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
