import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        ssl: configService.get('database.ssl'),
        poolSize: configService.get<number>('database.poolSize'),
        synchronize: false,
        logging: configService.get<boolean>('database.logging'),
        autoLoadEntities: true,
        // Don't use explicit entities path when autoLoadEntities is true
        // entities: [__dirname + '/entities/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
      }),
    }),
  ],
})
export class DatabaseModule {}
