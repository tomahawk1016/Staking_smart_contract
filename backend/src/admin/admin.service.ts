import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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

/** Subgraph row (The Graph returns uint256 / Bytes as strings). */
export type StakingActivityRow = {
  id: string;
  activityType: string;
  user: string;
  planId: string | null;
  positionIndex: string | null;
  amount: string | null;
  principal: string | null;
  rewardPaid: string | null;
  early: boolean | null;
  penaltyOnRewards: string | null;
  lockDuration: string | null;
  aprBps: string | null;
  planActive: boolean | null;
  penaltyBps: string | null;
  blockNumber: string;
  timestamp: string;
  txHash: string;
  logIndex: string;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly config: ConfigService,
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

  async fetchStakingActivitiesFromSubgraph(
    first: number,
    skip: number,
  ): Promise<StakingActivityRow[]> {
    const url = this.config.get<string>("SUBGRAPH_QUERY_URL")?.trim();
    if (!url) {
      throw new ServiceUnavailableException(
        "SUBGRAPH_QUERY_URL is not set. Deploy the subgraph and add its GraphQL HTTP endpoint.",
      );
    }
    const firstClamped = Math.min(Math.max(Number(first) || 50, 1), 200);
    const skipClamped = Math.max(Number(skip) || 0, 0);
    const apiKey = this.config.get<string>("SUBGRAPH_API_KEY")?.trim();

    const query = `query Activities($first: Int!, $skip: Int!) {
      stakingActivities(
        first: $first
        skip: $skip
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        activityType
        user
        planId
        positionIndex
        amount
        principal
        rewardPaid
        early
        penaltyOnRewards
        lockDuration
        aprBps
        planActive
        penaltyBps
        blockNumber
        timestamp
        txHash
        logIndex
      }
    }`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query,
          variables: { first: firstClamped, skip: skipClamped },
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      throw new BadGatewayException(`Subgraph request failed: ${msg}`);
    }

    const body = (await res.json()) as {
      data?: { stakingActivities: StakingActivityRow[] };
      errors?: { message: string }[];
    };

    if (!res.ok) {
      throw new BadGatewayException(
        `Subgraph HTTP ${res.status}: ${JSON.stringify(body).slice(0, 500)}`,
      );
    }
    if (body.errors?.length) {
      throw new BadGatewayException(
        body.errors.map((x) => x.message).join("; ") || "Subgraph GraphQL error",
      );
    }
    const list = body.data?.stakingActivities;
    if (!Array.isArray(list)) {
      throw new BadGatewayException("Unexpected subgraph response shape.");
    }
    return list;
  }
}
