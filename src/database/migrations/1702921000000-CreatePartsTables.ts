import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePartsTables1702921000000 implements MigrationInterface {
  name = 'CreatePartsTables1702921000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create parts_categories table
    await queryRunner.query(`
      CREATE TABLE "parts_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "icon" character varying(50),
        "parent_id" uuid,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_parts_categories_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_parts_categories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_parts_categories_parent" FOREIGN KEY ("parent_id")
          REFERENCES "parts_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_parts_categories_slug" ON "parts_categories" ("slug")`);
    await queryRunner.query(`CREATE INDEX "IDX_parts_categories_parent_id" ON "parts_categories" ("parent_id")`);

    // Create parts table
    await queryRunner.query(`
      CREATE TABLE "parts" (
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
        "brand" character varying(100),
        "part_number" character varying(100),
        "compatibility" jsonb,
        "location" character varying(200),
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "views_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_parts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_parts_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_parts_category" FOREIGN KEY ("category_id")
          REFERENCES "parts_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_parts_user_id" ON "parts" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_parts_category_id" ON "parts" ("category_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_parts_status" ON "parts" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_parts_created_at" ON "parts" ("created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_parts_price" ON "parts" ("price")`);
    await queryRunner.query(`CREATE INDEX "IDX_parts_brand" ON "parts" ("brand")`);
    // GIN index for JSON array containment search
    await queryRunner.query(`CREATE INDEX "IDX_parts_compatibility" ON "parts" USING GIN ("compatibility")`);

    // Create part_images table
    await queryRunner.query(`
      CREATE TABLE "part_images" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "part_id" uuid NOT NULL,
        "url" character varying(500) NOT NULL,
        "thumbnail_url" character varying(500),
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_part_images" PRIMARY KEY ("id"),
        CONSTRAINT "FK_part_images_part" FOREIGN KEY ("part_id")
          REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_part_images_part_id" ON "part_images" ("part_id")`);

    // Seed initial parts categories
    await queryRunner.query(`
      INSERT INTO "parts_categories" ("name", "slug", "icon", "sort_order") VALUES
      ('Engine', 'engine', 'engine-icon', 1),
      ('Brakes', 'brakes', 'brakes-icon', 2),
      ('Suspension', 'suspension', 'suspension-icon', 3),
      ('Exhaust', 'exhaust', 'exhaust-icon', 4),
      ('Electrical', 'electrical', 'electrical-icon', 5),
      ('Body & Frame', 'body-frame', 'body-icon', 6),
      ('Wheels & Tires', 'wheels-tires', 'wheel-icon', 7),
      ('Transmission', 'transmission', 'transmission-icon', 8),
      ('Fuel System', 'fuel-system', 'fuel-icon', 9),
      ('Lighting', 'lighting', 'lighting-icon', 10),
      ('Accessories', 'accessories', 'accessories-icon', 11),
      ('Other', 'other', 'other-icon', 12)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "part_images"`);
    await queryRunner.query(`DROP TABLE "parts"`);
    await queryRunner.query(`DROP TABLE "parts_categories"`);
  }
}
