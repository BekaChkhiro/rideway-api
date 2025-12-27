import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMarketplaceTables1702920000000 implements MigrationInterface {
  name = 'CreateMarketplaceTables1702920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create listing_categories table
    await queryRunner.query(`
      CREATE TABLE "listing_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "icon" character varying(50),
        "parent_id" uuid,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_listing_categories_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_listing_categories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_listing_categories_parent" FOREIGN KEY ("parent_id")
          REFERENCES "listing_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_listing_categories_slug" ON "listing_categories" ("slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_listing_categories_parent_id" ON "listing_categories" ("parent_id")`,
    );

    // Create listings table
    await queryRunner.query(`
      CREATE TABLE "listings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "category_id" uuid,
        "title" character varying(200) NOT NULL,
        "description" text,
        "price" decimal(12,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'GEL',
        "condition" character varying(20),
        "location" character varying(200),
        "latitude" decimal(10,8),
        "longitude" decimal(11,8),
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "views_count" integer NOT NULL DEFAULT 0,
        "is_featured" boolean NOT NULL DEFAULT false,
        "expires_at" TIMESTAMP,
        CONSTRAINT "PK_listings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_listings_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_listings_category" FOREIGN KEY ("category_id")
          REFERENCES "listing_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_listings_user_id" ON "listings" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_listings_category_id" ON "listings" ("category_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_listings_status" ON "listings" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_listings_created_at" ON "listings" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_listings_price" ON "listings" ("price")`,
    );

    // Create listing_images table
    await queryRunner.query(`
      CREATE TABLE "listing_images" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "listing_id" uuid NOT NULL,
        "url" character varying(500) NOT NULL,
        "thumbnail_url" character varying(500),
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_listing_images" PRIMARY KEY ("id"),
        CONSTRAINT "FK_listing_images_listing" FOREIGN KEY ("listing_id")
          REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_listing_images_listing_id" ON "listing_images" ("listing_id")`,
    );

    // Create listing_favorites table
    await queryRunner.query(`
      CREATE TABLE "listing_favorites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "listing_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_listing_favorites" UNIQUE ("user_id", "listing_id"),
        CONSTRAINT "PK_listing_favorites" PRIMARY KEY ("id"),
        CONSTRAINT "FK_listing_favorites_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_listing_favorites_listing" FOREIGN KEY ("listing_id")
          REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_listing_favorites_user_id" ON "listing_favorites" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_listing_favorites_listing_id" ON "listing_favorites" ("listing_id")`,
    );

    // Seed initial categories
    await queryRunner.query(`
      INSERT INTO "listing_categories" ("name", "slug", "icon", "sort_order") VALUES
      ('Sport Bikes', 'sport-bikes', 'motorcycle-sport', 1),
      ('Cruisers', 'cruisers', 'motorcycle-cruiser', 2),
      ('Touring', 'touring', 'motorcycle-touring', 3),
      ('Adventure', 'adventure', 'motorcycle-adventure', 4),
      ('Naked', 'naked', 'motorcycle-naked', 5),
      ('Scooters', 'scooters', 'scooter', 6),
      ('Off-Road', 'off-road', 'motorcycle-offroad', 7),
      ('Classic', 'classic', 'motorcycle-classic', 8),
      ('Electric', 'electric', 'motorcycle-electric', 9),
      ('Other', 'other', 'motorcycle-other', 10)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "listing_favorites"`);
    await queryRunner.query(`DROP TABLE "listing_images"`);
    await queryRunner.query(`DROP TABLE "listings"`);
    await queryRunner.query(`DROP TABLE "listing_categories"`);
  }
}
