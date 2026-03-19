import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

@Injectable()
export class SettingsService {
  async getTenant(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) throw new NotFoundException('Tenant no encontrado')
    return tenant
  }

  async updateTenant(tenantId: string, data: { name?: string; nif?: string; sector?: string; logo?: string; currency?: string; locale?: string }) {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.nif !== undefined) updateData.nif = data.nif
    if (data.sector !== undefined) updateData.sector = data.sector
    if (data.logo !== undefined) updateData.logo = data.logo
    if (data.currency !== undefined) updateData.currency = data.currency
    if (data.locale !== undefined) updateData.locale = data.locale
    return prisma.tenant.update({ where: { id: tenantId }, data: updateData })
  }

  async getSettings(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } })
    if (!tenant) throw new NotFoundException('Tenant no encontrado')
    return tenant.settings || this.getDefaultSettings()
  }

  async updateSettings(tenantId: string, settings: any) {
    const current = await this.getSettings(tenantId)
    const merged = { ...this.getDefaultSettings(), ...(current as any), ...settings }
    return prisma.tenant.update({ where: { id: tenantId }, data: { settings: merged }, select: { settings: true } })
  }

  private getDefaultSettings() {
    return {
      kpiTargets: {
        dsoTarget: 45,
        dpoTarget: 60,
        cccTarget: 30,
        ebitdaMarginTarget: 20,
        liquidezMinima: 1.2,
      },
      covenantAlerts: {
        warningThreshold: 20,
        criticalThreshold: 10,
      },
      forecast: {
        horizonWeeks: 13,
        gapAlertEnabled: true,
        scenarioDefault: 'BASE',
      },
      scoring: {
        alertScoreThreshold: 50,
        riskAutoSuspend: false,
      },
      notifications: {
        emailEnabled: false,
        overdueAlertDays: 3,
        apDueSoonDays: 3,
      },
    }
  }
}
