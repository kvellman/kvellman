// Shape of the authenticated user stored in the nuxt-auth-utils session (M5-A).
declare module '#auth-utils' {
  interface User {
    id: number
    email: string
    name: string | null
    role: 'admin' | 'reviewer' | 'viewer'
  }
}

export {}
