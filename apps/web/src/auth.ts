import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { LoginInputSchema, type Role } from '@logistics/shared';
import { authenticateCredentials, ensureOAuthUser, getAuthUserByEmail, getUserRole } from '@logistics/core';

export const { auth, handlers } = NextAuth({
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = LoginInputSchema.safeParse(credentials);
        if (!parsed.success) return null;
        return authenticateCredentials(parsed.data.email, parsed.data.password);
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google' || !user.email) return true;
      await ensureOAuthUser(user.email, user.name);
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        let id = user.id;
        let role = user.role;
        if (user.email) {
          const databaseUser = await getAuthUserByEmail(user.email);
          id = databaseUser?.id ?? id;
          role ??= databaseUser?.role;
        } else if (id) {
          role ??= (await getUserRole(id))?.role;
        }
        token.id = id;
        token.role = role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && token.role) session.user = { ...(session.user ?? {}), id: token.id as string, role: token.role as Role } as typeof session.user;
      return session;
    },
  },
});
