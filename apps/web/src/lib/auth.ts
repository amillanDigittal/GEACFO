import CredentialsProvider from 'next-auth/providers/credentials'

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Decode JWT payload without verification (just to read exp)
function decodeJwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
    return payload.exp || null
  } catch {
    return null
  }
}

async function refreshAccessToken(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.access_token || null
  } catch {
    return null
  }
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        try {
          const res = await fetch(`${API_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: credentials.email, password: credentials.password }),
          })
          if (!res.ok) return null
          const data = await res.json()
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            role: data.user.role,
            tenantId: data.user.tenant.id,
            tenantName: data.user.tenant.name,
            accessToken: data.access_token,
          }
        } catch {
          return null
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }: any) => {
      // Initial sign-in: store all user fields + token
      if (user) {
        token.id = user.id
        token.role = user.role
        token.tenantId = user.tenantId
        token.tenantName = user.tenantName
        token.accessToken = user.accessToken
        token.error = undefined
        return token
      }

      // Subsequent requests: check if API token needs refresh
      if (token.accessToken) {
        const exp = decodeJwtExp(token.accessToken)
        if (exp) {
          const now = Math.floor(Date.now() / 1000)
          const timeLeft = exp - now
          // Refresh if less than 1 day remaining (token is 7d)
          if (timeLeft < 86400) {
            const newToken = await refreshAccessToken(token.accessToken)
            if (newToken) {
              token.accessToken = newToken
              token.error = undefined
            } else if (timeLeft <= 0) {
              // Token fully expired and refresh failed
              token.error = 'TokenExpired'
            }
          }
        }
      }

      return token
    },
    session: ({ session, token }: any) => {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.tenantId = token.tenantId
        session.user.tenantName = token.tenantName
        session.accessToken = token.accessToken
        session.error = token.error
      }
      return session
    },
  },
  pages: { signIn: '/auth/login', error: '/auth/login' },
  session: { strategy: 'jwt' as const, maxAge: 604800 },
  secret: process.env.NEXTAUTH_SECRET,
}
