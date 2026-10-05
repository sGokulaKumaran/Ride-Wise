package vehicle.ridewise.config;

// CORS + API session authentication configuration
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final SessionAuthInterceptor sessionAuthInterceptor;
    private final AllowedOrigins allowedOrigins;

    public WebConfig(SessionAuthInterceptor sessionAuthInterceptor, AllowedOrigins allowedOrigins) {
        this.sessionAuthInterceptor = sessionAuthInterceptor;
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                // Origin PATTERNS (not exact origins) so a wildcard tunnel
                // domain such as https://*.trycloudflare.com is accepted and a
                // brand-new URL never needs editing. The pattern form is also
                // what allows wildcards together with allowCredentials(true).
                // The list itself lives in AllowedOrigins (shared with the
                // ride socket) and can be changed with ridewise.allowed-origins.
                .allowedOriginPatterns(allowedOrigins.forRest())
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(sessionAuthInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/auth/login", "/api/auth/signup");
    }
}
