'use server'

import { cookies } from 'next/headers'
import { type Locale, locales, defaultLocale } from './config'

export async function setLocale(locale: Locale) {
  if (!locales.includes(locale)) return
  cookies().set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  })
}
