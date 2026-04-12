import { ConfigService } from "@nestjs/config";
import { Strategy } from "passport-jwt";
import { AuthService } from "./auth.service";
export type JwtPayload = {
    sub: string;
    jti: string;
    wallet: string;
    role?: string;
};
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly auth;
    constructor(config: ConfigService, auth: AuthService);
    validate(payload: JwtPayload): Promise<{
        userId: string;
        wallet: string;
        jti: string;
    }>;
}
export {};
