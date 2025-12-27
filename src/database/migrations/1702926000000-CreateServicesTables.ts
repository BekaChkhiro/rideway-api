import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateServicesTables1702926000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Service Categories table
    await queryRunner.createTable(
      new Table({
        name: 'service_categories',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'slug',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'icon',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'sort_order',
            type: 'int',
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Services table
    await queryRunner.createTable(
      new Table({
        name: 'services',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'category_id',
            type: 'uuid',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '200',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'address',
            type: 'varchar',
            length: '300',
            isNullable: true,
          },
          {
            name: 'city',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'latitude',
            type: 'decimal',
            precision: 10,
            scale: 8,
            isNullable: true,
          },
          {
            name: 'longitude',
            type: 'decimal',
            precision: 11,
            scale: 8,
            isNullable: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'website',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'working_hours',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'rating_avg',
            type: 'decimal',
            precision: 2,
            scale: 1,
            default: 0,
          },
          {
            name: 'reviews_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'is_verified',
            type: 'boolean',
            default: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive', 'pending'],
            default: "'active'",
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['category_id'],
            referencedTableName: 'service_categories',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Service Images table
    await queryRunner.createTable(
      new Table({
        name: 'service_images',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'service_id',
            type: 'uuid',
          },
          {
            name: 'url',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'is_primary',
            type: 'boolean',
            default: false,
          },
          {
            name: 'sort_order',
            type: 'int',
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['service_id'],
            referencedTableName: 'services',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Service Reviews table
    await queryRunner.createTable(
      new Table({
        name: 'service_reviews',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'service_id',
            type: 'uuid',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'rating',
            type: 'int',
          },
          {
            name: 'comment',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['service_id'],
            referencedTableName: 'services',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'services',
      new TableIndex({
        name: 'IDX_services_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'services',
      new TableIndex({
        name: 'IDX_services_category_id',
        columnNames: ['category_id'],
      }),
    );

    await queryRunner.createIndex(
      'services',
      new TableIndex({
        name: 'IDX_services_city',
        columnNames: ['city'],
      }),
    );

    await queryRunner.createIndex(
      'services',
      new TableIndex({
        name: 'IDX_services_rating',
        columnNames: ['rating_avg'],
      }),
    );

    await queryRunner.createIndex(
      'services',
      new TableIndex({
        name: 'IDX_services_location',
        columnNames: ['latitude', 'longitude'],
      }),
    );

    await queryRunner.createIndex(
      'service_images',
      new TableIndex({
        name: 'IDX_service_images_service_id',
        columnNames: ['service_id'],
      }),
    );

    await queryRunner.createIndex(
      'service_reviews',
      new TableIndex({
        name: 'IDX_service_reviews_service_id',
        columnNames: ['service_id'],
      }),
    );

    await queryRunner.createIndex(
      'service_reviews',
      new TableIndex({
        name: 'IDX_service_reviews_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'service_reviews',
      new TableIndex({
        name: 'IDX_service_reviews_unique',
        columnNames: ['service_id', 'user_id'],
        isUnique: true,
      }),
    );

    // Add check constraint for rating
    await queryRunner.query(`
      ALTER TABLE service_reviews
      ADD CONSTRAINT chk_rating_range
      CHECK (rating >= 1 AND rating <= 5)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE service_reviews
      DROP CONSTRAINT IF EXISTS chk_rating_range
    `);
    await queryRunner.dropTable('service_reviews');
    await queryRunner.dropTable('service_images');
    await queryRunner.dropTable('services');
    await queryRunner.dropTable('service_categories');
  }
}
