import speech_recognition as sr
import edge_tts
import pygame
import threading
import asyncio
import os
import tempfile
from loguru import logger
from backend.core.event_bus import bus, Event, EventType

class VoiceModule:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        self.is_listening = False
        self.is_speaking = False  # Track speaking state
        self.main_loop = None  # Store reference to main event loop
        
        # Init Pygame Mixer for playback
        try:
            pygame.mixer.init()
        except Exception as e:
            logger.error(f"Failed to init Pygame Mixer: {e}")

        # Subscribe to events
        bus.subscribe(EventType.RESPONSE_GENERATED, self.handle_response)
        bus.subscribe(EventType.SYSTEM_STARTUP, self.start_listening)
        
        logger.info("Voice Module Initialized (EdgeTTS + Pygame)")

    async def start_listening(self, event: Event):
        logger.info("Starting Voice Input Loop")
        self.is_listening = True
        # Capture the main asyncio loop to use from the thread
        self.main_loop = asyncio.get_running_loop()
        threading.Thread(target=self._listen_loop, daemon=True).start()

    def _listen_loop(self):
        with self.microphone as source:
            self.recognizer.adjust_for_ambient_noise(source, duration=1)
            logger.info("Voice: Calibrated for ambient noise")
            
            while self.is_listening:
                # Skip listening while speaking to prevent self-triggering
                if self.is_speaking:
                    import time
                    time.sleep(0.1)
                    continue
                    
                try:
                    logger.debug("Listening...")
                    audio = self.recognizer.listen(source, timeout=5, phrase_time_limit=10)
                    logger.debug("Processing Audio...")
                    text = self.recognizer.recognize_google(audio)
                    if text and text.strip():
                        logger.info(f"Heard: {text}")
                        # Use the stored main loop reference
                        if self.main_loop:
                            asyncio.run_coroutine_threadsafe(
                                bus.publish(Event(EventType.VOICE_COMMAND_DETECTED, {"text": text})),
                                self.main_loop
                            )
                except sr.WaitTimeoutError:
                    pass 
                except sr.UnknownValueError:
                    pass 
                except Exception as e:
                    logger.error(f"Voice Input Error: {e}")

    async def handle_response(self, event: Event):
        text = event.data.get("text")
        if text:
            await bus.publish(Event(EventType.TTS_SPEAKING_START, {"text": text}))
            # Run TTS - await completion before marking speaking done
            await self._generate_and_play(text)

    async def _generate_and_play(self, text):
        self.is_speaking = True
        try:
            # Professional male voice - natural and clear
            voice = "en-US-ChristopherNeural" 
            communicate = edge_tts.Communicate(text, voice)
            
            # Save to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as fp:
                temp_path = fp.name
            
            await communicate.save(temp_path)
            
            # Play using pygame in a thread to not block
            def play_audio():
                try:
                    pygame.mixer.music.load(temp_path)
                    pygame.mixer.music.play()
                    while pygame.mixer.music.get_busy():
                        pygame.time.wait(100)
                    pygame.mixer.music.unload()
                except Exception as e:
                    logger.error(f"Audio playback error: {e}")
                finally:
                    try:
                        os.remove(temp_path)
                    except:
                        pass
            
            # Run playback in a thread, await its completion
            await asyncio.to_thread(play_audio)
                
        except Exception as e:
            logger.error(f"TTS/Playback Error: {e}")
        finally:
            self.is_speaking = False
            await bus.publish(Event(EventType.TTS_SPEAKING_END))

voice_module = VoiceModule()
