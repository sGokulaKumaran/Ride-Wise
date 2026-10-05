package vehicle.ridewise.config;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

// ============================================================
// JacksonConfig — how timestamps leave the API
//
// Entities keep LocalDateTime values, which carry no time zone. Sent as
// "2026-09-22T02:44:00" the browser has to GUESS the zone and assumes
// its own — so a ride created on the hosted (UTC) server showed up
// 5½ hours off for a rider in India, and "today" could become
// "yesterday".
//
// The JVM is pinned to UTC (RideWiseApplication), so every stored value
// IS a UTC instant. This serializer says so, by appending "Z":
//     2026-09-22T02:44:00.000Z
// which every browser converts to the rider's local time correctly.
//
// It applies to the single ObjectMapper used by both the REST API and
// the ride WebSocket.
// ============================================================
@Configuration
public class JacksonConfig {

    private static final DateTimeFormatter UTC_ISO =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer utcTimestamps() {
        return builder -> builder.serializerByType(LocalDateTime.class, new JsonSerializer<LocalDateTime>() {
            @Override
            public void serialize(LocalDateTime value, JsonGenerator gen, SerializerProvider serializers)
                    throws IOException {
                gen.writeString(UTC_ISO.format(value));
            }
        });
    }
}
