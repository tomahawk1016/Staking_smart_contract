import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Session } from "../entities/session.entity";
import { User } from "../entities/user.entity";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [TypeOrmModule.forFeature([User, Session])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
