import { resolveSite } from '../../../services/sites'

// GET /api/{siteToken}/information — source metadata + version negotiation.
export default defineEventHandler(async (event) => {
  const siteToken = getRouterParam(event, 'siteToken') ?? ''
  const ctx = await resolveSite(siteToken)

  return {
    Data: {
      SourceIdentifier: `kvellman.${ctx.site}`,
      ServerSupportedVersions: ['1.1.0', '1.4.0', '1.7.0', '1.9.0'],
      SourceAgreements: { AgreementsIdentifier: 'kvellman-1', Agreements: [] },
      UnsupportedPackageMatchFields: [],
      RequiredPackageMatchFields: [],
      UnsupportedQueryParameters: [],
      RequiredQueryParameters: [],
      Authentication: { AuthenticationType: 'none' },
    },
  }
})
