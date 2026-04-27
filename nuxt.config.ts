import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { getOptionalConfigUrl } from './shared/utils/config'

const isDev = process.env.NODE_ENV !== 'production'

const siteUrl =
  getOptionalConfigUrl(process.env.NUXT_SITE_URL, 'NUXT_SITE_URL') ?? 'http://localhost:3000'
const umamiHost = getOptionalConfigUrl(process.env.NUXT_UMAMI_HOST, 'NUXT_UMAMI_HOST')
const umamiOrigin = umamiHost ? new URL(umamiHost).origin : null
const adminAuthHandler = './server/handlers/admin-auth.ts'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-04-09',
  devtools: { enabled: isDev },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: isDev ? ['localhost', '127.0.0.1', '.trycloudflare.com'] : undefined,
    },
    optimizeDeps: {
      include: ['better-auth/vue', '@formkit/auto-animate/vue', 'zod'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) {
              return
            }

            if (
              id.includes('node_modules/.pnpm/reka-ui') ||
              id.includes('node_modules/reka-ui/') ||
              id.includes('node_modules/.pnpm/@floating-ui') ||
              id.includes('node_modules/@floating-ui/')
            ) {
              return 'vendor_reka'
            }

            if (
              id.includes('node_modules/.pnpm/tailwind-variants') ||
              id.includes('node_modules/tailwind-variants/') ||
              id.includes('node_modules/.pnpm/tailwind-merge') ||
              id.includes('node_modules/tailwind-merge/') ||
              id.includes('node_modules/.pnpm/class-variance-authority') ||
              id.includes('node_modules/class-variance-authority/')
            ) {
              return 'vendor_ui_styles'
            }
          },
        },
      },
    },
  },
  alias: {
    '#db': resolve('./server/db'),
    '#server-utils': resolve('./server/utils'),
    '#validation': resolve('./server/validation'),
  },
  modules: [
    'nuxt-security',
    '@nuxt/ui',
    '@nuxt/fonts',
    '@nuxt/eslint',
    '@nuxtjs/i18n',
    '@nuxt/icon',
    '@nuxt/image',
    '@vueuse/nuxt',
    '@nuxt/a11y',
    'nuxt-umami',
  ],

  security: {
    nonce: true,
    headers: {
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'script-src': [
          "'self'",
          "'nonce-{{nonce}}'",
          "'strict-dynamic'",
          ...(isDev ? ["'unsafe-eval'"] : []),
        ],
        'style-src': ["'self'", "'unsafe-inline'"],
        'style-src-attr': ["'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:', 'https://lh3.googleusercontent.com'],
        'font-src': ["'self'", 'data:'],
        'connect-src': [
          "'self'",
          ...(umamiOrigin ? [umamiOrigin] : []),
          ...(isDev ? ['ws:', 'wss:'] : []),
        ],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: 'same-site',
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubdomains: true,
      },
      xContentTypeOptions: 'nosniff',
      xFrameOptions: 'DENY',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
      },
    },
  },

  icon: {
    provider: 'server',
    fallbackToApi: false,
    collections: ['tabler', 'circle-flags', 'lucide'],
    serverBundle: {
      collections: ['tabler', 'circle-flags', 'lucide'],
    },
  },

  runtimeConfig: {
    siteUrl: siteUrl,
    umamiHost: umamiHost ?? undefined,
    public: {
      siteUrl: siteUrl,
    },
  },

  nitro: {
    compressPublicAssets: true,
    prerender: {
      crawlLinks: false,
      failOnError: true,
    },
    alias: {
      '#db': resolve('./server/db'),
      '#server-utils': resolve('./server/utils'),
      '#validation': resolve('./server/validation'),
    },
    typescript: {
      tsConfig: {
        compilerOptions: {
          paths: {
            '#db': ['../server/db/index.ts'],
            '#db/*': ['../server/db/*'],
            '#server-utils': ['../server/utils/index.ts'],
            '#server-utils/*': ['../server/utils/*'],
            '#validation': ['../server/validation/index.ts'],
            '#validation/*': ['../server/validation/*'],
          },
        },
      },
    },
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/**': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    },
    '/local': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
      ssr: false,
    },
    '/api/**': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    },
    '/_nuxt/**': {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
    '/api/sse/**': {
      security: {
        rateLimiter: {
          tokensPerInterval: 20,
          interval: 'minute',
        },
      },
    },
    '/admin/**': {
      security: {
        headers: {
          contentSecurityPolicy: {
            'default-src': ["'self'"],
            'script-src': [
              "'self'",
              "'nonce-{{nonce}}'",
              "'strict-dynamic'",
              ...(isDev ? ["'unsafe-eval'"] : []),
            ],
            'style-src': ["'self'", "'unsafe-inline'"],
            'style-src-attr': ["'unsafe-inline'"],
            'img-src': ["'self'", 'data:', 'blob:', 'https://lh3.googleusercontent.com'],
            'font-src': ["'self'", 'data:'],
            'connect-src': [
              "'self'",
              ...(umamiOrigin ? [umamiOrigin] : []),
              ...(isDev ? ['ws:', 'wss:'] : []),
            ],
            'frame-ancestors': ["'none'"],
            'object-src': ["'none'"],
            'base-uri': ["'self'"],
            'form-action': ["'self'"],
          },
        },
      },
    },
  },

  serverHandlers: [
    {
      route: '/api/admin/**',
      middleware: true,
      handler: adminAuthHandler,
    },
  ],

  i18n: {
    vueI18n: './i18n.config.ts',
    locales: [
      {
        code: 'es',
        language: 'es-ES',
        file: 'es.json',
        name: 'Español',
        flag: 'i-circle-flags-es',
      },
      {
        code: 'en',
        language: 'en-GB',
        file: 'en.json',
        name: 'English',
        flag: 'i-circle-flags-gb',
      },
    ],
    defaultLocale: 'es',
    baseUrl: siteUrl,
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'user-locale',
      fallbackLocale: 'es',
      redirectOn: 'root',
    },
  },

  // Performance optimizations
  experimental: {
    payloadExtraction: true,
    renderJsonPayloads: true,
    componentIslands: true,
  },

  // Image optimization
  image: {
    quality: 80,
    format: ['webp', 'avif', 'png', 'jpg'],
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      '2xl': 1536,
    },
  },

  // Accessibility testing (dev only)
  a11y: {
    enabled: isDev,
    defaultHighlight: false,
    logIssues: true,
  },

  // Umami Analytics — self-hosted, cookie-free measurement
  umami: {
    autoTrack: true,
    host: umamiHost ?? undefined,
    ignoreLocalhost: true,
    proxy: 'cloak',
  },
})
