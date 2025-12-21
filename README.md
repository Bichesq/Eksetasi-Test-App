# Eksetasi Test App
This is a simple web application built with Node.js, Express, and EJS. It serves as a front-end interface for testing and interacting with a FastAPI-based backend service. The application provides a user-friendly way to send requests to the backend and view the responses.

# docker commands for running the app

docker build -t eksetasi-test-app .
docker run -d \
  --name eksetasi-test-app \
  -p 3000:3000 \
  -e PORT=3000 \
  -e REQUESTOR_BASE_URL="https://admin-api-dev.project-penguin.com" \
  -e API_KEY="sk_tYB168K44pxMQdcKiZc2snlL3-E52mgKMMM45EAmciQ" \
  --restart unless-stopped \
  eksetasi-test-app