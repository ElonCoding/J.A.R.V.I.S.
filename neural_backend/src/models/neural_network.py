import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, models, optimizers, callbacks
from typing import Dict, Any, Tuple, Optional, List
import numpy as np
import json
import os
from datetime import datetime
from ..utils.logger import LoggerMixin

class NeuralNetworkModel(LoggerMixin):
    """
    Advanced neural network model for speech and text processing.
    Supports multiple architectures including CNN, RNN, and Transformer variants.
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__()
        self.config = config or self._get_default_config()
        self.model = None
        self.history = None
        self.is_trained = False
        self.preprocessor = None
        
        # Model architecture parameters
        self.input_shape = self.config.get('input_shape', (128, 128, 1))
        self.num_classes = self.config.get('num_classes', 10)
        self.dropout_rate = self.config.get('dropout_rate', 0.3)
        self.learning_rate = self.config.get('learning_rate', 0.001)
        
        # Training parameters
        self.batch_size = self.config.get('batch_size', 32)
        self.epochs = self.config.get('epochs', 50)
        self.validation_split = self.config.get('validation_split', 0.2)
        self.early_stopping_patience = self.config.get('early_stopping_patience', 10)
        
        self.logger.info(f"NeuralNetworkModel initialized with config: {self.config}")
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default model configuration."""
        return {
            'input_shape': (128, 128, 1),
            'num_classes': 10,
            'dropout_rate': 0.3,
            'learning_rate': 0.001,
            'batch_size': 32,
            'epochs': 50,
            'validation_split': 0.2,
            'early_stopping_patience': 10,
            'architecture': 'cnn_rnn_hybrid',  # Options: cnn, rnn, transformer, cnn_rnn_hybrid
            'optimizer': 'adam',
            'loss_function': 'categorical_crossentropy',
            'metrics': ['accuracy', 'precision', 'recall']
        }
    
    def build_model(self, architecture: str = None) -> keras.Model:
        """Build the neural network model based on specified architecture."""
        arch = architecture or self.config.get('architecture', 'cnn_rnn_hybrid')
        
        self.logger.info(f"Building model with architecture: {arch}")
        
        if arch == 'cnn':
            return self._build_cnn_model()
        elif arch == 'rnn':
            return self._build_rnn_model()
        elif arch == 'transformer':
            return self._build_transformer_model()
        elif arch == 'cnn_rnn_hybrid':
            return self._build_cnn_rnn_hybrid_model()
        else:
            raise ValueError(f"Unknown architecture: {arch}")
    
    def _build_cnn_model(self) -> keras.Model:
        """Build CNN architecture for image/spectrogram processing."""
        model = models.Sequential([
            # Input layer
            layers.Input(shape=self.input_shape),
            
            # First convolutional block
            layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
            layers.BatchNormalization(),
            layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
            layers.BatchNormalization(),
            layers.MaxPooling2D((2, 2)),
            layers.Dropout(self.dropout_rate / 2),
            
            # Second convolutional block
            layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
            layers.BatchNormalization(),
            layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
            layers.BatchNormalization(),
            layers.MaxPooling2D((2, 2)),
            layers.Dropout(self.dropout_rate),
            
            # Third convolutional block
            layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
            layers.BatchNormalization(),
            layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
            layers.BatchNormalization(),
            layers.MaxPooling2D((2, 2)),
            layers.Dropout(self.dropout_rate),
            
            # Global average pooling
            layers.GlobalAveragePooling2D(),
            
            # Dense layers
            layers.Dense(256, activation='relu'),
            layers.BatchNormalization(),
            layers.Dropout(self.dropout_rate),
            layers.Dense(128, activation='relu'),
            layers.BatchNormalization(),
            layers.Dropout(self.dropout_rate / 2),
            
            # Output layer
            layers.Dense(self.num_classes, activation='softmax')
        ])
        
        return model
    
    def _build_rnn_model(self) -> keras.Model:
        """Build RNN architecture for sequential data processing."""
        model = models.Sequential([
            # Input layer (for sequence data)
            layers.Input(shape=(None, self.input_shape[0])),
            
            # Bidirectional LSTM layers
            layers.Bidirectional(layers.LSTM(128, return_sequences=True)),
            layers.BatchNormalization(),
            layers.Dropout(self.dropout_rate),
            
            layers.Bidirectional(layers.LSTM(64, return_sequences=True)),
            layers.BatchNormalization(),
            layers.Dropout(self.dropout_rate),
            
            layers.Bidirectional(layers.LSTM(32)),
            layers.BatchNormalization(),
            layers.Dropout(self.dropout_rate),
            
            # Dense layers
            layers.Dense(128, activation='relu'),
            layers.BatchNormalization(),
            layers.Dropout(self.dropout_rate),
            layers.Dense(64, activation='relu'),
            layers.BatchNormalization(),
            layers.Dropout(self.dropout_rate / 2),
            
            # Output layer
            layers.Dense(self.num_classes, activation='softmax')
        ])
        
        return model
    
    def _build_transformer_model(self) -> keras.Model:
        """Build Transformer architecture for advanced sequence processing."""
        inputs = layers.Input(shape=(None, self.input_shape[0]))
        
        # Positional encoding
        positions = tf.range(start=0, limit=tf.shape(inputs)[1], delta=1)
        positional_encoding = self._positional_encoding(positions, self.input_shape[0])
        
        # Add positional encoding to inputs
        x = inputs + positional_encoding
        
        # Multi-head attention layers
        for i in range(2):  # 2 transformer blocks
            # Multi-head attention
            attention_output = layers.MultiHeadAttention(
                num_heads=8, key_dim=self.input_shape[0] // 8
            )(x, x)
            attention_output = layers.Dropout(self.dropout_rate)(attention_output)
            
            # Add & Norm
            x = layers.LayerNormalization()(x + attention_output)
            
            # Feed forward
            ff_output = layers.Dense(256, activation='relu')(x)
            ff_output = layers.Dense(self.input_shape[0])(ff_output)
            ff_output = layers.Dropout(self.dropout_rate)(ff_output)
            
            # Add & Norm
            x = layers.LayerNormalization()(x + ff_output)
        
        # Global average pooling
        x = layers.GlobalAveragePooling1D()(x)
        
        # Dense layers
        x = layers.Dense(128, activation='relu')(x)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(self.dropout_rate)(x)
        x = layers.Dense(64, activation='relu')(x)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(self.dropout_rate / 2)(x)
        
        # Output layer
        outputs = layers.Dense(self.num_classes, activation='softmax')(x)
        
        model = models.Model(inputs=inputs, outputs=outputs)
        return model
    
    def _build_cnn_rnn_hybrid_model(self) -> keras.Model:
        """Build hybrid CNN-RNN architecture combining both strengths."""
        # Input for spectrogram-like data
        inputs = layers.Input(shape=self.input_shape)
        
        # CNN feature extraction
        x = layers.Conv2D(32, (3, 3), activation='relu', padding='same')(inputs)
        x = layers.BatchNormalization()(x)
        x = layers.Conv2D(32, (3, 3), activation='relu', padding='same')(x)
        x = layers.BatchNormalization()(x)
        x = layers.MaxPooling2D((2, 2))(x)
        x = layers.Dropout(self.dropout_rate / 2)(x)
        
        x = layers.Conv2D(64, (3, 3), activation='relu', padding='same')(x)
        x = layers.BatchNormalization()(x)
        x = layers.Conv2D(64, (3, 3), activation='relu', padding='same')(x)
        x = layers.BatchNormalization()(x)
        x = layers.MaxPooling2D((2, 2))(x)
        x = layers.Dropout(self.dropout_rate)(x)
        
        # Reshape for RNN processing
        # From (batch, height, width, channels) to (batch, time_steps, features)
        x = layers.Reshape((-1, x.shape[2] * x.shape[3]))(x)
        
        # RNN sequence processing
        x = layers.Bidirectional(layers.LSTM(128, return_sequences=True))(x)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(self.dropout_rate)(x)
        
        x = layers.Bidirectional(layers.LSTM(64))(x)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(self.dropout_rate)(x)
        
        # Dense layers
        x = layers.Dense(128, activation='relu')(x)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(self.dropout_rate)(x)
        x = layers.Dense(64, activation='relu')(x)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(self.dropout_rate / 2)(x)
        
        # Output layer
        outputs = layers.Dense(self.num_classes, activation='softmax')(x)
        
        model = models.Model(inputs=inputs, outputs=outputs)
        return model
    
    def _positional_encoding(self, positions: tf.Tensor, d_model: int) -> tf.Tensor:
        """Generate positional encoding for transformer."""
        angle_rads = self._get_angles(positions[:, tf.newaxis],
                                     tf.range(d_model)[tf.newaxis, :],
                                     d_model)
        
        # Apply sin to even indices
        angle_rads = tf.cast(angle_rads, tf.float32)
        sines = tf.sin(angle_rads[:, 0::2])
        cosines = tf.cos(angle_rads[:, 1::2])
        
        pos_encoding = tf.concat([sines, cosines], axis=-1)
        pos_encoding = pos_encoding[tf.newaxis, ...]
        
        return tf.cast(pos_encoding, dtype=tf.float32)
    
    def _get_angles(self, pos: tf.Tensor, i: tf.Tensor, d_model: int) -> tf.Tensor:
        """Calculate angles for positional encoding."""
        angle_rates = 1 / tf.pow(10000, (2 * (i // 2)) / tf.cast(d_model, tf.float32))
        return pos * angle_rates
    
    def compile_model(self, model: Optional[keras.Model] = None) -> None:
        """Compile the model with specified optimizer and metrics."""
        if model is None:
            model = self.model
        
        if model is None:
            raise ValueError("No model to compile. Build or load a model first.")
        
        # Get optimizer
        optimizer_name = self.config.get('optimizer', 'adam')
        if optimizer_name == 'adam':
            optimizer = optimizers.Adam(learning_rate=self.learning_rate)
        elif optimizer_name == 'sgd':
            optimizer = optimizers.SGD(learning_rate=self.learning_rate)
        elif optimizer_name == 'rmsprop':
            optimizer = optimizers.RMSprop(learning_rate=self.learning_rate)
        else:
            optimizer = optimizers.Adam(learning_rate=self.learning_rate)
        
        # Get loss function
        loss_function = self.config.get('loss_function', 'categorical_crossentropy')
        
        # Get metrics
        metrics = self.config.get('metrics', ['accuracy'])
        
        model.compile(
            optimizer=optimizer,
            loss=loss_function,
            metrics=metrics
        )
        
        self.logger.info(f"Model compiled with optimizer: {optimizer_name}, loss: {loss_function}")
    
    def get_model_summary(self) -> str:
        """Get model architecture summary."""
        if self.model is None:
            return "No model available"
        
        string_list = []
        self.model.summary(print_fn=lambda x: string_list.append(x))
        return '\n'.join(string_list)
    
    def save_model(self, filepath: str, include_config: bool = True) -> None:
        """Save the trained model and configuration."""
        if self.model is None:
            raise ValueError("No model to save. Train or load a model first.")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Save model
        self.model.save(filepath)
        
        # Save configuration if requested
        if include_config:
            config_path = filepath.replace('.h5', '_config.json')
            with open(config_path, 'w') as f:
                json.dump(self.config, f, indent=2)
        
        self.logger.info(f"Model saved to {filepath}")
    
    def load_model(self, filepath: str, load_config: bool = True) -> None:
        """Load a saved model and optionally its configuration."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Model file not found: {filepath}")
        
        # Load model
        self.model = keras.models.load_model(filepath)
        self.is_trained = True
        
        # Load configuration if available
        if load_config:
            config_path = filepath.replace('.h5', '_config.json')
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    loaded_config = json.load(f)
                    self.config.update(loaded_config)
        
        self.logger.info(f"Model loaded from {filepath}")
    
    def predict(self, input_data: np.ndarray, batch_size: Optional[int] = None) -> np.ndarray:
        """Make predictions on input data."""
        if self.model is None:
            raise ValueError("No model available. Train or load a model first.")
        
        if not self.is_trained:
            self.logger.warning("Model is not trained. Predictions may be unreliable.")
        
        batch_size = batch_size or self.batch_size
        
        # Log prediction details
        self.log_model_prediction(input_data, None, None)
        
        predictions = self.model.predict(input_data, batch_size=batch_size)
        
        return predictions
    
    def predict_single(self, input_sample: np.ndarray) -> Tuple[int, float]:
        """Make prediction on a single sample."""
        # Ensure input is in the right shape
        if len(input_sample.shape) == len(self.input_shape) - 1:
            input_sample = np.expand_dims(input_sample, axis=0)
        
        predictions = self.predict(input_sample)
        predicted_class = np.argmax(predictions[0])
        confidence = float(np.max(predictions[0]))
        
        return predicted_class, confidence