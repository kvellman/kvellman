import { eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { packages, versions } from '../../db/schema'

// GET /api/approvals/pending — versions awaiting review (not yet delivered to winget clients).
export default defineEventHandler(async () => {
  const rows = await db
    .select({
      packageIdentifier: packages.packageIdentifier,
      packageName: packages.packageName,
      packageVersion: versions.packageVersion,
      origin: versions.origin,
    })
    .from(versions)
    .innerJoin(packages, eq(versions.packageId, packages.id))
    .where(eq(versions.approvalStatus, 'pending'))
    .orderBy(packages.packageName)

  return { count: rows.length, pending: rows }
})
