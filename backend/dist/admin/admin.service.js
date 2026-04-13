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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const session_entity_1 = require("../entities/session.entity");
const user_entity_1 = require("../entities/user.entity");
let AdminService = class AdminService {
    constructor(config, users, sessions) {
        this.config = config;
        this.users = users;
        this.sessions = sessions;
    }
    async listWalletUsers() {
        const list = await this.users.find({
            order: { registeredAt: "DESC" },
            relations: ["sessions"],
        });
        const now = Date.now();
        return list.map((u) => {
            const sessions = u.sessions ?? [];
            const active = sessions.some((s) => {
                if (s.logoutAt)
                    return false;
                return new Date(s.expiresAt).getTime() > now;
            });
            const lastLoginAt = sessions.length > 0
                ? new Date(Math.max(...sessions.map((s) => new Date(s.loginAt).getTime()))).toISOString()
                : null;
            const withLogout = sessions
                .map((s) => s.logoutAt)
                .filter((d) => d != null);
            const lastLogoutAt = withLogout.length > 0
                ? new Date(Math.max(...withLogout.map((d) => new Date(d).getTime()))).toISOString()
                : null;
            return {
                walletAddress: u.walletAddress,
                registeredAt: u.registeredAt.toISOString(),
                lastLoginAt,
                lastLogoutAt,
                state: active ? "logged_in" : "logged_out",
            };
        });
    }
    async fetchStakingActivitiesFromSubgraph(first, skip) {
        const url = this.config.get("SUBGRAPH_QUERY_URL")?.trim();
        if (!url) {
            throw new common_1.ServiceUnavailableException("SUBGRAPH_QUERY_URL is not set. Deploy the subgraph and add its GraphQL HTTP endpoint.");
        }
        const firstClamped = Math.min(Math.max(Number(first) || 50, 1), 200);
        const skipClamped = Math.max(Number(skip) || 0, 0);
        const apiKey = this.config.get("SUBGRAPH_API_KEY")?.trim();
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
        const headers = {
            "Content-Type": "application/json",
        };
        if (apiKey) {
            headers.Authorization = `Bearer ${apiKey}`;
        }
        let res;
        try {
            res = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    query,
                    variables: { first: firstClamped, skip: skipClamped },
                }),
            });
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : "Network error";
            throw new common_1.BadGatewayException(`Subgraph request failed: ${msg}`);
        }
        const body = (await res.json());
        if (!res.ok) {
            throw new common_1.BadGatewayException(`Subgraph HTTP ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
        }
        if (body.errors?.length) {
            throw new common_1.BadGatewayException(body.errors.map((x) => x.message).join("; ") || "Subgraph GraphQL error");
        }
        const list = body.data?.stakingActivities;
        if (!Array.isArray(list)) {
            throw new common_1.BadGatewayException("Unexpected subgraph response shape.");
        }
        return list;
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(2, (0, typeorm_1.InjectRepository)(session_entity_1.Session)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AdminService);
//# sourceMappingURL=admin.service.js.map