# Recuento CREUP — Despliegue

Despliegue recomendado: build local con `deploy.sh`, push a GHCR y actualización remota con `docker compose`.

Archivos de referencia:

- `deploy.sh`
- `docker-compose.production.example.yml`
- `deploy/nginx/recuento.production.example.conf`

## Requisitos

Local:

- Docker con Buildx
- `git`
- `ssh`
- acceso a GHCR

VPS:

- Docker Engine + Compose
- NGINX
- `certbot`

## Lo mínimo que debes tener

En tu máquina local, variables para `deploy.sh`:

```env
VPS_HOST=usuario@servidor
REMOTE_DIR=/ruta/al/proyecto/recuento
NUXT_SITE_URL=https://recuento.creup.es
NUXT_UMAMI_HOST=https://umami.example.com
NUXT_UMAMI_ID=<site-id>

# Por defecto, deploy.sh reutiliza la sesión de `docker login ghcr.io`
# que ya tengas abierta en local.

# Solo si el compose remoto vive fuera de REMOTE_DIR
COMPOSE_DIR=/ruta/donde-esta-el-compose

# Solo si el servicio app no se llama "app"
COMPOSE_APP_SERVICE=app

# Solo si hay un servicio PostgreSQL en ese compose
COMPOSE_POSTGRES_SERVICE=postgres

# Solo si NGINX vive en el mismo Compose y quieres recargarlo tras recrear la app
COMPOSE_NGINX_SERVICE=nginx

# Solo si quieres forzar login explícito desde el script
# GHCR_LOGIN=true
# GHCR_USERNAME=<usuario>
# GHCR_TOKEN=<token>

IMAGE_NAME=ghcr.io/creup-dev/recuento
DOCKER_PLATFORM=linux/amd64
APPLY_MIGRATIONS_ON_DEPLOY=true
DEPLOY_IMAGE_RETENTION=2
```

Importante:

- `COMPOSE_APP_SERVICE` y `COMPOSE_POSTGRES_SERVICE` son nombres de servicio de Compose, no `container_name`.
- `COMPOSE_DIR` puede apuntar al directorio del proyecto o a un Compose raíz que incluya varios proyectos con `include`.
- Cuando se usa un Compose raíz compartido, `deploy.sh` debe operar solo sobre `COMPOSE_APP_SERVICE`; no ejecutes `docker compose up -d` global con `IMAGE` exportado, porque otros servicios que usen `${IMAGE}` podrían arrancar con la imagen equivocada.
- Si usas PostgreSQL externo, normalmente no necesitas `COMPOSE_POSTGRES_SERVICE`.
- Si NGINX corre como servicio del mismo Compose, deja `COMPOSE_NGINX_SERVICE` definido para recargarlo tras recrear la app. Esto evita que conserve DNS interno antiguo del contenedor recreado.
- Si ya hiciste `docker login ghcr.io` en local, no pongas `GHCR_USERNAME` ni `GHCR_TOKEN` en `.env`.
- `NUXT_SITE_URL` y la configuración de Umami se inyectan en el build local de Nuxt. Si solo las defines en el `.env` del VPS, la imagen ya saldrá sin esa configuración.
- `DEPLOY_IMAGE_RETENTION` controla cuántas imágenes Docker de `IMAGE_NAME` se conservan en el VPS. Por defecto mantiene 2: la actual y la inmediatamente anterior para rollback. Usa `0` para desactivar la limpieza.

En el VPS:

- `docker-compose.yml`
- `.env`
- directorio persistente para banners

También es válido que este proyecto viva como archivo incluido desde un Compose raíz compartido:

```yaml
include:
  - recuento/docker-compose.yml
```

En ese caso, ajusta `COMPOSE_DIR` al directorio del Compose raíz y `COMPOSE_APP_SERVICE` al nombre real del servicio de Recuento.

## Preparación rápida del VPS

```bash
mkdir -p /ruta/al/proyecto/recuento/data/banners
sudo chown -R 1000:1000 /ruta/al/proyecto/recuento/data
```

Copia el compose de ejemplo y ajústalo:

```bash
scp docker-compose.production.example.yml usuario@servidor:/ruta/al/proyecto/recuento/docker-compose.yml
```

## `.env` de producción

Variables mínimas:

```env
NUXT_SITE_URL=https://recuento.creup.es
TZ=Europe/Madrid
APP_SECRET=<secret>
ADMIN_EMAILS=admin@example.com
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
DATABASE_URL=postgresql://usuario:password@host:5432/recuento?schema=public
APP_PORT=3000
APP_BANNERS_DIR=./data/banners
APPLY_MIGRATIONS_ON_DEPLOY=true
COMPOSE_APP_SERVICE=app
COMPOSE_POSTGRES_SERVICE=postgres
COMPOSE_NGINX_SERVICE=nginx
```

Opcionales:

```env
NUXT_UMAMI_HOST=https://umami.example.com
NUXT_UMAMI_ID=<site-id>
NUXT_CSP_REPORT_URI=https://recuento.creup.es/api/csp/report
```

## Google OAuth

En Google Cloud:

- `Authorized JavaScript origins`: `https://recuento.creup.es`
- `Authorized redirect URIs`: `https://recuento.creup.es/api/auth/callback/google`

## NGINX

Usa `deploy/nginx/recuento.production.example.conf` como base.

Puntos obligatorios:

- `X-Forwarded-For $remote_addr`
- `proxy_buffering off` para `/api/sse/`
- bloquear `/health`
- servir la app en HTTPS

Instalación típica:

```bash
scp deploy/nginx/recuento.production.example.conf usuario@servidor:/tmp/recuento.conf
ssh usuario@servidor
sudo mv /tmp/recuento.conf /etc/nginx/sites-available/recuento
sudo ln -sf /etc/nginx/sites-available/recuento /etc/nginx/sites-enabled/recuento
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d recuento.creup.es --non-interactive --agree-tos -m admin@creup.es
```

## Desplegar

```bash
bash ./deploy.sh
```

El script:

1. construye la imagen en local
2. publica la imagen en GHCR usando la sesión actual de Docker o un login explícito si `GHCR_LOGIN=true`
3. conecta por SSH
4. hace `docker compose pull` solo del servicio app
5. ejecuta migraciones si están activadas
6. recrea solo el servicio app
7. recarga NGINX si `COMPOSE_NGINX_SERVICE` existe en el Compose
8. borra imágenes antiguas de `IMAGE_NAME` en el VPS, conservando `DEPLOY_IMAGE_RETENTION`

## Verificar

En el VPS:

```bash
cd /ruta/del/compose
docker compose ps
docker compose logs --tail 100
curl "http://127.0.0.1:${APP_PORT:-3000}/health"
```

El healthcheck de la app se define en el `Dockerfile`; el Compose lo hereda de la imagen. Solo añade `healthcheck:` en Compose si necesitas sobrescribirlo para un entorno concreto. `APP_PORT` es el puerto publicado en el host; dentro del contenedor Nitro escucha en `3000`.

En la web:

- login admin
- subida de banner
- SSE en una votación abierta

## Errores frecuentes

Login falla:

- hay credenciales antiguas en `.env` y no quieres usarlas
- no has hecho `docker login ghcr.io` en la máquina local
- `NUXT_SITE_URL` no coincide con el dominio real
- callback OAuth incorrecta
- `ADMIN_EMAILS` no contiene tu cuenta

`deploy.sh` falla con Compose:

- `COMPOSE_APP_SERVICE` apunta al `container_name` en vez del servicio
- `COMPOSE_DIR` no es el directorio donde está el `docker-compose.yml`
- en un Compose raíz compartido, algún servicio usa `${IMAGE}` y se ejecutó `docker compose up -d` sin acotar al servicio

Los banners desaparecen:

- falta `APP_BANNERS_DIR`
- el bind mount no existe
- permisos incorrectos en el directorio persistente
- el volumen no está montado en `/app/data/banners`

`/health` devuelve 404 públicamente:

- es correcto; debe consultarse de forma local, no a través de NGINX
