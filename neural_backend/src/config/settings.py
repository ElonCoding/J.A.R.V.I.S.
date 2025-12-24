import os
from typing import Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Application configuration management."""
    
    # Flask Configuration
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    FLASK_APP = os.getenv('FLASK_APP', 'src.app')
    FLASK_PORT = int(os.getenv('FLASK_PORT', 5000))
    FLASK_HOST = os.getenv('FLASK_HOST', '0.0.0.0')
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
    TESTING = os.getenv('TESTING', 'False').lower() == 'true'
    
    # Security Configuration
    SECRET_KEY = os.getenv('SECRET_KEY', 'default-secret-key-change-in-production')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'default-jwt-secret')
    JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 3600))
    
    # Model Configuration
    MODEL_PATH = os.getenv('MODEL_PATH', 'models/neural_model.h5')
    MODEL_CONFIG_PATH = os.getenv('MODEL_CONFIG_PATH', 'models/model_config.json')
    PREPROCESSOR_PATH = os.getenv('PREPROCESSOR_PATH', 'models/preprocessor.pkl')
    
    # Data Paths
    DATA_PATH = os.getenv('DATA_PATH', 'data/')
    TRAIN_DATA_PATH = os.getenv('TRAIN_DATA_PATH', 'data/train/')
    TEST_DATA_PATH = os.getenv('TEST_DATA_PATH', 'data/test/')
    LOGS_PATH = os.getenv('LOGS_PATH', 'logs/')
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads/')
    
    # API Configuration
    RATE_LIMIT = os.getenv('RATE_LIMIT', '100 per hour')
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))  # 16MB
    
    # Speech Processing
    AUDIO_SAMPLE_RATE = int(os.getenv('AUDIO_SAMPLE_RATE', 16000))
    AUDIO_MAX_DURATION = int(os.getenv('AUDIO_MAX_DURATION', 30))  # seconds
    SPEECH_RECOGNITION_LANGUAGE = os.getenv('SPEECH_RECOGNITION_LANGUAGE', 'en-US')
    TTS_ENGINE = os.getenv('TTS_ENGINE', 'pyttsx3')
    
    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'logs/app.log')
    LOG_MAX_BYTES = int(os.getenv('LOG_MAX_BYTES', 10 * 1024 * 1024))  # 10MB
    LOG_BACKUP_COUNT = int(os.getenv('LOG_BACKUP_COUNT', 5))
    
    # Database (optional)
    DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = os.getenv('SQLALCHEMY_TRACK_MODIFICATIONS', 'False').lower() == 'true'
    
    # Monitoring
    ENABLE_METRICS = os.getenv('ENABLE_METRICS', 'true').lower() == 'true'
    METRICS_PORT = int(os.getenv('METRICS_PORT', 9090))
    
    @staticmethod
    def validate_config() -> Dict[str, Any]:
        """Validate configuration settings."""
        errors = []
        
        # Check required paths
        required_paths = [
            Config.DATA_PATH,
            Config.LOGS_PATH,
            Config.UPLOAD_FOLDER
        ]
        
        for path in required_paths:
            if not os.path.exists(path):
                try:
                    os.makedirs(path, exist_ok=True)
                except Exception as e:
                    errors.append(f"Failed to create directory {path}: {str(e)}")
        
        # Check model files exist (if not in development mode)
        if Config.FLASK_ENV != 'development':
            if not os.path.exists(Config.MODEL_PATH):
                errors.append(f"Model file not found: {Config.MODEL_PATH}")
            
            if not os.path.exists(Config.PREPROCESSOR_PATH):
                errors.append(f"Preprocessor file not found: {Config.PREPROCESSOR_PATH}")
        
        # Validate security settings
        if Config.SECRET_KEY == 'default-secret-key-change-in-production':
            if Config.FLASK_ENV == 'production':
                errors.append("SECRET_KEY must be changed in production environment")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors
        }
    
    @staticmethod
    def get_model_config() -> Dict[str, Any]:
        """Get model configuration."""
        return {
            'input_shape': (128, 128, 1),
            'num_classes': 10,
            'dropout_rate': 0.3,
            'learning_rate': 0.001,
            'batch_size': 32,
            'epochs': 50,
            'validation_split': 0.2,
            'early_stopping_patience': 10
        }
    
    @staticmethod
    def get_speech_config() -> Dict[str, Any]:
        """Get speech processing configuration."""
        return {
            'sample_rate': Config.AUDIO_SAMPLE_RATE,
            'max_duration': Config.AUDIO_MAX_DURATION,
            'n_mels': 128,
            'n_fft': 2048,
            'hop_length': 512,
            'win_length': 1024,
            'window': 'hann',
            'fmin': 20,
            'fmax': 8000,
            'preemphasis': 0.97,
            'normalize': True
        }

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    TESTING = False
    LOG_LEVEL = 'DEBUG'

class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    TESTING = False
    LOG_LEVEL = 'WARNING'

class TestingConfig(Config):
    """Testing configuration."""
    DEBUG = True
    TESTING = True
    LOG_LEVEL = 'DEBUG'

def get_config(env: Optional[str] = None) -> Config:
    """Get configuration based on environment."""
    env = env or os.getenv('FLASK_ENV', 'development')
    
    config_map = {
        'development': DevelopmentConfig,
        'production': ProductionConfig,
        'testing': TestingConfig
    }
    
    return config_map.get(env, DevelopmentConfig)()

# Global config instance
config = get_config()