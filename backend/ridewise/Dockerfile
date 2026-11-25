# Stage 1: Build the application using Maven
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Configure Maven to use a reliable mirror so Render never hits Central rate-limits (HTTP 429)
RUN mkdir -p /root/.m2 && echo '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0" \
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
  xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd"> \
  <mirrors> \
    <mirror> \
      <id>aliyun-mirror</id> \
      <mirrorOf>central</mirrorOf> \
      <name>Maven Central Mirror</name> \
      <url>https://maven.aliyun.com/repository/central</url> \
    </mirror> \
  </mirrors> \
</settings>' > /root/.m2/settings.xml

COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Run the application
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]