import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Session } from "../entities/session.entity";
import { User } from "../entities/user.entity";

export type WalletUserRow = {
  walletAddress: string;
  registeredAt: string;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
  state: "logged_in" | "logged_out";
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
  ) {}

  async listWalletUsers(): Promise<WalletUserRow[]> {
    const list = await this.users.find({
      order: { registeredAt: "DESC" },
      relations: ["sessions"],
    });
    const now = Date.now();
    return list.map((u) => {
      const sessions = u.sessions ?? [];
      const active = sessions.some((s) => {
        if (s.logoutAt) return false;
        return new Date(s.expiresAt).getTime() > now;
      });
      const lastLoginAt =
        sessions.length > 0
          ? new Date(
              Math.max(...sessions.map((s) => new Date(s.loginAt).getTime())),
            ).toISOString()
          : null;
      const withLogout = sessions
        .map((s) => s.logoutAt)
        .filter((d): d is Date => d != null);
      const lastLogoutAt =
        withLogout.length > 0
          ? new Date(
              Math.max(...withLogout.map((d) => new Date(d).getTime())),
            ).toISOString()
          : null;
      return {
        walletAddress: u.walletAddress,
        registeredAt: u.registeredAt.toISOString(),
        lastLoginAt,
        lastLogoutAt,
        state: active ? ("logged_in" as const) : ("logged_out" as const),
      };
    });
  }
}
