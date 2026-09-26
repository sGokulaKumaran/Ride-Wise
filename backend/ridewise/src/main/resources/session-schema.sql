-- ============================================================
-- RideWise — Spring Session (JDBC) tables for PostgreSQL
--
-- WHY THIS FILE EXISTS
--   spring-session-jdbc stores HTTP sessions in the database so that a
--   backend restart no longer logs everybody out. That is what makes
--   "Remember me" reliable: on Render the service restarts on every
--   deploy and after idle spin-downs, which used to wipe Tomcat's
--   in-memory sessions and send users back to the login screen.
--
-- WHY "IF NOT EXISTS"
--   application.properties sets
--       spring.session.jdbc.initialize-schema=always
--   so this script runs on EVERY startup. The official PostgreSQL
--   script from the Spring Session jar uses plain CREATE TABLE, which
--   would fail (and stop the app from booting) the second time it ran.
--   IF NOT EXISTS makes re-running a harmless no-op.
--
-- Column layout matches Spring Session's own schema-postgresql.sql, so
-- the library reads and writes these tables exactly as it expects.
-- ============================================================

CREATE TABLE IF NOT EXISTS SPRING_SESSION (
    PRIMARY_ID            CHAR(36) NOT NULL,
    SESSION_ID            CHAR(36) NOT NULL,
    CREATION_TIME         BIGINT   NOT NULL,
    LAST_ACCESS_TIME      BIGINT   NOT NULL,
    MAX_INACTIVE_INTERVAL INT      NOT NULL,
    EXPIRY_TIME           BIGINT   NOT NULL,
    PRINCIPAL_NAME        VARCHAR(100),
    CONSTRAINT SPRING_SESSION_PK PRIMARY KEY (PRIMARY_ID)
);

CREATE UNIQUE INDEX IF NOT EXISTS SPRING_SESSION_IX1 ON SPRING_SESSION (SESSION_ID);
CREATE INDEX IF NOT EXISTS SPRING_SESSION_IX2 ON SPRING_SESSION (EXPIRY_TIME);
CREATE INDEX IF NOT EXISTS SPRING_SESSION_IX3 ON SPRING_SESSION (PRINCIPAL_NAME);

CREATE TABLE IF NOT EXISTS SPRING_SESSION_ATTRIBUTES (
    SESSION_PRIMARY_ID CHAR(36)     NOT NULL,
    ATTRIBUTE_NAME     VARCHAR(200) NOT NULL,
    ATTRIBUTE_BYTES    BYTEA        NOT NULL,
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_PK PRIMARY KEY (SESSION_PRIMARY_ID, ATTRIBUTE_NAME),
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_FK FOREIGN KEY (SESSION_PRIMARY_ID)
        REFERENCES SPRING_SESSION (PRIMARY_ID) ON DELETE CASCADE
);
