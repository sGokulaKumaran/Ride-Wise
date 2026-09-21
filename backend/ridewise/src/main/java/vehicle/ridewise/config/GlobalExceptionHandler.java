package vehicle.ridewise.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException ex) {
        String msg = ex.getMessage();
        HttpStatus status = HttpStatus.BAD_REQUEST;

        if ("Email already registered".equals(msg)) {
            status = HttpStatus.CONFLICT;
        } else if ("Incorrect password".equals(msg)) {
            status = HttpStatus.UNAUTHORIZED;
        } else if ("User not found".equals(msg) || "Ride not found".equals(msg)) {
            status = HttpStatus.NOT_FOUND;
        }

        return ResponseEntity.status(status).body(Map.of("error", msg));
    }
}
