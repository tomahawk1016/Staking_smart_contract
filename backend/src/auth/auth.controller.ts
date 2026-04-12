import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ChallengeRequestDto } from "./dto/challenge-request.dto";
import { VerifyRequestDto } from "./dto/verify-request.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { Request } from "express";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("challenge")
  async challenge(@Body() body: ChallengeRequestDto) {
    await this.auth.pruneExpiredNonces();
    return this.auth.createChallenge(body.walletAddress, body.chainId);
  }

  @Post("verify")
  verify(@Body() body: VerifyRequestDto) {
    return this.auth.verifySignature(
      body.message,
      body.signature as `0x${string}`,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@Req() req: Request & { user: { jti: string } }) {
    await this.auth.logout(req.user.jti);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() req: Request & { user: { wallet: string; userId: string } }) {
    return {
      walletAddress: req.user.wallet,
      userId: req.user.userId,
    };
  }
}
