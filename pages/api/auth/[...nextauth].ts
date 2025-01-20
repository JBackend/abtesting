import NextAuth, { DefaultSession, NextAuthOptions, Session } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import { JWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string
    } & DefaultSession['user']
  }
}

interface SessionCallbackParams {
  session: Session
  token: JWT & { sub?: string }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    session: async ({ session, token }: SessionCallbackParams) => {
      if (session?.user && token?.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
}

export default NextAuth(authOptions) 