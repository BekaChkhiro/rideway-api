import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRole1703000000000 implements MigrationInterface {
  name = 'AddUserRole1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the enum type
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('user', 'moderator', 'admin')
    `);

    // Add the role column with default value 'user'
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "role" "user_role_enum" NOT NULL DEFAULT 'user'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the role column
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "role"
    `);

    // Drop the enum type
    await queryRunner.query(`
      DROP TYPE "user_role_enum"
    `);
  }
}
