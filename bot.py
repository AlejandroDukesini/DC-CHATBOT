import discord
from discord.ext import commands
import asyncio
import json
import os
from datetime import datetime
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Cargar variables de entorno desde archivo .env
load_dotenv()

# Configuración de tokens y claves API (cargados desde archivo .env)
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GROK_API_KEY = os.getenv("GROK_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Configuración del bot
COMMAND_PREFIX = "&"

# CONFIGURACIÓN DE INTENTS DEFINITIVA
# NOTA: Estos intents privilegiados deben estar habilitados en:
# https://discord.com/developers/applications/[TU_APP]/bot
# En la sección "Privileged Gateway Intents" activa:
# - MESSAGE CONTENT INTENT (Vital para que el bot lea mensajes)
# - SERVER MEMBERS INTENT (Para información de miembros)
# - PRESENCE INTENT (Para estado de usuarios)
BOT_INTENTS = discord.Intents.default()
BOT_INTENTS.message_content = True  # CRUCIAL: Para leer contenido de mensajes
BOT_INTENTS.members = True  # Para acceder a información de miembros del servidor
BOT_INTENTS.presences = True  # Para acceder a estado/presencia de usuarios
BOT_INTENTS.guilds = True  # Para eventos de servidor
BOT_INTENTS.messages = True  # Para recibir mensajes

# Inicialización del bot
bot = commands.Bot(command_prefix=COMMAND_PREFIX, intents=BOT_INTENTS)

# Eliminar comando help por defecto de Discord para evitar conflicto
bot.remove_command('help')

# Almacenamiento en memoria para respuestas completas
response_storage: Dict[str, Dict[str, Any]] = {}

# Clases para manejar las APIs de IA
class AIProvider:
    """Clase base para proveedores de IA"""
    
    def __init__(self, name: str, api_key: str):
        self.name = name
        self.api_key = api_key
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Inicializa el cliente de la API específica"""
        pass
    
    async def generate_text(self, prompt: str, **kwargs) -> str:
        """Genera texto usando la API del proveedor"""
        raise NotImplementedError
    
    async def generate_image(self, prompt: str, **kwargs) -> str:
        """Genera imagen usando la API del proveedor"""
        raise NotImplementedError
    
    def is_available(self) -> bool:
        """Verifica si el proveedor está disponible"""
        return self.api_key is not None and self.api_key != ""

class OpenAIProvider(AIProvider):
    """Proveedor OpenAI (ChatGPT)"""
    
    def _initialize_client(self):
        try:
            import openai
            self.client = openai.AsyncOpenAI(api_key=self.api_key)
        except ImportError:
            print("ERROR: La librería openai no está instalada. Ejecuta: pip install openai")
            self.client = None
        except Exception as e:
            print(f"ERROR al inicializar OpenAI: {e}")
            self.client = None
    
    async def generate_text(self, prompt: str, **kwargs) -> str:
        if not self.client:
            raise Exception("Cliente OpenAI no inicializado")
        
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Eres un asistente útil y conciso."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            if "insufficient_quota" in str(e).lower() or "quota" in str(e).lower():
                raise Exception("Créditos de OpenAI agotados. Contacta al administrador.")
            raise Exception(f"Error en OpenAI: {str(e)}")
    
    async def generate_image(self, prompt: str, **kwargs) -> str:
        if not self.client:
            raise Exception("Cliente OpenAI no inicializado")
        
        try:
            response = await self.client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size="1024x1024",
                quality="standard",
                n=1,
            )
            return response.data[0].url
        except Exception as e:
            if "insufficient_quota" in str(e).lower() or "quota" in str(e).lower():
                raise Exception("Créditos de OpenAI agotados. Contacta al administrador.")
            raise Exception(f"Error en OpenAI Image: {str(e)}")

class GrokProvider(AIProvider):
    """Proveedor xAI (Grok)"""
    
    def _initialize_client(self):
        try:
            import openai
            self.client = openai.AsyncOpenAI(
                api_key=self.api_key,
                base_url="https://api.x.ai/v1"
            )
        except ImportError:
            print("ERROR: La librería openai no está instalada. Ejecuta: pip install openai")
            self.client = None
        except Exception as e:
            print(f"ERROR al inicializar Grok: {e}")
            self.client = None
    
    async def generate_text(self, prompt: str, **kwargs) -> str:
        if not self.client:
            raise Exception("Cliente Grok no inicializado")
        
        try:
            response = await self.client.chat.completions.create(
                model="grok-beta",
                messages=[
                    {"role": "system", "content": "Eres un asistente útil y conciso."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            if "insufficient_quota" in str(e).lower() or "quota" in str(e).lower():
                raise Exception("Créditos de Grok agotados. Contacta al administrador.")
            raise Exception(f"Error en Grok: {str(e)}")
    
    async def generate_image(self, prompt: str, **kwargs) -> str:
        # Grok actualmente no tiene generación de imágenes
        raise Exception("Grok no soporta generación de imágenes")

class GeminiProvider(AIProvider):
    """Proveedor Google Gen AI (Gemini)"""
    
    def _initialize_client(self):
        try:
            from google import genai
            self.client = genai.Client(api_key=self.api_key)
        except ImportError:
            print("ERROR: La librería google-genai no está instalada. Ejecuta: pip install google-genai")
            self.client = None
        except Exception as e:
            print(f"ERROR al inicializar Gemini: {e}")
            self.client = None
    
    async def generate_text(self, prompt: str, **kwargs) -> str:
        if not self.client:
            raise Exception("Cliente Gemini no inicializado")
        
        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model="gemini-2.0-flash-exp",
                contents=prompt
            )
            return response.text
        except Exception as e:
            if "quota" in str(e).lower() or "limit" in str(e).lower():
                raise Exception("Créditos de Gemini agotados. Contacta al administrador.")
            raise Exception(f"Error en Gemini: {str(e)}")
    
    async def generate_image(self, prompt: str, **kwargs) -> str:
        # Gemini con la nueva librería google.genai no soporta generación de imágenes directamente
        raise Exception("Gemini no soporta generación de imágenes directamente. Usa &imagen con OpenAI DALL-E.")

# Inicialización de proveedores
providers = {
    "chatgpt": OpenAIProvider("ChatGPT", OPENAI_API_KEY),
    "grok": GrokProvider("Grok", GROK_API_KEY),
    "gemini": GeminiProvider("Gemini", GEMINI_API_KEY)
}

current_provider = "chatgpt"  # Proveedor por defecto

# Funciones auxiliares
def summarize_response(text: str, max_length: int = 300) -> str:
    """Genera un resumen de la respuesta para el embed"""
    if len(text) <= max_length:
        return text
    
    # Buscar el último punto completo antes del límite
    truncated = text[:max_length]
    last_period = truncated.rfind('.')
    
    if last_period > max_length * 0.5:  # Si el punto está al menos a la mitad
        return truncated[:last_period + 1] + "..."
    
    return truncated + "..."

def create_response_embed(summary: str, provider: str, original_length: int) -> discord.Embed:
    """Crea un embed con la respuesta resumida"""
    color_map = {
        "chatgpt": 0x00A8FF,  # Azul
        "grok": 0x000000,     # Negro
        "gemini": 0x4285F4     # Azul Google
    }
    
    embed = discord.Embed(
        title=f"🤖 Respuesta de {provider.capitalize()}",
        description=summary,
        color=color_map.get(provider, 0x00A8FF),
        timestamp=datetime.now()
    )
    
    embed.add_field(
        name="📊 Información",
        value=f"Longitud original: {original_length} caracteres\nProveedor: {provider.capitalize()}",
        inline=False
    )
    
    embed.set_footer(text=f"Solicitado por {current_provider}")
    
    return embed

def create_full_response_embed(full_text: str, provider: str) -> discord.Embed:
    """Crea un embed con la respuesta completa"""
    color_map = {
        "chatgpt": 0x00A8FF,
        "grok": 0x000000,
        "gemini": 0x4285F4
    }
    
    # Discord tiene un límite de 4096 caracteres para embed descriptions
    # Si el texto es muy largo, lo dividimos en múltiples fields
    embed = discord.Embed(
        title=f"📖 Respuesta Completa de {provider.capitalize()}",
        color=color_map.get(provider, 0x00A8FF),
        timestamp=datetime.now()
    )
    
    # Dividir el texto en chunks si es necesario
    chunk_size = 1000
    chunks = [full_text[i:i+chunk_size] for i in range(0, len(full_text), chunk_size)]
    
    for i, chunk in enumerate(chunks):
        if i < 25:  # Discord limita a 25 fields por embed
            embed.add_field(
                name=f"Parte {i+1}" if len(chunks) > 1 else "Respuesta",
                value=chunk[:1024],  # Cada field tiene máximo 1024 caracteres
                inline=False
            )
    
    return embed

# Eventos del bot
@bot.event
async def on_ready():
    """Evento cuando el bot está listo"""
    print(f"✅ Bot conectado como {bot.user.name}")
    print(f"✅ Proveedores disponibles:")
    for name, provider in providers.items():
        status = "✅ Disponible" if provider.is_available() else "❌ No configurado"
        print(f"   - {name.capitalize()}: {status}")
    
    # Establecer estado del bot
    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.watching,
            name=f"&pregunta | Proveedor: {current_provider}"
        )
    )

@bot.event
async def on_command_error(ctx, error):
    """Manejo global de errores"""
    if isinstance(error, commands.CommandNotFound):
        return
    elif isinstance(error, commands.MissingRequiredArgument):
        await ctx.send("❌ Faltan argumentos requeridos. Usa &help para ver la ayuda.")
    elif isinstance(error, commands.BadArgument):
        await ctx.send("❌ Argumento inválido. Verifica el formato del comando.")
    else:
        print(f"Error no manejado: {error}")
        await ctx.send(f"❌ Ocurrió un error: {str(error)}")

# Comandos del bot
@bot.command(name="pregunta")
async def pregunta(ctx, provider: Optional[str] = None, *, text: Optional[str] = None):
    """
    Cambia el proveedor de IA y responde una pregunta.
    Uso: &pregunta [proveedor] [texto]
    Proveedores: chatgpt, grok, gemini
    """
    global current_provider
    
    # Caso 1: Solo se proporciona el proveedor (cambiar proveedor)
    if provider and not text:
        provider_lower = provider.lower()
        if provider_lower in providers:
            if not providers[provider_lower].is_available():
                await ctx.send(f"❌ El proveedor {provider_lower} no está configurado. Verifica las API keys.")
                return
            
            current_provider = provider_lower
            await bot.change_presence(
                activity=discord.Activity(
                    type=discord.ActivityType.watching,
                    name=f"&pregunta | Proveedor: {current_provider}"
                )
            )
            await ctx.send(f"✅ Proveedor cambiado a {provider_lower.capitalize()}")
        else:
            available = ", ".join(providers.keys())
            await ctx.send(f"❌ Proveedor inválido. Proveedores disponibles: {available}")
        return
    
    # Caso 2: Se proporciona proveedor y texto (usar proveedor específico para esta pregunta)
    if provider and text:
        provider_lower = provider.lower()
        if provider_lower not in providers:
            available = ", ".join(providers.keys())
            await ctx.send(f"❌ Proveedor inválido. Proveedores disponibles: {available}")
            return
        
        if not providers[provider_lower].is_available():
            await ctx.send(f"❌ El proveedor {provider_lower} no está configurado. Verifica las API keys.")
            return
        
        selected_provider = provider_lower
    # Caso 3: Solo se proporciona texto (usar proveedor actual)
    elif text:
        selected_provider = current_provider
    else:
        await ctx.send("❌ Debes proporcionar un texto. Uso: &pregunta [proveedor] [texto]")
        return
    
    # Enviar mensaje de "pensando"
    thinking_message = await ctx.send(f"🤔 Procesando con {selected_provider.capitalize()}...")
    
    try:
        # Generar respuesta
        ai_provider = providers[selected_provider]
        response = await ai_provider.generate_text(text)
        
        # Crear resumen y embed
        summary = summarize_response(response)
        embed = create_response_embed(summary, selected_provider, len(response))
        
        # Crear botón para ver respuesta completa
        view = ResponseView(response, selected_provider, ctx.author.id)
        
        # Guardar respuesta en almacenamiento
        message_id = str(thinking_message.id)
        response_storage[message_id] = {
            "full_response": response,
            "provider": selected_provider,
            "user_id": ctx.author.id,
            "timestamp": datetime.now().isoformat()
        }
        
        # Editar mensaje original con el embed y botones
        await thinking_message.edit(content=None, embed=embed, view=view)
        
    except Exception as e:
        await thinking_message.edit(content=f"❌ Error al generar respuesta: {str(e)}")

@bot.command(name="imagen")
async def imagen(ctx, *, text: Optional[str] = None):
    """
    Genera una imagen usando Gemini.
    Uso: &imagen [descripción de imagen]
    """
    if not text:
        await ctx.send("❌ Debes proporcionar una descripción. Uso: &imagen [descripción]")
        return
    
    # Verificar si Gemini está disponible
    if not providers["gemini"].is_available():
        await ctx.send("❌ Gemini no está configurado. Verifica la API key de Google.")
        return
    
    # Enviar mensaje de "pensando"
    thinking_message = await ctx.send("🎨 Generando imagen con Gemini...")
    
    try:
        # Intentar generar imagen con Gemini
        ai_provider = providers["gemini"]
        
        # NOTA: Gemini no genera imágenes directamente
        # TODO: INTERVENCIÓN HUMANA - Para generación de imágenes, descomenta la siguiente línea
        # y usa OpenAI DALL-E en su lugar:
        
        # Alternativa: Usar OpenAI para generación de imágenes
        if providers["chatgpt"].is_available():
            image_url = await providers["chatgpt"].generate_image(text)
            
            # Crear embed con la imagen
            embed = discord.Embed(
                title="🖼️ Imagen Generada",
                description=f"Prompt: {text}",
                color=0x00A8FF,
                timestamp=datetime.now()
            )
            embed.set_image(url=image_url)
            embed.set_footer(text="Generado con DALL-E (OpenAI)")
            
            await thinking_message.edit(content=None, embed=embed)
        else:
            await thinking_message.edit(
                content="❌ La generación de imágenes requiere OpenAI DALL-E. "
                       "Gemini no soporta generación directa de imágenes. "
                       "Configura OPENAI_API_KEY para usar esta función."
            )
        
    except Exception as e:
        await thinking_message.edit(content=f"❌ Error al generar imagen: {str(e)}")

@bot.command(name="help")
async def help_command(ctx):
    """Muestra la ayuda del bot"""
    embed = discord.Embed(
        title="📚 Ayuda del Bot Multi-IA",
        description="Bot de Discord que integra ChatGPT, Grok y Gemini",
        color=0x00A8FF,
        timestamp=datetime.now()
    )
    
    embed.add_field(
        name="&pregunta [proveedor] [texto]",
        value="Cambia el proveedor y responde una pregunta.\n"
              "Si solo das el proveedor, lo cambia como predeterminado.\n"
              "Si solo das el texto, usa el proveedor actual.\n"
              "Proveedores: chatgpt, grok, gemini",
        inline=False
    )
    
    embed.add_field(
        name="&imagen [texto]",
        value="Genera una imagen usando DALL-E (requiere OpenAI configurado).",
        inline=False
    )
    
    embed.add_field(
        name="&proveedores",
        value="Muestra el estado de los proveedores de IA.",
        inline=False
    )
    
    embed.add_field(
        name="&help",
        value="Muestra este mensaje de ayuda.",
        inline=False
    )
    
    embed.set_footer(text=f"Proveedor actual: {current_provider}")
    
    await ctx.send(embed=embed)

@bot.command(name="proveedores")
async def proveedores_command(ctx):
    """Muestra el estado de los proveedores"""
    embed = discord.Embed(
        title="🔧 Estado de Proveedores",
        color=0x00A8FF,
        timestamp=datetime.now()
    )
    
    for name, provider in providers.items():
        status = "✅ Disponible" if provider.is_available() else "❌ No configurado"
        current = " (Actual)" if name == current_provider else ""
        embed.add_field(
            name=f"{name.capitalize()}{current}",
            value=status,
            inline=True
        )
    
    await ctx.send(embed=embed)

# View para botones interactivos
class ResponseView(discord.ui.View):
    """View con botones para interactuar con la respuesta"""
    
    def __init__(self, full_response: str, provider: str, user_id: int):
        super().__init__(timeout=None)
        self.full_response = full_response
        self.provider = provider
        self.user_id = user_id
    
    @discord.ui.button(label="Ver Respuesta Completa", style=discord.ButtonStyle.primary, emoji="📖")
    async def show_full_response(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Muestra la respuesta completa"""
        # Verificar que el usuario sea el mismo que hizo la pregunta
        if interaction.user.id != self.user_id:
            await interaction.response.send_message(
                "❌ Solo el usuario que hizo la pregunta puede ver la respuesta completa.",
                ephemeral=True
            )
            return
        
        # Crear embed con respuesta completa
        embed = create_full_response_embed(self.full_response, self.provider)
        
        # Desactivar el botón después de usarlo
        button.disabled = True
        button.label = "Respuesta Completa Mostrada"
        
        await interaction.response.edit_message(embed=embed, view=self)
    
    @discord.ui.button(label="Copiar Texto", style=discord.ButtonStyle.secondary, emoji="📋")
    async def copy_text(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Envía el texto completo para copiar"""
        if interaction.user.id != self.user_id:
            await interaction.response.send_message(
                "❌ Solo el usuario que hizo la pregunta puede copiar el texto.",
                ephemeral=True
            )
            return
        
        # Discord no permite copiar al portapapeles directamente
        # Enviamos el texto en un mensaje efímero para que el usuario pueda copiarlo
        await interaction.response.send_message(
            f"```\n{self.full_response}\n```",
            ephemeral=True
        )

# Punto de entrada
if __name__ == "__main__":
    # Verificar que el token de Discord esté configurado
    if not DISCORD_TOKEN or DISCORD_TOKEN == "None":
        print("❌ ERROR: DISCORD_TOKEN no está configurado.")
        print("TODO: INTERVENCIÓN HUMANA - Configura el token de Discord en las variables de entorno o directamente en el código.")
        print("Puedes obtener tu token en: https://discord.com/developers/applications")
    else:
        print("🚀 Iniciando bot...")
        bot.run(DISCORD_TOKEN)
