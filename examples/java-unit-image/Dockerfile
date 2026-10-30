FROM maven:3.9-eclipse-temurin-21
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
COPY junit.jar hamcrest.jar /opt/code-qa/
COPY JUnitEvidence.java /opt/code-qa/
RUN javac -cp /opt/code-qa/junit.jar /opt/code-qa/JUnitEvidence.java
