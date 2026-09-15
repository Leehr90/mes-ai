FROM python:3.12-slim

WORKDIR /app

COPY server /app/server

WORKDIR /app/server

RUN pip install --no-cache-dir -U pip \
    && pip install --no-cache-dir -e ".[postgres]"

EXPOSE 8082

CMD ["sh", "-c", "alembic upgrade head && uvicorn mes.main:app --host 0.0.0.0 --port 8082"]