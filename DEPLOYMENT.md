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

# Solo si quieres forzar login explícito desde el script
# GHCR_LOGIN=true
# GHCR_USERNAME=<usuario>
# GHCR_TOKEN=<token>

IMAGE_NAME=ghcr.io/creup-dev/recuento
DOCKER_PLATFORM=linux/amd64
APPLY_MIGRATIONS_ON_DEPLOY=true
```

Importante:

- `COMPOSE_APP_SERVICE` y `COMPOSE_POSTGRES_SERVICE` son nombres de servicio de Compose, no `container_name`.
- Si usas PostgreSQL externo, normalmente no necesitas `COMPOSE_POSTGRES_SERVICE`.
- Si ya hiciste `docker login ghcr.io` en local, no pongas `GHCR_USERNAME` ni `GHCR_TOKEN` en `.env`.
- `NUXT_SITE_URL` y la configuración de Umami se inyectan en el build local de Nuxt. Si solo las defines en el `.env` del VPS, la imagen ya saldrá sin esa configuración.

En el VPS:

- `docker-compose.yml`
- `.env`
- directorio persistente para banners

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
```

Opcionales:

```env
NUXT_UMAMI_HOST=https://umami.example.com
NUXT_UMAMI_ID=<site-id>
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
4. hace `docker compose pull`
5. ejecuta migraciones si están activadas
6. recrea contenedores

## Verificar

En el VPS:

```bash
cd /ruta/del/compose
docker compose ps
docker compose logs --tail 100
curl http://127.0.0.1:3000/health
```

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

Los banners desaparecen:

- falta `APP_BANNERS_DIR`
- el bind mount no existe
- permisos incorrectos en el directorio persistente
- el volumen no está montado en `/app/data/banners`

`/health` devuelve 404 públicamente:

- es correcto; debe consultarse de forma local, no a través de NGINX
