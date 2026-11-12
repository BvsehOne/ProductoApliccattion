FROM node:24-alpine AS frontend-build
WORKDIR /workspace/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM maven:3.9-eclipse-temurin-25 AS backend-build
WORKDIR /workspace
COPY . .
COPY --from=frontend-build /workspace/frontend/dist/ /workspace/src/main/resources/static/
RUN mvn -B package

FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=backend-build /workspace/target/productos-0.0.1-SNAPSHOT.jar /app/app.jar
EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
