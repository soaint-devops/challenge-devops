# Challenge DevOps

Reto para que un/una DevOps ponga en marcha una aplicación mínima y prepare CI/CD. La app arranca con configuraciones incompletas; hay que diagnosticarlas (logs/UI) y corregirlas para obtener el código final.

## Contenido
- `app/`: API Node.js con front ligero (HTML/JS estático) servido desde Express.
  - Endpoints: `/health`, `/api/message`, `/api/login` (devuelve token), `/api/todos` (GET con estado de tareas automáticas), `/api/complete`.
  - Las credenciales se generan al vuelo en cada arranque y se imprimen en logs; no están hardcodeadas en el código.
- `docker-compose.yml`: orquestación para desarrollo local (puerto 3000 en host). Arranca con configuraciones incompletas para que el/la candidato/a las arregle.
- `azure-pipelines.yml`: pipeline de Azure DevOps ya dividido en stages/jobs para código, infra, tests y build+smoke; puede ajustarse si se cambia la app.

## Requisitos de entorno
- Variables: `PORT` (por defecto 8080 en el contenedor), `CREDENTIALS_SECRET` (para generar credenciales de login por arranque), `COMPLETION_SECRET` (para generar el código final) y otras relacionadas al servicio (consulta UI/logs para pistas). Puedes copiar `app/.env.example` a `app/.env` si lo deseas.
- Exposición: el contenedor usa 8080, publicado en host como 3000 (`http://localhost:3000`).

## Cómo levantarlo (rama `main`)
```bash
docker compose up --build
```

Para simular el pipeline en local (requiere definir CHALLENGE_IMAGE_LABEL, NET_ALIAS y MESSAGE en tu entorno):
```bash
# Ejecuta las etapas manualmente en tu máquina (lint, migrate, build, healthcheck) o adapta el pipeline YAML a tu entorno.
```

## Flujo de uso
- Al arrancar la app se imprimen en logs unas credenciales aleatorias (usuario/clave); cambian en cada arranque.
- Tras login, verás tareas automáticas (no se pueden marcar a mano). Cada una refleja un problema de configuración (Dockerfile, red/alias de compose, migración, mensaje). Usa logs/UI para identificar qué falta y corrígelo.
- Sólo cuando todas están en `done`, se habilita el botón de “Obtener código de finalización” (o POST `/api/complete` con token Bearer). El código es único por franja de 15 minutos y lleva un HMAC con `COMPLETION_SECRET` para validarlo externamente.

## Qué debe arreglar el/la candidato/a
- Identificar las configuraciones faltantes (logs/UI) en Dockerfile, Compose/red, migración y variables de entorno, y aplicarlas hasta que las tareas se marquen como `done`.
- Ajustar el pipeline `azure-pipelines.yml` si es necesario (por cambios en la app) y asegurar que las etapas npm/terraform/tests/build/smoke pasen.
- Los tests unitarios ya están definidos; no agregues nuevos. Deben pasar tal como están integrados en el pipeline (npm test).
- Levantar con `docker compose up --build`, iniciar sesión con las credenciales de los logs, comprobar que las tareas están en verde y obtener el código final.
- Ajustar el pipeline de Azure DevOps (`azure-pipelines.yml`) para que todas las etapas pasen (variables requeridas y build de la imagen).

## Validación externa del código
- El código devuelto por `/api/complete` tiene el formato `DONE-YYYY-MM-DD-HHQQ-<palabra>-<serial>` donde `<serial>` son 5 bloques tipo “licencia” (base32 sin I/O/1/0) derivados de un HMAC-SHA256 con `COMPLETION_SECRET` sobre el slot `YYYY-MM-DD-HHQQ`.
- Para validar externamente: toma el slot (fecha y franja de 15 minutos en UTC), calcula `hmac = HMAC-SHA256(COMPLETION_SECRET, slot)`, convierte el digest a base32 (alfabeto A..Z sin I/O + 2..9) y forma 5 bloques de 5; debe coincidir con el serial.
