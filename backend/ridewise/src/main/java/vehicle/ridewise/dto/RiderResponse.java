package vehicle.ridewise.dto;

import vehicle.ridewise.entity.User;

// ============================================================
// RiderResponse — what one rider may see about ANOTHER rider
//
// Search, "near me" and connection lists used to return the full
// UserResponse of other people: their exact home coordinates, phone
// number, role and account status. Anyone logged in could read every
// rider's location by searching.
//
// This DTO carries only what the Riders screen shows:
//   id, username, email, address (free text the rider typed), and for
//   "near me" results the distance in kilometres — rounded, so it cannot
//   be used to pin a rider down.
//
// EMAIL
//   from(...)         the full address — for riders the viewer is already
//                     connected with
//   forStranger(...)  only a hint ("r•••@example.com") — for search and
//                     "near me" results. Enough to recognise a friend's
//                     account; not enough to harvest every rider's email
//                     by typing letters into the search box.
//
// A rider's OWN profile still uses UserResponse (from /api/auth/*).
// ============================================================
public class RiderResponse {

    private Long id;
    private String username;
    private String email;
    private String address;
    private Double distance; // kilometres, only for "near me" results

    public static RiderResponse from(User user) {
        return from(user, null);
    }

    public static RiderResponse from(User user, Double distanceKm) {
        RiderResponse r = new RiderResponse();
        r.id = user.getId();
        r.username = user.getUsername();
        r.email = user.getEmail();
        r.address = user.getAddress();
        // One decimal place: "3.4 km away"
        r.distance = distanceKm == null ? null : Math.round(distanceKm * 10.0) / 10.0;
        return r;
    }

    /** A rider the viewer is NOT connected with: the email is only hinted at. */
    public static RiderResponse forStranger(User user, Double distanceKm) {
        RiderResponse r = from(user, distanceKm);
        r.email = maskEmail(user.getEmail());
        return r;
    }

    // "rider.two@example.com" → "r•••@example.com"
    static String maskEmail(String email) {
        if (email == null || email.isBlank()) return null;
        int at = email.indexOf('@');
        if (at <= 0) return "•••";
        return email.charAt(0) + "•••" + email.substring(at);
    }

    public Long getId()         { return id; }
    public String getUsername() { return username; }
    public String getEmail()    { return email; }
    public String getAddress()  { return address; }
    public Double getDistance() { return distance; }

    public void setId(Long id)               { this.id = id; }
    public void setUsername(String username) { this.username = username; }
    public void setEmail(String email)       { this.email = email; }
    public void setAddress(String address)   { this.address = address; }
    public void setDistance(Double distance) { this.distance = distance; }
}
