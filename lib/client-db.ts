import { PrismaClient } from '@prisma/client'

// Cache of dynamic Prisma clients keyed by database URL
// This is the ONLY place in the codebase where PrismaClient is instantiated
// outside of lib/db.ts — this is a deliberate exception for client database connections
const clientDbCache = new Map<string, PrismaClient>()

export function getClientDb(databaseUrl: string): PrismaClient {
  if (clientDbCache.has(databaseUrl)) {
    return clientDbCache.get(databaseUrl)!
  }
  const client = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
  clientDbCache.set(databaseUrl, client)
  return client
}
