import { AuthService } from "./auth.service";
import { ChallengeRequestDto } from "./dto/challenge-request.dto";
import { VerifyRequestDto } from "./dto/verify-request.dto";
import type { Request } from "express";
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    challenge(body: ChallengeRequestDto): Promise<{
        message: string;
    }>;
    verify(body: VerifyRequestDto): Promise<{
        accessToken: string;
        walletAddress: string;
        isAdmin: boolean;
    }>;
    logout(req: Request & {
        user: {
            jti: string;
        };
    }): Promise<{
        ok: boolean;
    }>;
    me(req: Request & {
        user: {
            wallet: string;
            userId: string;
        };
    }): {
        walletAddress: string;
        userId: string;
    };
}
