import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes } from "crypto";
import { Repository, LessThan } from "typeorm";
import { getAddress, recoverMessageAddress, verifyMessage } from "viem";
import { LoginNonce } from "../entities/login-nonce.entity";
import { Session } from "../entities/session.entity";
import { User } from "../entities/user.entity";

const NONCE_TTL_MS = 10 * 60 * 1000;

function buildLoginMessage(params: {
  wallet: `0x${string}`;
  nonce: string;
  chainId: number;
  issuedAt: string;
}): string {
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

function parseNonceFromMessage(message: string): string | null {
  const m = message.match(/^Nonce: (.+)$/m);
  return m?.[1]?.trim() ?? null;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(LoginNonce)
    private readonly nonces: Repository<LoginNonce>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private adminSet(): Set<string> {
    const raw = this.config.get<string>("ADMIN_ADDRESSES") ?? "";
    return new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  async createChallenge(walletAddress: string, chainId?: number): Promise<{ message: string }> {
    const wallet = getAddress(walletAddress) as `0x${string}`;
    const cid =
      chainId ??
      Number(this.config.get("DEFAULT_CHAIN_ID") || 11155111);
    const value = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + NONCE_TTL_MS);
    await this.nonces.delete({ walletAddress: wallet });
    await this.nonces.save(
      this.nonces.create({ walletAddress: wallet, value, expiresAt }),
    );
    const issuedAt = new Date().toISOString();
    const message = buildLoginMessage({
      wallet,
      nonce: value,
      chainId: cid,
      issuedAt,
    });
    return { message };
  }

  async verifySignature(message: string, signature: `0x${string}`): Promise<{
    accessToken: string;
    walletAddress: string;
    isAdmin: boolean;
  }> {
    const nonce = parseNonceFromMessage(message);
    if (!nonce) {
      throw new BadRequestException("Invalid message format");
    }
    let recovered: `0x${string}`;
    try {
      recovered = await recoverMessageAddress({ message, signature });
    } catch {
      throw new UnauthorizedException("Invalid signature");
    }
    const ok = await verifyMessage({
      address: recovered,
      message,
      signature,
    });
    if (!ok) {
      throw new UnauthorizedException("Signature verification failed");
    }
    const wallet = getAddress(recovered);
    const row = await this.nonces.findOne({
      where: { walletAddress: wallet, value: nonce },
    });
    if (!row || row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Nonce missing or expired");
    }
    await this.nonces.delete({ id: row.id });

    let user = await this.users.findOne({ where: { walletAddress: wallet } });
    if (!user) {
      user = this.users.create({ walletAddress: wallet });
      await this.users.save(user);
    }

    const jti = randomBytes(32).toString("hex");
    const expiresIn = this.config.get<string>("JWT_EXPIRES_IN") ?? "7d";
    const expiresAt = this.computeExpiry(expiresIn);
    const session = this.sessions.create({
      userId: user.id,
      jti,
      expiresAt,
      logoutAt: null,
    });
    await this.sessions.save(session);

    const isAdmin = this.adminSet().has(wallet.toLowerCase());
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        jti,
        wallet,
        role: isAdmin ? "admin" : "user",
      },
      { expiresIn },
    );

    return { accessToken, walletAddress: wallet, isAdmin };
  }

  private computeExpiry(expiresIn: string): Date {
    const m = /^(\d+)([smhd])$/.exec(expiresIn.trim());
    if (!m) {
      return new Date(Date.now() + 7 * 24 * 3600 * 1000);
    }
    const n = Number(m[1]);
    const u = m[2];
    const mult =
      u === "s" ? 1000 : u === "m" ? 60_000 : u === "h" ? 3600_000 : 86400_000;
    return new Date(Date.now() + n * mult);
  }

  async logout(jti: string): Promise<void> {
    await this.sessions.update({ jti }, { logoutAt: new Date() });
  }

  async validateSession(jti: string, userId: string): Promise<{
    userId: string;
    wallet: string;
    jti: string;
  }> {
    const session = await this.sessions.findOne({
      where: { jti, userId },
      relations: ["user"],
    });
    if (!session || session.logoutAt) {
      throw new UnauthorizedException("Session invalid");
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Session expired");
    }
    return {
      userId: session.userId,
      wallet: session.user.walletAddress,
      jti: session.jti,
    };
  }

  async pruneExpiredNonces(): Promise<void> {
    await this.nonces.delete({ expiresAt: LessThan(new Date()) });
  }
}
