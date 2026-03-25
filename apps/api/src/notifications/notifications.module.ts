import { Module } from '@nestjs/common'
import { NotificationsGateway } from './notifications.gateway'
import { DebtService } from '../debt/debt.service'

@Module({
  providers: [NotificationsGateway, DebtService],
})
export class NotificationsModule {}
