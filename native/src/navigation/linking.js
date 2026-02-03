export const linking = {
  prefixes: ['tableu://', 'https://tarot.lakefrontdev.com'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Reading: '',
          Journal: 'journal',
          Gallery: 'journal/gallery',
          Account: 'account'
        }
      },
      ShareReading: 'share/:token',
      ResetPassword: {
        path: 'reset-password',
        parse: {
          token: (token) => token
        }
      },
      VerifyEmail: {
        path: 'verify-email',
        parse: {
          token: (token) => token
        }
      },
      OAuthCallback: {
        path: 'auth/callback',
        parse: {
          code: (code) => code,
          state: (state) => state,
          error: (error) => error,
          error_description: (error_description) => error_description
        }
      }
    }
  }
};
