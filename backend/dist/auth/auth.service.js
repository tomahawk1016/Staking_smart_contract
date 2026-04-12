"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const viem_1 = require("viem");
const login_nonce_entity_1 = require("../entities/login-nonce.entity");
const session_entity_1 = require("../entities/session.entity");
const user_entity_1 = require("../entities/user.entity");
const NONCE_TTL_MS = 10 * 60 * 1000;
function buildLoginMessage(params) {
    return [
        "StakeMaster sign-in",
        "",
        `Wallet: ${params.wallet}`,
        `Nonce: ${params.nonce}`,
        `Chain ID: ${params.chainId}`,
        "",
        `Issued At: ${params.issuedAt}`,
    ].join("\n");
}
function parseNonceFromMessage(message) {
    const m = message.match(/^Nonce: (.+)$/m);
    return m?.[1]?.trim() ?? null;
}
let AuthService = class AuthService {
    constructor(users, sessions, nonces, jwt, config) {
        this.users = users;
        this.sessions = sessions;
        this.nonces = nonces;
        this.jwt = jwt;
        this.config = config;
    }
    adminSet() {
        const raw = this.config.get("ADMIN_ADDRESSES") ?? "";
        return new Set(raw
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean));
    }
    async createChallenge(walletAddress, chainId) {
        const wallet = (0, viem_1.getAddress)(walletAddress);
        const cid = chainId ??
            Number(this.config.get("DEFAULT_CHAIN_ID") || 11155111);
        const value = (0, crypto_1.randomBytes)(24).toString("hex");
        const expiresAt = new Date(Date.now() + NONCE_TTL_MS);
        await this.nonces.delete({ walletAddress: wallet });
        await this.nonces.save(this.nonces.create({ walletAddress: wallet, value, expiresAt }));
        const issuedAt = new Date().toISOString();
        const message = buildLoginMessage({
            wallet,
            nonce: value,
            chainId: cid,
            issuedAt,
        });
        return { message };
    }
    async verifySignature(message, signature) {
        const nonce = parseNonceFromMessage(message);
        if (!nonce) {
            throw new common_1.BadRequestException("Invalid message format");
        }
        let recovered;
        try {
            recovered = await (0, viem_1.recoverMessageAddress)({ message, signature });
        }
        catch {
            throw new common_1.UnauthorizedException("Invalid signature");
        }
        const ok = await (0, viem_1.verifyMessage)({
            address: recovered,
            message,
            signature,
        });
        if (!ok) {
            throw new common_1.UnauthorizedException("Signature verification failed");
        }
        const wallet = (0, viem_1.getAddress)(recovered);
        const row = await this.nonces.findOne({
            where: { walletAddress: wallet, value: nonce },
        });
        if (!row || row.expiresAt.getTime() < Date.now()) {
            throw new common_1.UnauthorizedException("Nonce missing or expired");
        }
        await this.nonces.delete({ id: row.id });
        let user = await this.users.findOne({ where: { walletAddress: wallet } });
        if (!user) {
            user = this.users.create({ walletAddress: wallet });
            await this.users.save(user);
        }
        const jti = (0, crypto_1.randomBytes)(32).toString("hex");
        const expiresIn = this.config.get("JWT_EXPIRES_IN") ?? "7d";
        const expiresAt = this.computeExpiry(expiresIn);
        const session = this.sessions.create({
            userId: user.id,
            jti,
            expiresAt,
            logoutAt: null,
        });
        await this.sessions.save(session);
        const isAdmin = this.adminSet().has(wallet.toLowerCase());
        const accessToken = await this.jwt.signAsync({
            sub: user.id,
            jti,
            wallet,
            role: isAdmin ? "admin" : "user",
        }, { expiresIn });
        return { accessToken, walletAddress: wallet, isAdmin };
    }
    computeExpiry(expiresIn) {
        const m = /^(\d+)([smhd])$/.exec(expiresIn.trim());
        if (!m) {
            return new Date(Date.now() + 7 * 24 * 3600 * 1000);
        }
        const n = Number(m[1]);
        const u = m[2];
        const mult = u === "s" ? 1000 : u === "m" ? 60_000 : u === "h" ? 3600_000 : 86400_000;
        return new Date(Date.now() + n * mult);
    }
    async logout(jti) {
        await this.sessions.update({ jti }, { logoutAt: new Date() });
    }
    async validateSession(jti, userId) {
        const session = await this.sessions.findOne({
            where: { jti, userId },
            relations: ["user"],
        });
        if (!session || session.logoutAt) {
            throw new common_1.UnauthorizedException("Session invalid");
        }
        if (session.expiresAt.getTime() < Date.now()) {
            throw new common_1.UnauthorizedException("Session expired");
        }
        return {
            userId: session.userId,
            wallet: session.user.walletAddress,
            jti: session.jti,
        };
    }
    async pruneExpiredNonces() {
        await this.nonces.delete({ expiresAt: (0, typeorm_2.LessThan)(new Date()) });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(session_entity_1.Session)),
    __param(2, (0, typeorm_1.InjectRepository)(login_nonce_entity_1.LoginNonce)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map