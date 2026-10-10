# Ficha para top.gg

Textos listos para copiar en el formulario de [top.gg/bot/new](https://top.gg/bot/new).
La aprobación la decide el equipo de revisión de top.gg: este archivo solo prepara la solicitud.

## Datos del formulario

| Campo | Valor |
|---|---|
| Client ID | `1512249712739221565` (cámbialo si usas otra aplicación) |
| Prefijo | `&` (configurable por servidor con `&config prefix`). También responde a `/` |
| Comando de ayuda | `/help`, `/ayuda` o `&ayuda` |
| Etiquetas sugeridas | Moderation · Economy · Music · Utility · Fun |
| Idioma | Español |
| Enlace de invitación | Ver abajo |
| Servidor de soporte | `<TU_ENLACE_DE_INVITACIÓN_AL_SERVIDOR_DE_SOPORTE>` |
| Código fuente | https://github.com/AlejandroDukesini/DC-CHATBOT |

## Enlace de invitación

```text
https://discord.com/oauth2/authorize?client_id=1512249712739221565&scope=bot+applications.commands&permissions=1099783334918
```

Antes de enviarlo, en el [Developer Portal](https://discord.com/developers/applications) → **Bot**:
**Public Bot** activado y **Requires OAuth2 Code Grant** desactivado. Con el Code Grant activado, el enlace falla y top.gg rechaza el bot.

## Descripción corta

```text
Investiga con fuentes verificables, modera con jerarquía de roles, gestiona una economía con bolsa, pone radio y da la bienvenida con banners. Todo en español, con / y con prefijo.
```

## Descripción larga

```markdown
# DC Chatbot

Un bot en español para comunidades que quieren **moderación seria**, **economía divertida** y **respuestas con fuentes**.
Empieza con `/help`.

## 🔎 Investigador con fuentes
`/investigar agujero negro`: busca en Wikipedia, contrasta con Wikidata y añade artículos académicos de Crossref.
Cada frase del resumen sale textual de una fuente citada. No inventa.

## 🛡️ Moderación
`/ban` `/kick` `/silenciar` `/advertir` `/purgar` `/casos`. Silencio automático al llegar al límite de advertencias
y registro en un canal de logs. Respeta la jerarquía de roles de Discord.

## 💰 Economía y bolsa
`/diario` con rachas, `/trabajar`, tienda con mejoras, `/apostar` y un mercado de 4 acciones que cambia cada 10 minutos.

## 📻 Radio
`/radio chillhop` o cualquier enlace de streaming en tu canal de voz.

## 🖼️ Bienvenidas
Banner generado con el avatar del nuevo miembro, mensaje personalizable y rol automático.

## ⚙️ Configuración
`/config` para el prefijo, los canales, el rol automático, el color del banner y más.

---
🌋 *No puedo sobrevolar volcanes, pero todo lo de arriba sí lo hago.*
```

## Permisos que solicita y por qué

| Permiso | Para qué |
|---|---|
| Ver canales, Enviar mensajes, Insertar enlaces, Adjuntar archivos | Responder con embeds e imágenes (banners) |
| Leer el historial de mensajes | Responder a mensajes y purgar |
| Gestionar mensajes | `purgar` |
| Expulsar / Banear miembros | `kick`, `ban`, `unban` |
| Aislar temporalmente a miembros | `silenciar` y silencio automático por advertencias |
| Gestionar roles | Rol automático de bienvenida |
| Conectar, Hablar | Radio |

No solicita **Administrador**.

## Intents privilegiados

- **Message Content**: comandos con prefijo (`&ayuda`). Los slash commands funcionan sin él.
- **Server Members**: bienvenidas, rol automático y búsqueda de miembros por nombre.

Discord exige verificar el bot al llegar a 100 servidores (se puede solicitar desde 75) y justificar estos intents en esa verificación.
