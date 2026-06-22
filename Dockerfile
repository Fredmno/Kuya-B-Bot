FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render provides PORT; default to 10000 for local testing
ENV PORT=10000

CMD gunicorn bot:app --bind 0.0.0.0:${PORT} --workers 1
