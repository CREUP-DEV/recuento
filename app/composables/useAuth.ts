import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient()

export function useAuth() {
  const session = authClient.useSession()

  async function signInWithGoogle() {
    return authClient.signIn.social({
      provider: 'google',
      callbackURL: '/admin',
    })
  }

  async function signOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigateTo('/')
        },
      },
    })
  }

  return {
    session,
    signInWithGoogle,
    signOut,
  }
}
