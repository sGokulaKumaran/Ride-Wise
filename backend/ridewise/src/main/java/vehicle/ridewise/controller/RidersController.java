package vehicle.ridewise.controller;

import vehicle.ridewise.dto.UserResponse;
import vehicle.ridewise.service.RidersService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/riders")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"})
public class RidersController {

    @Autowired
    private RidersService ridersService;

    // GET /api/riders/search?query=alice&userId=1
    @GetMapping("/search")
    public ResponseEntity<List<UserResponse>> search(
            @RequestParam String query,
            @RequestParam Long userId) {
        List<UserResponse> results = ridersService.searchRiders(query, userId);
        return ResponseEntity.ok(results);
    }

    // GET /api/riders/nearby?userId=1
    @GetMapping("/nearby")
    public ResponseEntity<List<UserResponse>> nearby(@RequestParam Long userId) {
        List<UserResponse> results = ridersService.getNearRiders(userId);
        return ResponseEntity.ok(results);
    }

    // GET /api/riders/connections?userId=1
    @GetMapping("/connections")
    public ResponseEntity<List<UserResponse>> connections(@RequestParam Long userId) {
        List<UserResponse> results = ridersService.getConnections(userId);
        return ResponseEntity.ok(results);
    }

    // POST /api/riders/add — body: { userId: 1, riderId: 2 }
    @PostMapping("/add")
    public ResponseEntity<Map<String, Object>> addRider(@RequestBody Map<String, Long> body) {
        Long userId = body.get("userId");
        Long riderId = body.get("riderId");
        boolean success = ridersService.addRider(userId, riderId);
        return ResponseEntity.ok(Map.of("success", success));
    }

    // POST /api/riders/remove — body: { userId: 1, riderId: 2 }
    @PostMapping("/remove")
    public ResponseEntity<Map<String, Object>> removeRider(@RequestBody Map<String, Long> body) {
        Long userId = body.get("userId");
        Long riderId = body.get("riderId");
        boolean success = ridersService.removeRider(userId, riderId);
        return ResponseEntity.ok(Map.of("success", success));
    }
}