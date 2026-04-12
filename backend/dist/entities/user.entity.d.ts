import { Session } from "./session.entity";
export declare class User {
    id: string;
    walletAddress: string;
    registeredAt: Date;
    updatedAt: Date;
    sessions: Session[];
}
