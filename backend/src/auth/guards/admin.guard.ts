import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: { wallet?: string } }>();
    const wallet = req.user?.wallet?.toLowerCase();
    if (!wallet) {
      throw new ForbiddenException();
    }
    const raw = this.config.get<string>("ADMIN_ADDRESSES") ?? "";
    const admins = new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    if (!admins.has(wallet)) {
      throw new ForbiddenException("Admin only");
    }
    return true;
  }
}
