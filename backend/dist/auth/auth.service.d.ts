import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Repository } from "typeorm";
import { LoginNonce } from "../entities/login-nonce.entity";
import { Session } from "../entities/session.entity";
import { User } from "../entities/user.entity";
export declare class AuthService {
    private readonly users;
    private readonly sessions;
    private readonly nonces;
    private readonly jwt;
    private readonly config;
    constructor(users: Repository<User>, sessions: Repository<Session>, nonces: Repository<LoginNonce>, jwt: JwtService, config: ConfigService);
    private adminSet;
    createChallenge(walletAddress: string, chainId?: number): Promise<{
        message: string;
    }>;
    verifySignature(message: string, signature: `0x${string}`): Promise<{
        accessToken: string;
        walletAddress: string;
        isAdmin: boolean;
    }>;
    private computeExpiry;
    logout(jti: string): Promise<void>;
    validateSession(jti: string, userId: string): Promise<{
        userId: string;
        wallet: string;
        jti: string;
    }>;
    pruneExpiredNonces(): Promise<void>;
}
