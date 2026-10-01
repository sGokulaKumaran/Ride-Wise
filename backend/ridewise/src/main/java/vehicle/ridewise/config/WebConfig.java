package vehicle.ridewise.config;

// CORS + API session authentication configuration
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                // Origin PATTERNS (not exact origins) so a wildcard tunnel
                // domain such as https://*.trycloudflare.com is accepted and a
                // brand-new URL never needs editing. The pattern form is also
                // what allows wildcards together with allowCredentials(true).
                .allowedOriginPatterns(
                        "https://ride-wise.pages.dev",
                        "http://localhost:5173",
                        "https://ridewise38.netlify.app",
                        "https://*.trycloudflare.com",
                        "https://*.ngrok-free.app",
                        "https://*.ngrok.app")
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new SessionAuthInterceptor())
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/auth/login", "/api/auth/signup");
    }
}