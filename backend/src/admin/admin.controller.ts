import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { AdminService } from "./admin.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("wallet-users")
  walletUsers() {
    return this.admin.listWalletUsers();
  }

  /** Proxies The Graph — only admins receive this data (JWT + ADMIN_ADDRESSES). */
  @Get("staking-activities")
  stakingActivities(
    @Query("first", new DefaultValuePipe(50), ParseIntPipe) first: number,
    @Query("skip", new DefaultValuePipe(0), ParseIntPipe) skip: number,
  ) {
    return this.admin.fetchStakingActivitiesFromSubgraph(first, skip);
  }
}
