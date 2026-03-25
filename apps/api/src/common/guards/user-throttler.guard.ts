import { Injectable, ExecutionContext } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

/**
 * Custom throttler that keys rate limits by:
 * - userId + tenantId for authenticated requests
 * - IP address for unauthenticated requests (login, etc.)
 *
 * This replaces the default IP-only keying so that:
 * - Different users behind the same proxy get separate limits
 * - One user can't exhaust the limit for all users on the same IP
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // If the request has been authenticated (JwtAuthGuard ran first),
    // req.user contains { userId, tenantId, email, role }
    if (req.user?.userId) {
      return `user:${req.user.userId}`
    }
    // Fall back to IP for unauthenticated routes (login)
    return req.ip || req.connection?.remoteAddress || 'unknown'
  }
}
