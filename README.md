# 🤖 DC Chatbot

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-14-5865F2?logo=discord&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Netlify](https://img.shields.io/badge/Demo-Netlify-00C7B7?logo=netlify&logoColor=white)

**Bot de Discord que investiga con fuentes verificables, modera, administra la economía del servidor, pone radio y da la bienvenida con banners, con una demo web interactiva que ejecuta el mismo código.**

🔗 **Demo online:** _pendiente del primer despliegue en Netlify (ver [Despliegue](#-despliegue-de-la-demo-en-netlify))_

[Funcionalidades](#-funcionalidades) • [Cómo se usa](#-cómo-usar-cada-función) • [Demo vs. local](#-demo-web-vs-instalación-local) • [Arquitectura](#-arquitectura) • [Instalación](#-instalación-del-bot) • [Despliegue](#-despliegue-de-la-demo-en-netlify) • [Seguridad](#-seguridad)

</div>

---

## ✨ Funcionalidades

| Módulo | Qué hace | Comandos principales |
|---|---|---|
| 🔎 **Investigador propio** | Busca en Wikipedia, se reformula solo si el resultado no encaja, salta a la versión en tu idioma vía Wikidata, contrasta con Wikidata y añade literatura académica de Crossref. El resumen es **extractivo**: cada frase es textual de una fuente citada, así que no inventa. Sin claves ni LLM. | `investigar` |
| 🛡️ **Moderación** | Banear, desbanear, expulsar, silenciar (timeout), advertir con **silencio automático** al llegar al límite, purgar mensajes y registro de casos en un canal de logs. Respeta la jerarquía de roles de Discord. | `ban` `unban` `kick` `silenciar` `advertir` `advertencias` `perdonar` `purgar` `casos` |
| 💰 **Economía y finanzas** | Cartera y banco, recompensa diaria con rachas, trabajo cada hora, pagos, tienda con mejoras reales, apuestas y un **mercado de 4 acciones** cuyos precios cambian cada 10 minutos. | `balance` `diario` `trabajar` `depositar` `retirar` `pagar` `tienda` `comprar` `inventario` `ranking` `apostar` `mercado` `invertir` `vender` `portafolio` |
| 📻 **Radio** | Reproduce emisoras recomendadas o **cualquier enlace de streaming** en tu canal de voz. | `radio` `radios` `detener` `sonando` |
| 🖼️ **Bienvenidas y banners** | Banner generado con Canvas (avatar, nombre, nº de miembro) en el canal de bienvenida, mensaje personalizable, **rol automático** y anuncios con formato. | `banner` `anuncio` |
| ⚙️ **Configuración** | Prefijo, canales de bienvenida y logs, rol automático, color y estilo del banner, límite de advertencias, recompensa diaria, moneda y proveedor de IA. Todo validado y guardado por servidor. | `config` |
| 🤖 **IA de terceros** (opcional) | ChatGPT, Grok y Gemini con resumen y botones "Ver completa / Copiar"; generación de imágenes con OpenAI. Solo con tus API keys. | `pregunta` `imagen` `proveedores` |

Todos los comandos funcionan **con prefijo** (`&` por defecto) **y como slash command** (`/`). `&ayuda <comando>` explica cualquiera de ellos.

---

## 🧭 Cómo usar cada función

> En los ejemplos se usa el prefijo `&`. Con slash commands escribe `/` y Discord te guía con las opciones.

### 1. Primera configuración (administradores)

Necesitas el permiso **Gestionar servidor**.

```text
&config                                  → muestra todos los ajustes y su valor actual
&config welcomeChannel #bienvenida       → canal donde se publican los banners
&config welcomeMessage ¡Hola {user}! Bienvenid@ a {server}, eres el miembro {count}
&config autoRole @Novato                 → rol que se asigna al entrar
&config logChannel #logs-moderacion      → registro automático de sanciones
&config bannerColor #EB459E              → color del banner
&config bannerTheme aurora               → aurora | noche | solido
&config warnLimit 3                      → advertencias antes del silencio automático (0 = desactivado)
&config prefix !                         → cambia el prefijo (después: !ayuda)
```

Para desactivar un canal o rol usa `ninguno`, por ejemplo `&config autoRole ninguno`.

### 2. Investigar un tema

```text
&investigar agujero negro
&investigar ¿qué es la fotosíntesis?
&investigar quantum computing
```

La respuesta incluye las frases más relevantes con sus citas `[1]`, `[2]`, las fuentes (y si se contrastaron con Wikidata), artículos académicos con DOI, los pasos que siguió el agente y un nivel de confianza.

### 3. Moderar

```text
&advertir @usuario spam de enlaces       → al llegar a warnLimit, silencio automático de 1 h
&advertencias @usuario                   → lista sus advertencias activas
&silenciar @usuario 10m lenguaje ofensivo → duración: 30s, 10m, 2h, 1d (máx. 28d)
&kick @usuario flood
&ban @usuario spam reiterado
&unban NombreDeUsuario                   → o su ID
&purgar 20                               → borra los últimos 20 mensajes
&casos                                   → últimas 10 acciones de moderación
```

El bot comprueba los **permisos de Discord** de quien ejecuta el comando y la **jerarquía de roles**: nadie puede sancionar a alguien con un rol igual o superior al suyo, ni al dueño, ni a quien esté por encima del rol del bot.

### 4. Economía y bolsa

```text
&diario            → recompensa diaria (+25 por cada día de racha, hasta 7)
&trabajar          → una vez por hora
&balance           → cartera, banco, acciones y patrimonio
&depositar todo    &retirar 200
&pagar @usuario 150
&tienda            &comprar portatil   → +25 % en trabajar
&apostar 100 cara
&mercado           → cotizaciones con mini-gráfico de las últimas 2 horas
&invertir nexo 5   &vender nexo todo   &portafolio
&ranking
```

### 5. Radio

Entra en un canal de voz y:

```text
&radios                                          → lista de emisoras
&radio chillhop                                  → emisora recomendada
&radio https://stream.radioparadise.com/mp3-128  → cualquier enlace de streaming
&sonando     &detener
```

### 6. Banners y anuncios

```text
&banner              → vista previa de tu banner de bienvenida
&banner @usuario
&anuncio Torneo el sábado | Inscripciones abiertas en #general. ¡Premio de 5000 🪙!
```

Los banners de bienvenida se envían solos cuando alguien entra, si configuraste `welcomeChannel`.

### 7. IA de terceros (opcional)

```text
&pregunta ¿Qué es un agujero negro?          → usa el proveedor predeterminado
&pregunta gemini resume la relatividad       → elige proveedor para esta pregunta
&pregunta grok                               → cambia el predeterminado (Gestionar servidor)
&imagen un gato astronauta en acuarela
&proveedores
```

---

## 🆚 Demo web vs. instalación local

| | Demo web | Bot instalado |
|---|---|---|
| Motor de comandos y reglas | **El mismo código** (`packages/core`) | **El mismo código** |
| Datos | Ficticios, en tu navegador (`localStorage`), con botón **Reiniciar demo** | Un archivo JSON por servidor en `apps/bot/data/` |
| Moderación | Sobre miembros ficticios | Acciones reales en Discord |
| Investigador | Real, vía Netlify Function | Real, desde el bot |
| Radio | Suena en tu navegador (solo `https://`) | En el canal de voz con FFmpeg (`http` y `https`) |
| Banners | Canvas del navegador, con iniciales | Canvas en Node (`@napi-rs/canvas`), con el avatar real |
| ChatGPT / Grok / Gemini / imágenes | No disponible (requieren claves de pago) | Con tus API keys |
| Slash commands | Solo prefijo | Prefijo y `/comandos` |

La demo **no tiene acceso a Discord, a datos reales ni a ninguna clave**. En ella puedes actuar como *Ana (dueña)*, *Leo (moderador)* o *Sam (miembro sin permisos)* para comprobar la autorización, y simular la llegada de miembros nuevos.

---

## 🏗️ Arquitectura

```text
      Discord (gateway)                         Navegador
             │                                       │
   ┌─────────▼──────────┐                 ┌──────────▼──────────┐
   │ apps/bot           │                 │ apps/web            │
   │ discord.js         │                 │ React + Vite        │
   │ adaptador Discord  │                 │ adaptador sandbox   │
   └─────────┬──────────┘                 └──────────┬──────────┘
             │      ┌───────────────────────────┐     │
             └─────►│ packages/core             │◄────┘
                    │ motor de comandos         │
                    │ economía · mercado        │
                    │ moderación · config       │
                    │ banners · radio           │
                    │ agente investigador       │
                    └─────────────┬─────────────┘
                                  │
   data/<servidor>.json   ◄───────┼───────►   localStorage
   (bot local)                    │           (demo, reiniciable)
                                  ▼
             /api/research (Netlify Function, misma lógica)
                                  │
              Wikipedia · Wikidata · Crossref (APIs públicas)
```

**Una lógica, dos adaptadores.** Todo lo que decide *qué pasa* (validar argumentos, comprobar permisos, cooldowns, reglas de economía, jerarquía de moderación, el agente investigador, el dibujo del banner) vive en `packages/core`, sin dependencias. El bot y la demo solo implementan la misma interfaz de adaptador (`resolveMember`, `actions.ban`, `actions.playRadio`, `store.read/write`…) sobre Discord o sobre un servidor ficticio. Los comandos se definen **una sola vez**, y de esa definición salen el prefijo, los slash commands, `&ayuda` y la guía de la web.

Con esto se cumple la condición de no usar base de datos: el bot guarda un JSON por servidor (escritura atómica y cerrojo por servidor) y la demo usa `localStorage`. El mercado de valores no guarda estado: los precios son una función determinista del tiempo.

```text
packages/core/          Lógica compartida (JS puro) + tests
  src/commands/         Definición de los 37 comandos
  src/research/         Agente investigador (fuentes, TF-IDF, manejador HTTP)
  src/engine.js         Parser, permisos, cooldowns, ejecución
apps/bot/               Bot de Discord (discord.js, voz, canvas)
apps/web/               Landing + demo (React, Vite, Tailwind)
netlify/functions/      /api/research
```

---

## 🚀 Instalación del bot

### Requisitos

- **Node.js 20 o superior**
- Una aplicación de Discord con bot
- FFmpeg viene incluido (`ffmpeg-static`); no hay que instalarlo aparte

### 1. Crear el bot en Discord

1. Entra en el [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **General Information**: copia el **Application ID** (`DISCORD_CLIENT_ID`).
3. **Bot** → **Reset Token**: copia el token (`DISCORD_TOKEN`). No lo compartas nunca.
4. En **Bot → Privileged Gateway Intents** activa:
   - ✅ **Message Content Intent** (comandos con prefijo)
   - ✅ **Server Members Intent** (bienvenidas y búsqueda de miembros)

### 2. Instalar y configurar

```bash
git clone https://github.com/AlejandroDukesini/DC-CHATBOT.git
cd DC-CHATBOT
git checkout Beta              # mientras la rama Beta no se fusione en Principal
npm install                    # núcleo + demo web
npm run bot:install            # dependencias del bot
cp .env.example .env           # en Windows: copy .env.example .env
```

### 3. Variables de entorno (`.env`)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Token del bot |
| `DISCORD_CLIENT_ID` | ✅ (para registrar comandos) | Application ID |
| `DISCORD_GUILD_ID` | — | ID de un servidor para registrar los slash commands al instante (sin él se registran globalmente y tardan hasta 1 h) |
| `OPENAI_API_KEY` / `GROK_API_KEY` / `GEMINI_API_KEY` | — | Activan `pregunta` e `imagen` |
| `OPENAI_MODEL` / `GROK_MODEL` / `GEMINI_MODEL` / `OPENAI_IMAGE_MODEL` | — | Cambian el modelo si el proveedor retira el predeterminado (`gpt-4o-mini`, `grok-3-mini`, `gemini-2.5-flash`, `gpt-image-1`) |
| `RESEARCH_CONTACT_EMAIL` | — | Email de contacto que se envía a Wikipedia/Crossref, según su política de uso |
| `BOT_DATA_DIR` | — | Carpeta de datos (por defecto `apps/bot/data`) |

### 4. Registrar los comandos y arrancar

```bash
npm run deploy-commands   # registra los slash commands
npm run bot               # inicia el bot
```

Al arrancar, el bot muestra en la consola un **enlace de invitación** con exactamente los permisos que necesita: ver canales, enviar mensajes, insertar enlaces, adjuntar archivos, leer el historial, gestionar mensajes, expulsar, banear, aislar temporalmente, gestionar roles, conectar y hablar. Ábrelo y elige tu servidor.

> **Importante:** en *Ajustes del servidor → Roles*, sube el rol del bot por encima de los roles que deba moderar o asignar (como el rol automático).

### ¿Dónde mantener el bot encendido 24/7?

Un bot de Discord necesita un proceso siempre activo con una conexión WebSocket abierta, así que **no puede alojarse en Netlify** (que solo ofrece hosting estático y funciones de corta duración). Opciones:

- **Tu PC** mientras esté encendida (gratis).
- **Una VM gratuita** como Oracle Cloud Free Tier, o un **VPS pequeño** (~5 USD/mes). Usa `pm2` o un servicio `systemd` para reiniciarlo solo.

---

## 🌐 Despliegue de la demo en Netlify

La demo es un sitio estático más una función serverless, así que funciona en el **plan gratuito** de Netlify.

1. Sube el repositorio a GitHub (rama `Beta` o `Principal`).
2. En Netlify: **Add new site → Import an existing project → GitHub** y elige `DC-CHATBOT`.
3. Elige la rama. El resto se lee de `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `apps/web/dist`
   - Functions: `netlify/functions`
4. (Opcional) En *Site configuration → Environment variables* añade `RESEARCH_CONTACT_EMAIL`.
5. **Deploy**. Después, pon la URL al inicio de este README.

La demo **no necesita ninguna clave secreta**. Netlify despliega solo cada vez que haces push.

Para probarla en local:

```bash
npm install
npm run dev        # http://localhost:5173 (incluye /api/research)
```

---

## 🧪 Calidad

```bash
npm test           # Vitest: núcleo, función de Netlify, bot y web
npm run lint       # ESLint
npm run build      # build de producción de la demo
```

Qué cubren los tests:

- **Núcleo**:
  - parser y validación;
  - permisos y jerarquía de roles;
  - cooldowns;
  - todas las reglas de economía y bolsa;
  - límite de advertencias;
  - configuración;
  - bienvenida;
  - validación de enlaces de radio (redes privadas, `file://`, credenciales);
  - agente investigador con fuentes simuladas (reformulación, contraste, fallos de red);
  - generación de slash commands.
- **Función de Netlify**: método, validación, caché, y que no se expongan errores internos.
- **Bot**:
  - almacenamiento JSON (atómico, protegido contra *path traversal*, sin carreras);
  - conversión a mensajes de Discord;
  - bloqueo de `@everyone`;
  - generación del banner.
- **Web**:
  - flujos del sandbox (banear, advertir y silenciar, bienvenida, purgar, radio, reinicio, persistencia);
  - renderizado seguro de markdown;
  - landing y demo con Testing Library.

GitHub Actions ejecuta lint, tests y build en cada push a `Principal` o `Beta` y en cada pull request (`.github/workflows/ci.yml`).

---

## 🔒 Seguridad

**Medidas aplicadas**

- `.env` y `token.txt` están fuera del control de versiones; la plantilla es `.env.example`.
- Los errores internos nunca se muestran al usuario: recibe un mensaje genérico y el detalle va al log.
- Permisos comprobados en el núcleo, y los slash commands de moderación están restringidos por defecto con `default_member_permissions`.
- Jerarquía de roles igual que en Discord (incluida la posición del rol del bot).
- `allowedMentions` limitado a usuarios: ningún texto puede notificar a `@everyone`, `@here` ni a roles.
- **Radio**:
  - solo enlaces `http(s)` sin credenciales;
  - se bloquean IPs privadas, locales y de metadatos, tanto en el texto como tras resolver el DNS;
  - FFmpeg se ejecuta con `-protocol_whitelist http,https,tcp,tls`, así que una lista de reproducción no puede abrir `file://`.
- **Investigador**:
  - solo consulta hosts fijos (Wikipedia, Wikidata, Crossref), nunca URLs del usuario;
  - limita la longitud de la consulta y usa timeouts;
  - la Netlify Function limita las peticiones por IP.
- **Demo**:
  - el markdown se renderiza como elementos React, nunca como HTML;
  - solo se aceptan enlaces `http(s)`;
  - cabeceras de seguridad y Content Security Policy en `netlify.toml`.
- **Almacenamiento**: los IDs de servidor se validan antes de construir rutas de archivo.

**Riesgos conocidos**

- El límite por IP de la función es *best effort*: cada instancia serverless tiene el suyo. La caché de la CDN reduce el impacto.
- Un servidor de radio podría redirigir a otra dirección después de la comprobación de DNS. El riesgo se reduce porque FFmpeg solo admite protocolos de red y su salida es audio.
- El investigador es extractivo: resume bien temas enciclopédicos, pero no razona ni responde preguntas que no estén en las fuentes. Muestra un nivel de confianza y las fuentes para que se puedan verificar.

---

## 🔄 Cambios respecto a la versión anterior (Python)

La versión 1 era un único `bot.py` (discord.py) con 4 comandos de IA. La versión 2 la reescribe en Node.js para compartir la lógica con la demo web:

- Se mantienen `pregunta` (con resumen y botones), `imagen` y `proveedores`.
- Errores corregidos:
  - el proveedor de IA era global para todos los servidores y cualquiera podía cambiarlo;
  - el pie del embed mostraba el proveedor en lugar del usuario;
  - `&imagen` exigía la clave de Gemini aunque usaba OpenAI;
  - las respuestas se guardaban sin límite en memoria;
  - "Copiar texto" fallaba con más de 2000 caracteres;
  - se enviaban excepciones crudas al chat.
- Se eliminaron del repositorio `node_modules/` y `.env`.

---

## 📄 Licencia

Proyecto proporcionado tal cual con fines educativos y de desarrollo.
