import { AdminService } from "./admin.service";
export declare class AdminController {
    private readonly admin;
    constructor(admin: AdminService);
    walletUsers(): Promise<import("./admin.service").WalletUserRow[]>;
}
