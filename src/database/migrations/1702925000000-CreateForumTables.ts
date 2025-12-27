import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateForumTables1702925000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Forum Categories table
    await queryRunner.createTable(
      new Table({
        name: 'forum_categories',
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
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'icon',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'color',
            type: 'varchar',
            length: '7',
            isNullable: true,
          },
          {
            name: 'sort_order',
            type: 'int',
            default: 0,
          },
          {
            name: 'threads_count',
            type: 'int',
            default: 0,
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
      }),
      true,
    );

    // Forum Threads table
    await queryRunner.createTable(
      new Table({
        name: 'forum_threads',
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
            name: 'title',
            type: 'varchar',
            length: '200',
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'is_pinned',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_locked',
            type: 'boolean',
            default: false,
          },
          {
            name: 'views_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'replies_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'likes_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'last_reply_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'last_reply_user_id',
            type: 'uuid',
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
            referencedTableName: 'forum_categories',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['last_reply_user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    // Thread Replies table
    await queryRunner.createTable(
      new Table({
        name: 'thread_replies',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'thread_id',
            type: 'uuid',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'parent_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'likes_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'is_edited',
            type: 'boolean',
            default: false,
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
            columnNames: ['thread_id'],
            referencedTableName: 'forum_threads',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['parent_id'],
            referencedTableName: 'thread_replies',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Thread Likes table
    await queryRunner.createTable(
      new Table({
        name: 'thread_likes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'thread_id',
            type: 'uuid',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['thread_id'],
            referencedTableName: 'forum_threads',
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

    // Thread Subscriptions table
    await queryRunner.createTable(
      new Table({
        name: 'thread_subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'thread_id',
            type: 'uuid',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['thread_id'],
            referencedTableName: 'forum_threads',
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

    // Reply Likes table
    await queryRunner.createTable(
      new Table({
        name: 'reply_likes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'reply_id',
            type: 'uuid',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['reply_id'],
            referencedTableName: 'thread_replies',
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
      'forum_threads',
      new Index({
        name: 'IDX_forum_threads_category_id',
        columnNames: ['category_id'],
      }),
    );

    await queryRunner.createIndex(
      'forum_threads',
      new Index({
        name: 'IDX_forum_threads_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'forum_threads',
      new Index({
        name: 'IDX_forum_threads_is_pinned',
        columnNames: ['is_pinned'],
      }),
    );

    await queryRunner.createIndex(
      'thread_replies',
      new Index({
        name: 'IDX_thread_replies_thread_id',
        columnNames: ['thread_id'],
      }),
    );

    await queryRunner.createIndex(
      'thread_replies',
      new Index({
        name: 'IDX_thread_replies_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'thread_likes',
      new Index({
        name: 'IDX_thread_likes_unique',
        columnNames: ['thread_id', 'user_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'thread_subscriptions',
      new Index({
        name: 'IDX_thread_subscriptions_unique',
        columnNames: ['thread_id', 'user_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'reply_likes',
      new Index({
        name: 'IDX_reply_likes_unique',
        columnNames: ['reply_id', 'user_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('reply_likes');
    await queryRunner.dropTable('thread_subscriptions');
    await queryRunner.dropTable('thread_likes');
    await queryRunner.dropTable('thread_replies');
    await queryRunner.dropTable('forum_threads');
    await queryRunner.dropTable('forum_categories');
  }
}
