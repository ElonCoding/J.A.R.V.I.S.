# Neural Network Backend System

A comprehensive Python-based system implementing both neural network models and backend services for speech-to-speech AI applications.

## Features

- **Neural Network Components:**
  - TensorFlow-based deep learning models
  - Data preprocessing pipelines
  - Model training and evaluation
  - Model persistence and loading

- **Backend Service:**
  - Flask RESTful API
  - Model inference endpoints
  - Authentication and rate limiting
  - Comprehensive logging and error handling

- **Speech Processing:**
  - Speech-to-text recognition
  - Text-to-speech synthesis
  - Audio preprocessing and feature extraction

- **Production Ready:**
  - Docker containerization
  - Unit tests and API documentation
  - Configuration management
  - Deployment scripts

## Quick Start

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Train the model:**
   ```bash
   python src/train_model.py
   ```

4. **Start the backend service:**
   ```bash
   python src/app.py
   ```

5. **Access API documentation:**
   Open http://localhost:5000/docs

## Project Structure

```
neural_backend/
├── src/
│   ├── models/          # Neural network models
│   ├── preprocessing/   # Data preprocessing pipelines
│   ├── api/            # Flask API endpoints
│   ├── services/       # Business logic services
│   ├── utils/          # Utility functions
│   └── config/         # Configuration files
├── tests/              # Unit tests
├── models/             # Saved model files
├── data/               # Training data
├── logs/               # Application logs
└── docker/             # Docker configuration
```

## API Endpoints

- `POST /api/auth/login` - User authentication
- `POST /api/speech/recognize` - Speech recognition
- `POST /api/speech/synthesize` - Text-to-speech
- `POST /api/model/predict` - Model inference
- `GET /api/health` - Health check
- `GET /docs` - API documentation

## Configuration

The system uses environment variables for configuration:

- `FLASK_ENV` - Environment (development/production)
- `SECRET_KEY` - JWT secret key
- `MODEL_PATH` - Path to trained model
- `LOG_LEVEL` - Logging level
- `RATE_LIMIT` - API rate limiting

## Testing

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=src

# Run specific test file
pytest tests/test_api.py
```

## Docker Deployment

```bash
# Build image
docker build -t neural-backend .

# Run container
docker run -p 5000:5000 neural-backend
```

## License

MIT License