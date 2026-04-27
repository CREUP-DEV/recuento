# Recuento CREUP

Página pública para consultar en tiempo real y en histórico los resultados de las votaciones de las asambleas de CREUP (Coordinadora de Representantes de Estudiantes de Universidades Públicas).

## Qué incluye

- Página pública con resultados de votaciones en tiempo real vía SSE (Server-Sent Events).
- Panel de administración para gestionar eventos, votaciones y opciones de voto.
- Conteo de votos con botones +1/-1 y atajos de teclado.
- Votaciones temporales que cualquiera puede crear y gestionar sin guardarse ni sincronizarse con otros usuarios.
- Banners de evento con redimensionado automático (1400×400px → WebP).
- Internacionalización (es por defecto, en-GB secundario).
- Modo oscuro.
- Accesibilidad (skip links, semántica, `prefers-reduced-motion`).
- Sin indexación SEO (`noindex`, `nofollow` en todas las rutas).
- Analítica con Umami.

## Stack

- Nuxt 4 + Nitro
- Nuxt UI v4 + Tailwind CSS 4
- `@nuxtjs/i18n`
- `@nuxt/image`
- PostgreSQL + Drizzle ORM
- `better-auth` con Google OAuth para el panel de administración
- SSE (Server-Sent Events) para actualizaciones en tiempo real
- `nuxt-umami` para analítica

## Desarrollo local

```sh
pnpm install
docker compose up -d postgres adminer
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Requisitos:

- Node.js compatible con Nuxt 4
- `pnpm`
- Docker y Docker Compose

## Variables de entorno

La mayor parte de la configuración es runtime, pero `NUXT_SITE_URL` y la configuración de Umami también se leen durante el build de Nuxt. Si despliegas con `deploy.sh`, esas variables deben existir en la máquina local desde la que construyes la imagen.

En desarrollo local, `NUXT_SITE_URL` puede quedarse en `http://localhost:3000`. Si la imagen de producción necesita compilarse con otro origen público, define `NUXT_DEPLOY_SITE_URL`; `deploy.sh` usará esa variable solo para el build y mantendrá `NUXT_SITE_URL` como configuración runtime.

Mínimas:

| Variable               | Descripción                                            |
| ---------------------- | ------------------------------------------------------ |
| `NUXT_SITE_URL`        | Origen del sitio (ej. `http://localhost:3000`)         |
| `NUXT_DEPLOY_SITE_URL` | Origen público opcional usado por `deploy.sh` al build |
| `APP_SECRET`           | Secreto para sesiones de Better Auth                   |
| `ADMIN_EMAILS`         | Emails de administradores separados por coma           |
| `GOOGLE_CLIENT_ID`     | ID de cliente OAuth de Google                          |
| `GOOGLE_CLIENT_SECRET` | Secreto de cliente OAuth de Google                     |
| `DATABASE_URL`         | URL de conexión a PostgreSQL                           |

Opcionales:

| Variable                   | Descripción                        | Default         |
| -------------------------- | ---------------------------------- | --------------- |
| `TZ`                       | Zona horaria                       | `Europe/Madrid` |
| `DATABASE_MAX_CONNECTIONS` | Máximo de conexiones al pool de BD | `10`            |
| `NUXT_UMAMI_HOST`          | Host de Umami para analítica       | —               |
| `NUXT_UMAMI_ID`            | ID del sitio en Umami              | —               |
| `NUXT_UMAMI_TAG`           | Nombre del data attribute de Umami | —               |

Variables útiles en local:

| Variable            | Descripción                  | Default |
| ------------------- | ---------------------------- | ------- |
| `POSTGRES_USER`     | Usuario de PostgreSQL        | —       |
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL     | —       |
| `POSTGRES_DB`       | Nombre de la base de datos   | —       |
| `POSTGRES_PORT`     | Puerto externo de PostgreSQL | `5433`  |
| `ADMINER_PORT`      | Puerto de Adminer            | `8089`  |

## Scripts útiles

| Script             | Descripción                                 |
| ------------------ | ------------------------------------------- |
| `pnpm dev`         | Servidor de desarrollo                      |
| `pnpm build`       | Construir para producción                   |
| `pnpm preview`     | Previsualizar build                         |
| `pnpm lint:fix`    | Lint + fix automático                       |
| `pnpm typecheck`   | Verificación de tipos                       |
| `pnpm db:generate` | Genera migración tras cambios en el esquema |
| `pnpm db:migrate`  | Aplica migraciones pendientes               |
| `pnpm db:studio`   | Abre Drizzle Studio                         |

## Despliegue en producción

El despliegue recomendado es:

- build local con `deploy.sh`
- push a GHCR reutilizando la sesión actual de Docker
- `docker compose pull` + migraciones + restart en el VPS

```sh
bash ./deploy.sh
```

Si usas Umami, asegúrate de que `NUXT_UMAMI_HOST` y `NUXT_UMAMI_ID` estén definidos en el entorno local antes de ejecutar `deploy.sh`; ponerlos solo en el `.env` del VPS no reconfigura una imagen ya construida. Lo mismo aplica a `NUXT_DEPLOY_SITE_URL` si el build debe salir con un origen distinto al `localhost` usado en desarrollo.

Archivos clave:

- `docker-compose.production.example.yml`
- `deploy/nginx/recuento.production.example.conf`
- [`DEPLOYMENT.md`](./DEPLOYMENT.md)
