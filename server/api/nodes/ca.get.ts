import { ensureCa } from '../../utils/pki'

// GET /api/nodes/ca — the origin's node CA certificate (PEM). Public: a node or its reverse proxy
// fetches it to trust the chain. Contains no private key.
export default defineEventHandler(async (event) => {
  const ca = await ensureCa(useRuntimeConfig().pkiDir as string)
  setHeader(event, 'Content-Type', 'application/x-pem-file')
  return ca.caCertPem
})
