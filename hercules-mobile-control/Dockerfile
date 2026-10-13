FROM python:3.12-slim
WORKDIR /app
COPY hercules-mobile-control/ /app/
RUN useradd --uid 10001 --create-home appuser
USER appuser
ENV PORT=8765
ENV HERCULES_MOBILE_BIND=0.0.0.0
CMD ["python", "server.py"]
