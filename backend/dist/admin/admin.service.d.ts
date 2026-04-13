import { ConfigService } from "@nestjs/config";
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
export declare class AdminService {
    private readonly config;
    private readonly users;
    private readonly sessions;
    constructor(config: ConfigService, users: Repository<User>, sessions: Repository<Session>);
    listWalletUsers(): Promise<WalletUserRow[]>;
    fetchStakingActivitiesFromSubgraph(first: number, skip: number): Promise<StakingActivityRow[]>;
}
