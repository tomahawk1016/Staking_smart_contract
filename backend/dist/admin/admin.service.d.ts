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
export declare class AdminService {
    private readonly users;
    private readonly sessions;
    constructor(users: Repository<User>, sessions: Repository<Session>);
    listWalletUsers(): Promise<WalletUserRow[]>;
}
