import 'next-auth';
import 'next-auth/jwt';

/**
 * `session.user.id` is our internal `User.id` (a cuid), resolved once at sign-in via the API's
 * /auth/session endpoint. Auth.js's default `user` has no `id`, and its JWT has no `userId`.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
  }
}
