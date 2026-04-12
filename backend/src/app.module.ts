import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>("DATABASE_URL");
        if (!url) {
          throw new Error("DATABASE_URL is required");
        }
        const sync =
          String(config.get("TYPEORM_SYNC") ?? "true").toLowerCase() === "true";
        return {
          type: "postgres" as const,
          url,
          ssl: url.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
          autoLoadEntities: true,
          synchronize: sync,
          logging: false,
        };
      },
    }),
    AuthModule,
    AdminModule,
  ],
})
export class AppModule {}
