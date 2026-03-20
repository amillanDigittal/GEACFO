import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

@Injectable()
export class GovernanceService {
  async getSources(tenantId: string) { return prisma.dataSource.findMany({ where: { tenantId } }) }
  async getAuditLog(tenantId: string) { return prisma.auditLog.findMany({ where: { tenantId }, include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }) }
}
