import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { Server, Socket } from 'socket.io'
import * as jwt from 'jsonwebtoken'
import { NotificationEvent, NOTIFICATION_EVENTS } from './notification-events'
import { DebtService } from '../debt/debt.service'

@WebSocketGateway({
  cors: {
    origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(NotificationsGateway.name)
  private covenantCheckInterval: NodeJS.Timeout

  constructor(private debtService: DebtService) {}

  afterInit() {
    // Check covenant risks every 5 minutes for connected tenants
    this.covenantCheckInterval = setInterval(() => this.checkCovenants(), 5 * 60 * 1000)
    this.logger.log('WebSocket gateway inicializado')
  }

  private async checkCovenants() {
    if (!this.server) return
    const sockets = await this.server.fetchSockets()
    const tenantIds = new Set<string>()
    for (const s of sockets) {
      if (s.data?.tenantId) tenantIds.add(s.data.tenantId)
    }
    for (const tenantId of tenantIds) {
      try {
        await this.debtService.checkCovenantRisks(tenantId)
      } catch (err) {
        this.logger.error(`Error checking covenants for tenant ${tenantId}: ${err}`)
      }
    }
  }

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '')
      if (!token) {
        this.logger.warn(`Conexión rechazada: sin token`)
        client.disconnect()
        return
      }

      const secret = process.env.JWT_SECRET || 'dev-secret'
      const payload = jwt.verify(token, secret) as any
      const tenantId = payload.tenantId
      if (!tenantId) {
        this.logger.warn(`Conexión rechazada: JWT sin tenantId`)
        client.disconnect()
        return
      }

      client.data = { userId: payload.sub, tenantId, email: payload.email, role: payload.role }
      client.join(`tenant:${tenantId}`)
      this.logger.log(`Cliente conectado: ${payload.email} (tenant: ${tenantId})`)
      this.broadcastPresence(tenantId)
    } catch (err) {
      this.logger.warn(`Conexión rechazada: JWT inválido`)
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data?.email) {
      this.logger.log(`Cliente desconectado: ${client.data.email}`)
    }
    if (client.data?.tenantId) {
      this.broadcastPresence(client.data.tenantId)
    }
  }

  private async broadcastPresence(tenantId: string) {
    const sockets = await this.server.in(`tenant:${tenantId}`).fetchSockets()
    const users = sockets
      .filter(s => s.data?.userId)
      .map(s => ({ userId: s.data.userId, email: s.data.email, role: s.data.role }))
    // Deduplicate by userId (user might have multiple tabs)
    const unique = [...new Map(users.map(u => [u.userId, u])).values()]
    this.server.to(`tenant:${tenantId}`).emit('presence_update', unique)
  }

  @OnEvent(NOTIFICATION_EVENTS.PAYMENT_APPROVED)
  handlePaymentApproved(event: NotificationEvent) {
    this.broadcast(event)
  }

  @OnEvent(NOTIFICATION_EVENTS.PAYMENT_REJECTED)
  handlePaymentRejected(event: NotificationEvent) {
    this.broadcast(event)
  }

  @OnEvent(NOTIFICATION_EVENTS.INVOICE_CREATED)
  handleInvoiceCreated(event: NotificationEvent) {
    this.broadcast(event)
  }

  @OnEvent(NOTIFICATION_EVENTS.COVENANT_RISK)
  handleCovenantRisk(event: NotificationEvent) {
    this.broadcast(event)
  }

  @OnEvent(NOTIFICATION_EVENTS.ALERT_RESOLVED)
  handleAlertResolved(event: NotificationEvent) {
    this.broadcast(event)
  }

  private broadcast(event: NotificationEvent) {
    this.server.to(`tenant:${event.tenantId}`).emit('notification', {
      type: event.type,
      severity: event.severity,
      title: event.title,
      description: event.description,
      link: event.link,
      data: event.data,
      timestamp: event.timestamp,
    })
  }
}
