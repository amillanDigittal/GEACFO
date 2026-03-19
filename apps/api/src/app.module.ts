import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
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
  ],
})
export class AppModule {}
