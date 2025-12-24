import logging
import logging.handlers
import os
from datetime import datetime
from pythonjsonlogger import jsonlogger
from typing import Optional

class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter for structured logging."""
    
    def add_fields(self, log_record, record, message_dict):
        super(CustomJsonFormatter, self).add_fields(log_record, record, message_dict)
        log_record['timestamp'] = datetime.utcnow().isoformat()
        log_record['level'] = record.levelname
        log_record['module'] = record.module
        log_record['function'] = record.funcName
        log_record['line'] = record.lineno
        
        # Add extra fields if present
        if hasattr(record, 'user_id'):
            log_record['user_id'] = record.user_id
        if hasattr(record, 'request_id'):
            log_record['request_id'] = record.request_id
        if hasattr(record, 'processing_time'):
            log_record['processing_time'] = record.processing_time

def setup_logging(log_level: str = 'INFO', log_file: str = 'logs/app.log', 
                 max_bytes: int = 10485760, backup_count: int = 5) -> logging.Logger:
    """Set up application logging."""
    
    # Create logs directory if it doesn't exist
    log_dir = os.path.dirname(log_file)
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)
    
    # Create logger
    logger = logging.getLogger('neural_backend')
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # Create formatters
    json_formatter = CustomJsonFormatter()
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # File handler with rotation
    file_handler = logging.handlers.RotatingFileHandler(
        log_file, maxBytes=max_bytes, backupCount=backup_count
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(json_formatter)
    logger.addHandler(file_handler)
    
    # Error file handler
    error_file_handler = logging.handlers.RotatingFileHandler(
        log_file.replace('.log', '_error.log'), maxBytes=max_bytes, backupCount=backup_count
    )
    error_file_handler.setLevel(logging.ERROR)
    error_file_handler.setFormatter(json_formatter)
    logger.addHandler(error_file_handler)
    
    return logger

class LoggerMixin:
    """Mixin class to add logging capabilities to other classes."""
    
    def __init__(self):
        self.logger = logging.getLogger(f'{self.__class__.__module__}.{self.__class__.__name__}')
    
    def log_request(self, request, response_time: Optional[float] = None):
        """Log HTTP request details."""
        self.logger.info(
            f"{request.method} {request.path} - {response_time:.3f}s" if response_time else f"{request.method} {request.path}",
            extra={
                'request_method': request.method,
                'request_path': request.path,
                'request_remote_addr': request.remote_addr,
                'request_user_agent': request.headers.get('User-Agent'),
                'response_time': response_time,
                'processing_time': response_time
            }
        )
    
    def log_error(self, error: Exception, context: Optional[dict] = None):
        """Log error with context."""
        extra_data = {'error_type': type(error).__name__, 'error_message': str(error)}
        if context:
            extra_data.update(context)
        
        self.logger.error(f"Error occurred: {str(error)}", extra=extra_data)
    
    def log_model_prediction(self, input_data, prediction, confidence: Optional[float] = None):
        """Log model prediction details."""
        extra_data = {
            'prediction': prediction,
            'input_shape': str(getattr(input_data, 'shape', 'unknown'))
        }
        if confidence is not None:
            extra_data['confidence'] = confidence
        
        self.logger.info("Model prediction made", extra=extra_data)
    
    def log_speech_processing(self, audio_duration: float, processing_time: float, 
                            operation: str = 'speech_recognition'):
        """Log speech processing metrics."""
        self.logger.info(
            f"Speech processing completed",
            extra={
                'operation': operation,
                'audio_duration': audio_duration,
                'processing_time': processing_time,
                'real_time_factor': processing_time / audio_duration if audio_duration > 0 else 0
            }
        )

# Global logger instance
app_logger = setup_logging()