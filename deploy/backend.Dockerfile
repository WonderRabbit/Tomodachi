FROM eclipse-temurin:21-jdk AS build

WORKDIR /workspace/backend
COPY backend/gradle ./gradle
COPY backend/gradlew backend/settings.gradle.kts backend/build.gradle.kts ./
COPY backend/src ./src

RUN ./gradlew --no-daemon bootJar -x test

FROM eclipse-temurin:21-jre

WORKDIR /app
COPY --from=build /workspace/backend/build/libs/*.jar /app/tomodachi-backend.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/tomodachi-backend.jar"]
