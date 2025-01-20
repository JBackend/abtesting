import NextAuth from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import { Session } from 'next-auth'

export default NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    session: async ({ session, token }): Promise<Session> => {
      if (session?.user) {
        session.user.id = token.sub
      }
      return session
    },
  },
}) 