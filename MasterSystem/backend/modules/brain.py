from backend.core.event_bus import bus, Event, EventType
from loguru import logger
import asyncio
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

class BrainModule:
    def __init__(self):
        bus.subscribe(EventType.VOICE_COMMAND_DETECTED, self.process_command)
        bus.subscribe(EventType.USER_IDENTIFIED, self.greet_user)
        bus.subscribe(EventType.USER_EMOTION_DETECTED, self.update_emotion_context)
        bus.subscribe(EventType.TTS_SPEAKING_START, self._on_speaking_start)
        bus.subscribe(EventType.TTS_SPEAKING_END, self._on_speaking_end)
        
        self.emotion_context = "Neutral"
        self.is_speaking = False
        self.api_key = os.getenv("GOOGLE_API_KEY")
        
        # Initialize Gemini AI
        if self.api_key and len(self.api_key) > 10:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel('gemini-2.0-flash')
                self.chat = self.model.start_chat(history=[])
                
                # System prompt optimized for voice responses
                self.system_prompt = (
                    "You are FRIDAY, an advanced AI assistant similar to J.A.R.V.I.S. "
                    "You are efficient, intelligent, and speak naturally. "
                    "IMPORTANT: Keep ALL responses SHORT and CONVERSATIONAL - "
                    "suitable for spoken voice output. Maximum 2-3 sentences. "
                    "Address the user as 'Sir'. Be helpful but concise."
                )
                
                self.has_llm = True
                logger.info("Brain Module: Gemini AI Online")
            except Exception as e:
                self.has_llm = False
                logger.error(f"Brain Module: Failed to initialize Gemini - {e}")
        else:
            self.has_llm = False
            logger.warning("Brain Module: Gemini API Key missing. Falling back to simple logic.")

        logger.info("Brain Module Initialized")

    async def _on_speaking_start(self, event: Event):
        self.is_speaking = True
        
    async def _on_speaking_end(self, event: Event):
        self.is_speaking = False

    async def update_emotion_context(self, event: Event):
        self.emotion_context = event.data.get("emotion", "Neutral")

    async def greet_user(self, event: Event):
        user = event.data.get("user", "Sir")
        if self.has_llm:
            try:
                response = await self._query_llm(f"The user {user} just appeared. Give a brief, warm greeting.")
                await self._respond(response)
            except Exception as e:
                logger.error(f"Greeting error: {e}")
                await self._respond(f"Welcome back, {user}.")
        else:
            await self._respond(f"Identity confirmed. Welcome back, {user}.")

    async def process_command(self, event: Event):
        # Skip processing if currently speaking
        if self.is_speaking:
            logger.debug("Brain: Skipping command - currently speaking")
            return
            
        text = event.data.get("text", "").strip()
        if not text:
            return
            
        logger.info(f"Brain processing: {text}")

        if not self.has_llm:
            # Fallback Logic
            if "hello" in text.lower():
                response = "Greetings, Sir."
            elif "status" in text.lower():
                response = "All systems operational. However, my AI core is offline."
            else:
                response = "I heard you, but my higher brain functions are currently offline."
            await self._respond(response)
            return

        # LLM Logic with emotion context
        prompt = f"[User's current emotion: {self.emotion_context}]\nUser says: {text}"
        
        try:
            response_text = await self._query_llm(prompt)
            await self._respond(response_text)
        except Exception as e:
            logger.error(f"LLM Error: {e}")
            await self._respond("I'm experiencing some processing difficulties, Sir. Please try again.")

    async def _query_llm(self, prompt: str) -> str:
        """Query Gemini with retry logic"""
        max_retries = 2
        
        for attempt in range(max_retries):
            try:
                # Combine system prompt with user prompt
                full_prompt = f"{self.system_prompt}\n\n{prompt}"
                
                response = await asyncio.to_thread(
                    self.chat.send_message, 
                    full_prompt
                )
                
                # Clean and return response text
                response_text = response.text.strip()
                # Remove any asterisks or markdown formatting for clean speech
                response_text = response_text.replace("*", "").replace("_", "")
                
                return response_text
                
            except Exception as e:
                logger.warning(f"LLM attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(0.5)
        
        return "I apologize, Sir. I'm having trouble processing that request."

    async def _respond(self, text: str):
        logger.info(f"Brain Response: {text}")
        await bus.publish(Event(EventType.RESPONSE_GENERATED, {"text": text}))

brain_module = BrainModule()
