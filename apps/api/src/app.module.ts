import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { UserThrottlerGuard } from './common/guards/user-throttler.guard'
import { AuthModule } from './auth/auth.module'
import { TreasuryModule } from './treasury/treasury.module'
import { CustomersModule } from './customers/customers.module'
import { DebtModule } from './debt/debt.module'
import { InventoryModule } from './inventory/inventory.module'
import { ScenariosModule } from './scenarios/scenarios.module'
import { BotModule } from './bot/bot.module'
import { BoardModule } from './board/board.module'
import { GovernanceModule } from './governance/governance.module'
import { AlertsModule } from './alerts/alerts.module'
import { UsersModule } from './users/users.module'
import { SettingsModule } from './settings/settings.module'
import { ReportingModule } from './reporting/reporting.module'
import { ProvisionsModule } from './provisions/provisions.module'
import { BudgetModule } from './budget/budget.module'
import { SuppliersModule } from './suppliers/suppliers.module'
import { ImportModule } from './import/import.module'
import { NotificationsModule } from './notifications/notifications.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    ThrottlerModule.forRoot([
      // Default: 100 req/min per user (or per IP if unauthenticated)
      { name: 'default', ttl: 60_000, limit: 100 },
      // Short burst protection: 20 req/10s
      { name: 'short', ttl: 10_000, limit: 20 },
    ]),
    EventEmitterModule.forRoot(),
    AuthModule,
    TreasuryModule,
    CustomersModule,
    DebtModule,
    InventoryModule,
    ScenariosModule,
    BotModule,
    BoardModule,
    GovernanceModule,
    AlertsModule,
    UsersModule,
    SettingsModule,
    ReportingModule,
    ProvisionsModule,
    BudgetModule,
    SuppliersModule,
    ImportModule,
    NotificationsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
})
export class AppModule {}
