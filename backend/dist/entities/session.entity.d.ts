import { User } from "./user.entity";
export declare class Session {
    id: string;
    userId: string;
    user: User;
    jti: string;
    loginAt: Date;
    logoutAt: Date | null;
    expiresAt: Date;
}
