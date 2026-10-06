package vehicle.ridewise;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.repository.NotificationRepository;
import vehicle.ridewise.repository.OrgAccessRepository;
import vehicle.ridewise.repository.UserRepository;
import vehicle.ridewise.repository.VehicleSessionRepository;
import vehicle.ridewise.service.VehicleSessionService;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

// ============================================================
// OrgFleetTests — the organization / fleet platform, end to end
//
// Boots the real server on a random port (in-memory H2 — never the real
// database) and talks to it exactly like the app does: REST with the
// login cookie, and the /ws/fleet WebSocket.
//
// What is pinned down here are the rules that must never break:
//   • who may see a private organization, and that guessing tells nothing
//   • who may do what (owner / admin / driver / viewer / stranger)
//   • ONE running trip per vehicle and per driver
//   • positions: distance and speeding are measured by the server
//   • a trip always ends cleanly (driver, admin, timeout, suspension …)
//   • live events reach the people watching — and only people allowed to
// ============================================================
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OrgFleetTests {

    private static final AtomicInteger SEQ = new AtomicInteger();

    @LocalServerPort int port;

    @Autowired TestRestTemplate rest;
    @Autowired ObjectMapper objectMapper;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired UserRepository userRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired OrgAccessRepository accessRepository;
    @Autowired VehicleSessionRepository sessionRepository;
    @Autowired VehicleSessionService sessionService;

    // ════════════════════════════════════════════════════════
    // ORGANIZATIONS — create, find, open
    // ════════════════════════════════════════════════════════

    @Test
    void creatingAnOrganizationMakesTheCreatorItsOwner() throws Exception {
        Person owner = person("owner");

        ResponseEntity<String> created = owner.post("/api/organizations",
                Map.of("name", "  Northfield   College ", "orgType", "college", "visibility", "PUBLIC"));
        assertEquals(201, created.getStatusCode().value(), created.getBody());
        JsonNode org = json(created);

        assertTrue(org.at("/card/orgCode").asText().matches("RW-[2-9A-HJKMNP-Z]{6}"),
                "a readable code without 0/O/1/I/L: " + org.at("/card/orgCode").asText());
        assertEquals("Northfield College", org.at("/card/name").asText(), "the name is tidied");
        assertEquals("COLLEGE", org.at("/card/orgType").asText());
        assertEquals("OWNER", org.at("/card/myRole").asText());
        assertTrue(org.get("canManage").asBoolean());
        assertTrue(org.get("owner").asBoolean());
        assertTrue(org.get("canDrive").asBoolean(), "owners may drive too");

        JsonNode mine = json(owner.get("/api/organizations/me"));
        assertEquals(1, mine.get("managed").size());
        assertEquals(0, mine.get("driving").size());

        // A private organization cannot exist without a password.
        ResponseEntity<String> noPassword = owner.post("/api/organizations",
                Map.of("name", "Secret Fleet", "visibility", "PRIVATE"));
        assertEquals(400, noPassword.getStatusCode().value());
        ResponseEntity<String> shortPassword = owner.post("/api/organizations",
                Map.of("name", "Secret Fleet", "visibility", "PRIVATE", "accessPassword", "abc"));
        assertEquals(400, shortPassword.getStatusCode().value());
    }

    @Test
    void searchShowsPublicOrganizationsOnly() throws Exception {
        Person owner = person("owner");
        Person stranger = person("stranger");
        String tag = "Quillon" + SEQ.incrementAndGet();

        long publicId = createOrg(owner, tag + " Public School", "PUBLIC", null);
        JsonNode privateOrg = json(owner.post("/api/organizations", Map.of(
                "name", tag + " Private Hospital", "orgType", "HOSPITAL",
                "visibility", "PRIVATE", "accessPassword", "ambulance-77")));
        long privateId = privateOrg.at("/card/id").asLong();
        String privateCode = privateOrg.at("/card/orgCode").asText();

        JsonNode found = json(stranger.get("/api/organizations/search?q=" + tag.toLowerCase()));
        assertEquals(1, found.size(), "only the public one: " + found);
        assertEquals(publicId, found.get(0).get("id").asLong());

        // Not by its code either — a private organization cannot be looked up.
        assertEquals(0, json(stranger.get("/api/organizations/search?q=" + privateCode)).size());

        // And nothing of it can be read without access.
        assertEquals(403, stranger.get("/api/organizations/" + privateId).getStatusCode().value());
        assertEquals(403, stranger.get("/api/organizations/" + privateId + "/vehicles").getStatusCode().value());
        assertEquals(403, stranger.get("/api/organizations/" + privateId + "/routes").getStatusCode().value());
        assertEquals(403, stranger.get("/api/organizations/" + privateId + "/announcements").getStatusCode().value());

        // The public one is open to anyone signed in — but its admin pages are not.
        assertEquals(200, stranger.get("/api/organizations/" + publicId).getStatusCode().value());
        assertEquals(200, stranger.get("/api/organizations/" + publicId + "/vehicles").getStatusCode().value());
        assertEquals(403, stranger.get("/api/organizations/" + publicId + "/members").getStatusCode().value());
        assertEquals(403, stranger.get("/api/organizations/" + publicId + "/dashboard").getStatusCode().value());
        assertEquals(403, stranger.get("/api/organizations/" + publicId + "/trips").getStatusCode().value());
        assertEquals(403, stranger.get("/api/organizations/" + publicId + "/activity").getStatusCode().value());
    }

    @Test
    void aPrivateOrganizationOpensWithCodeAndPasswordOnly() throws Exception {
        Person owner = person("owner");
        Person rider = person("rider");

        JsonNode org = json(owner.post("/api/organizations", Map.of(
                "name", "Harbour Staff Transport", "visibility", "PRIVATE", "accessPassword", "harbour-2024")));
        long orgId = org.at("/card/id").asLong();
        String code = org.at("/card/orgCode").asText();

        // A wrong password and a code that does not exist give the SAME answer.
        ResponseEntity<String> wrongPassword = rider.post("/api/organizations/access",
                Map.of("orgCode", code, "password", "not-it"));
        ResponseEntity<String> wrongCode = rider.post("/api/organizations/access",
                Map.of("orgCode", "RW-ZZZZZZ", "password", "harbour-2024"));
        assertEquals(403, wrongPassword.getStatusCode().value());
        assertEquals(403, wrongCode.getStatusCode().value());
        assertEquals(json(wrongPassword).get("message").asText(), json(wrongCode).get("message").asText());

        // The right pair opens it — typed carelessly is fine.
        ResponseEntity<String> opened = rider.post("/api/organizations/access",
                Map.of("orgCode", " " + code.toLowerCase().replace("-", " ") + " ", "password", "harbour-2024"));
        assertEquals(200, opened.getStatusCode().value(), opened.getBody());
        assertEquals(orgId, json(opened).get("id").asLong());

        assertEquals(200, rider.get("/api/organizations/" + orgId).getStatusCode().value());
        assertEquals(1, json(rider.get("/api/organizations/saved")).size());

        // The password is never part of any answer.
        assertFalse(rider.get("/api/organizations/" + orgId).getBody().toLowerCase().contains("password"));

        // The owner sees who holds access, and can take it away.
        JsonNode holders = json(owner.get("/api/organizations/" + orgId + "/access"));
        assertEquals(1, holders.get("total").asInt());
        assertEquals(204, owner.delete("/api/organizations/" + orgId + "/access/" + rider.id).getStatusCode().value());
        assertEquals(403, rider.get("/api/organizations/" + orgId).getStatusCode().value());

        // A new password with "everyone must enter it again".
        rider.post("/api/organizations/access", Map.of("orgCode", code, "password", "harbour-2024"));
        assertEquals(200, rider.get("/api/organizations/" + orgId).getStatusCode().value());
        assertEquals(204, owner.put("/api/organizations/" + orgId + "/access-password",
                Map.of("password", "new-harbour-9", "revokeExisting", true)).getStatusCode().value());
        assertEquals(403, rider.get("/api/organizations/" + orgId).getStatusCode().value());
        assertEquals(403, rider.post("/api/organizations/access",
                Map.of("orgCode", code, "password", "harbour-2024")).getStatusCode().value(), "the old password is dead");
        assertEquals(200, rider.post("/api/organizations/access",
                Map.of("orgCode", code, "password", "new-harbour-9")).getStatusCode().value());
    }

    @Test
    void guessingAnAccessPasswordIsSlowedDown() throws Exception {
        Person owner = person("owner");
        Person guesser = person("guesser");
        JsonNode org = json(owner.post("/api/organizations", Map.of(
                "name", "Vault Logistics", "visibility", "PRIVATE", "accessPassword", "correct-horse")));
        String code = org.at("/card/orgCode").asText();

        int status = 0;
        for (int i = 0; i < 8 && status != 429; i++) {
            status = guesser.post("/api/organizations/access",
                    Map.of("orgCode", code, "password", "guess-" + i)).getStatusCode().value();
        }
        assertEquals(429, status, "wrong attempts must lock the guesser out for a while");

        // Even the right password has to wait now.
        assertEquals(429, guesser.post("/api/organizations/access",
                Map.of("orgCode", code, "password", "correct-horse")).getStatusCode().value());
    }

    @Test
    void makingAnOrganizationPrivateRemovesSavedAccess() throws Exception {
        Person owner = person("owner");
        Person follower = person("follower");
        long orgId = createOrg(owner, "Riverside Shuttle", "PUBLIC", null);

        assertEquals(200, follower.put("/api/organizations/" + orgId + "/saved", Map.of()).getStatusCode().value());
        assertEquals(1, json(follower.get("/api/organizations/saved")).size());

        // Going private needs a password …
        assertEquals(400, owner.patch("/api/organizations/" + orgId,
                Map.of("visibility", "PRIVATE")).getStatusCode().value());
        // … and then nobody who merely saved it knows that password.
        assertEquals(200, owner.patch("/api/organizations/" + orgId,
                Map.of("visibility", "PRIVATE", "accessPassword", "riverside-1")).getStatusCode().value());

        assertEquals(403, follower.get("/api/organizations/" + orgId).getStatusCode().value());
        assertEquals(0, json(follower.get("/api/organizations/saved")).size());
        assertFalse(accessRepository.existsByUserIdAndOrgId(follower.id, orgId));
    }

    // ════════════════════════════════════════════════════════
    // PEOPLE — invitations and roles
    // ════════════════════════════════════════════════════════

    @Test
    void joiningIsByInvitationAndRolesAreEnforced() throws Exception {
        Person owner = person("owner");
        Person admin = person("admin");
        Person driver = person("driver");
        Person viewer = person("viewer");
        long orgId = createOrg(owner, "Meridian Transit", "PRIVATE", "meridian-55");
        long vehicleId = addVehicle(owner, orgId, "MT-01");

        // Invited is not joined: nothing is allowed until the person accepts.
        JsonNode invite = json(owner.post("/api/organizations/" + orgId + "/members",
                Map.of("identifier", driver.username, "role", "DRIVER")));
        assertEquals("PENDING", invite.get("status").asText());
        assertNull(textOrNull(invite, "email"), "contact details stay private until the invitation is accepted");
        assertEquals(403, driver.get("/api/organizations/" + orgId).getStatusCode().value());
        assertEquals(403, startTrip(driver, orgId, vehicleId).getStatusCode().value());
        assertTrue(hasNotification(driver.id, "org_invite"));

        JsonNode summary = json(driver.get("/api/organizations/me"));
        assertEquals(1, summary.get("invitations").size());
        long invitationId = summary.at("/invitations/0/memberId").asLong();

        // Somebody else cannot answer it.
        assertEquals(404, viewer.post("/api/organizations/invitations/" + invitationId + "/accept", Map.of())
                .getStatusCode().value());

        assertEquals(200, driver.post("/api/organizations/invitations/" + invitationId + "/accept", Map.of())
                .getStatusCode().value());
        assertEquals(1, json(driver.get("/api/organizations/me")).get("driving").size());
        // A member of a private organization needs no password.
        assertEquals(200, driver.get("/api/organizations/" + orgId + "/vehicles").getStatusCode().value());

        // Inviting twice, or inviting nobody, is refused.
        assertEquals(409, owner.post("/api/organizations/" + orgId + "/members",
                Map.of("identifier", driver.username)).getStatusCode().value());
        assertEquals(404, owner.post("/api/organizations/" + orgId + "/members",
                Map.of("identifier", "nobody-" + SEQ.incrementAndGet())).getStatusCode().value());

        // An admin (by email) and a viewer.
        invite(owner, orgId, admin, "ADMIN", true);
        invite(owner, orgId, viewer, "VIEWER", false);

        // Drivers and viewers manage nothing.
        assertEquals(403, driver.post("/api/organizations/" + orgId + "/vehicles",
                Map.of("vehicleCode", "MT-02")).getStatusCode().value());
        assertEquals(403, viewer.get("/api/organizations/" + orgId + "/members").getStatusCode().value());
        // A viewer sees the fleet but cannot drive.
        assertEquals(200, viewer.get("/api/organizations/" + orgId + "/vehicles").getStatusCode().value());
        assertEquals(403, startTrip(viewer, orgId, vehicleId).getStatusCode().value());

        // Admins manage the fleet, but only the owner appoints or removes admins.
        assertEquals(201, admin.post("/api/organizations/" + orgId + "/vehicles",
                Map.of("vehicleCode", "MT-02")).getStatusCode().value());
        Person other = person("other");
        assertEquals(403, admin.post("/api/organizations/" + orgId + "/members",
                Map.of("identifier", other.username, "role", "ADMIN")).getStatusCode().value());

        JsonNode members = json(owner.get("/api/organizations/" + orgId + "/members"));
        long ownerMemberId = memberId(members, owner.id);
        long adminMemberId = memberId(members, admin.id);
        long driverMemberId = memberId(members, driver.id);
        assertEquals("OWNER", members.get(0).get("role").asText(), "the owner is listed first");

        assertEquals(403, admin.delete("/api/organizations/" + orgId + "/members/" + ownerMemberId)
                .getStatusCode().value(), "nobody removes the owner");
        assertEquals(400, admin.patch("/api/organizations/" + orgId + "/members/" + adminMemberId,
                Map.of("role", "DRIVER")).getStatusCode().value(), "nobody changes their own membership");
        assertEquals(403, admin.patch("/api/organizations/" + orgId + "/members/" + driverMemberId,
                Map.of("role", "ADMIN")).getStatusCode().value(), "only the owner appoints admins");
        assertEquals(409, owner.post("/api/organizations/" + orgId + "/leave", Map.of())
                .getStatusCode().value(), "the owner cannot simply leave");

        // A removed driver is out at once — also out of the private organization's pages.
        assertEquals(204, admin.delete("/api/organizations/" + orgId + "/members/" + driverMemberId)
                .getStatusCode().value());
        assertEquals(403, startTrip(driver, orgId, vehicleId).getStatusCode().value());
        assertEquals(403, driver.get("/api/organizations/" + orgId).getStatusCode().value());
        assertEquals(0, json(driver.get("/api/organizations/me")).get("driving").size());
    }

    @Test
    void ownershipCanBeHandedOver() throws Exception {
        Person owner = person("owner");
        Person successor = person("successor");
        long orgId = createOrg(owner, "Handover Lines", "PUBLIC", null);
        invite(owner, orgId, successor, "ADMIN", false);
        long successorMemberId = memberId(json(owner.get("/api/organizations/" + orgId + "/members")), successor.id);

        assertEquals(403, successor.delete("/api/organizations/" + orgId).getStatusCode().value(),
                "an admin cannot delete the organization");

        ResponseEntity<String> transferred = owner.post("/api/organizations/" + orgId + "/transfer",
                Map.of("memberId", successorMemberId));
        assertEquals(200, transferred.getStatusCode().value(), transferred.getBody());
        assertFalse(json(transferred).get("owner").asBoolean());
        assertTrue(json(transferred).get("canManage").asBoolean(), "the previous owner stays on as an admin");
        assertTrue(json(successor.get("/api/organizations/" + orgId)).get("owner").asBoolean());

        assertEquals(403, owner.delete("/api/organizations/" + orgId).getStatusCode().value());
        assertEquals(204, successor.delete("/api/organizations/" + orgId).getStatusCode().value());
        assertEquals(404, successor.get("/api/organizations/" + orgId).getStatusCode().value());
        assertEquals(0, json(owner.get("/api/organizations/me")).get("managed").size());
    }

    // ════════════════════════════════════════════════════════
    // VEHICLES AND THE LOCK
    // ════════════════════════════════════════════════════════

    @Test
    void oneTripPerVehicleAndPerDriver() throws Exception {
        Person owner = person("owner");
        Person arun = person("arun");
        Person bala = person("bala");
        long orgId = createOrg(owner, "Lockwood Buses", "PUBLIC", null);
        invite(owner, orgId, arun, "DRIVER", false);
        invite(owner, orgId, bala, "DRIVER", false);
        long bus1 = addVehicle(owner, orgId, "BUS-01");
        long bus2 = addVehicle(owner, orgId, "BUS-02");

        // The same code again (any letter case) is refused.
        assertEquals(409, owner.post("/api/organizations/" + orgId + "/vehicles",
                Map.of("vehicleCode", "bus-01")).getStatusCode().value());

        ResponseEntity<String> started = startTrip(arun, orgId, bus1);
        assertEquals(201, started.getStatusCode().value(), started.getBody());
        long tripId = json(started).at("/session/id").asLong();

        // The vehicle is taken …
        ResponseEntity<String> taken = startTrip(bala, orgId, bus1);
        assertEquals(409, taken.getStatusCode().value());
        assertTrue(json(taken).get("message").asText().contains(arun.username), "says who is using it");
        // … and the driver is busy.
        assertEquals(409, startTrip(arun, orgId, bus2).getStatusCode().value());

        // Everyone sees it as in use, with its driver's name — but not the phone number.
        JsonNode fleet = json(bala.get("/api/organizations/" + orgId + "/vehicles"));
        JsonNode liveBus = find(fleet, bus1);
        assertEquals(arun.username, liveBus.at("/trip/driverName").asText());
        assertNull(textOrNull(liveBus.get("trip"), "driverPhone"), "a driver's number is not public by default");
        assertTrue(find(fleet, bus2).get("trip").isNull());

        // A vehicle on a trip cannot be sent to repair or removed.
        assertEquals(409, owner.put("/api/organizations/" + orgId + "/vehicles/" + bus1 + "/status",
                Map.of("status", "REPAIR")).getStatusCode().value());
        assertEquals(409, owner.delete("/api/organizations/" + orgId + "/vehicles/" + bus1).getStatusCode().value());

        // Only its driver ends the trip (an admin uses "end" instead).
        assertEquals(403, bala.post("/api/vehicle-sessions/" + tripId + "/stop", Map.of()).getStatusCode().value());
        JsonNode ended = json(arun.post("/api/vehicle-sessions/" + tripId + "/stop", Map.of()));
        assertEquals("CANCELLED", ended.get("status").asText(), "a trip that never sent a position is not a trip");

        // Free again.
        ResponseEntity<String> next = startTrip(bala, orgId, bus1);
        assertEquals(201, next.getStatusCode().value(), next.getBody());
        bala.post("/api/vehicle-sessions/" + json(next).at("/session/id").asLong() + "/stop", Map.of());

        // A vehicle under repair cannot be taken out.
        assertEquals(200, owner.put("/api/organizations/" + orgId + "/vehicles/" + bus2 + "/status",
                Map.of("status", "REPAIR")).getStatusCode().value());
        assertEquals(409, startTrip(arun, orgId, bus2).getStatusCode().value());

        // Removing: history keeps its vehicle (retired), an unused one is really deleted.
        assertFalse(json(owner.delete("/api/organizations/" + orgId + "/vehicles/" + bus1)).get("deleted").asBoolean());
        long bus3 = addVehicle(owner, orgId, "BUS-03");
        assertTrue(json(owner.delete("/api/organizations/" + orgId + "/vehicles/" + bus3)).get("deleted").asBoolean());
        assertNull(find(json(bala.get("/api/organizations/" + orgId + "/vehicles")), bus1),
                "retired vehicles are hidden from everyone but the admins");
        assertEquals("RETIRED", find(json(owner.get("/api/organizations/" + orgId + "/vehicles")), bus1)
                .get("status").asText());
    }

    // ════════════════════════════════════════════════════════
    // TRIPS — positions, measuring, ending
    // ════════════════════════════════════════════════════════

    @Test
    void theServerMeasuresDistanceAndSpeeding() throws Exception {
        Person owner = person("owner");
        Person driver = person("driver");
        Person stranger = person("stranger");
        long orgId = createOrg(owner, "Tachograph Tours", "PUBLIC", null);
        assertEquals(200, owner.patch("/api/organizations/" + orgId, Map.of("speedLimitKmh", 40))
                .getStatusCode().value());
        invite(owner, orgId, driver, "DRIVER", false);
        long vehicleId = addVehicle(owner, orgId, "TT-7");

        Map<String, Object> request = new HashMap<>();
        request.put("orgId", orgId);
        request.put("vehicleId", vehicleId);
        request.put("destinationName", "Central Station, Chennai");
        request.put("destinationLat", 13.0827);
        request.put("destinationLng", 80.2707);
        request.put("routeCoordinates", "[[13.0500,80.2500],[13.0827,80.2707]]");
        request.put("distanceMeters", 4300.0);
        request.put("durationSeconds", 780.0);
        ResponseEntity<String> started = driver.post("/api/vehicle-sessions", request);
        assertEquals(201, started.getStatusCode().value(), started.getBody());
        long tripId = json(started).at("/session/id").asLong();
        assertEquals("[[13.0500,80.2500],[13.0827,80.2707]]", json(started).at("/route/routeCoordinates").asText());

        // Somebody else cannot report this vehicle's position.
        assertEquals(403, stranger.post("/api/vehicle-sessions/" + tripId + "/position",
                Map.of("lat", 13.05, "lng", 80.25)).getStatusCode().value());

        // Three fixes ~111 m apart; the middle one well over the limit.
        assertTrue(position(driver, tripId, 13.0500, 80.2500, 8.0, 5.0));
        // Anything faster than about one fix a second is a flood and dropped.
        assertFalse(position(driver, tripId, 13.0501, 80.2500, 8.0, 5.0));
        Thread.sleep(900);
        assertTrue(position(driver, tripId, 13.0510, 80.2500, 8.0, 20.0)); // 72 km/h
        Thread.sleep(900);
        assertTrue(position(driver, tripId, 13.0520, 80.2500, 8.0, 6.0));
        // A fix with no real accuracy is not a position.
        Thread.sleep(900);
        assertFalse(position(driver, tripId, 13.2, 80.4, 900.0, 5.0));

        JsonNode running = json(driver.get("/api/vehicle-sessions/active")).get("session");
        assertEquals(222, running.get("distanceMeters").asDouble(), 6, "about 222 m driven");
        assertEquals(72, running.get("maxSpeedKmh").asDouble(), 0.5);
        assertEquals(1, running.get("overspeedCount").asInt(), "one stretch over the limit, counted once");

        // People following the vehicle see where it is — not how fast its driver went.
        JsonNode tracked = json(stranger.get("/api/organizations/" + orgId + "/vehicles/" + vehicleId));
        assertEquals(13.0520, tracked.at("/vehicle/trip/lat").asDouble(), 1e-6);
        assertEquals("Central Station, Chennai", tracked.at("/vehicle/trip/destinationName").asText());
        assertNotNull(tracked.at("/route/routeCoordinates").asText(null), "the planned road is there");
        assertTrue(tracked.at("/route/routeSteps").isNull() || tracked.at("/route/routeSteps").isMissingNode());

        JsonNode ended = json(driver.post("/api/vehicle-sessions/" + tripId + "/stop", Map.of()));
        assertEquals("COMPLETED", ended.get("status").asText());
        assertEquals("DRIVER", ended.get("endReason").asText());
        assertEquals(222, ended.get("distanceMeters").asDouble(), 6);

        // After the trip: no more positions, the vehicle remembers where it stopped.
        assertEquals(409, driver.post("/api/vehicle-sessions/" + tripId + "/position",
                Map.of("lat", 13.06, "lng", 80.25)).getStatusCode().value());
        assertEquals(204, driver.get("/api/vehicle-sessions/active").getStatusCode().value());
        JsonNode parked = json(stranger.get("/api/organizations/" + orgId + "/vehicles/" + vehicleId));
        assertTrue(parked.at("/vehicle/trip").isNull());
        assertEquals(13.0520, parked.at("/vehicle/lastLat").asDouble(), 1e-6);
        assertEquals(tripId, parked.at("/lastTrip/id").asLong());
        assertTrue(parked.at("/lastTrip/maxSpeedKmh").isNull(), "driving records are not public");

        // History, replay, statistics — for the admins.
        JsonNode history = json(owner.get("/api/organizations/" + orgId + "/trips"));
        assertEquals(1, history.get("total").asInt());
        assertEquals(1, history.at("/items/0/overspeedCount").asInt());
        JsonNode track = json(owner.get("/api/vehicle-sessions/" + tripId + "/track"));
        assertTrue(track.get("points").size() >= 1, "a path was recorded for the replay");
        assertEquals(403, stranger.get("/api/vehicle-sessions/" + tripId + "/track").getStatusCode().value());
        assertEquals(1, json(driver.get("/api/vehicle-sessions/mine")).get("total").asInt());

        JsonNode stats = json(owner.get("/api/organizations/" + orgId + "/analytics?days=7&tz=330"));
        assertEquals(7, stats.get("daily").size());
        assertEquals(1, stats.get("trips").asInt());
        assertEquals(222, stats.get("distanceMeters").asDouble(), 6);
        assertEquals(1, stats.get("overspeedCount").asInt());
        assertEquals(driver.username, stats.at("/drivers/0/name").asText());
        assertEquals("TT-7", stats.at("/vehicles/0/vehicleCode").asText());
        assertEquals(1, stats.at("/daily/6/trips").asInt(), "today is the last day of the series");

        JsonNode dashboard = json(owner.get("/api/organizations/" + orgId + "/dashboard?tz=330"));
        assertEquals(1, dashboard.get("tripsToday").asInt());
        assertEquals(1, dashboard.get("vehicles").asInt());
        assertEquals(1, dashboard.get("drivers").asInt());
        assertTrue(dashboard.get("activity").size() >= 3, "the activity log recorded what happened");
    }

    @Test
    void aSavedRouteIsCopiedIntoTheTrip() throws Exception {
        Person owner = person("owner");
        long orgId = createOrg(owner, "Loop Line", "PUBLIC", null);
        long vehicleId = addVehicle(owner, orgId, "LOOP-1");

        Map<String, Object> route = new HashMap<>();
        route.put("name", "Morning loop");
        route.put("fromName", "Depot");
        route.put("fromLat", 12.90);
        route.put("fromLng", 80.10);
        route.put("destinationName", "Campus gate");
        route.put("destinationLat", 12.95);
        route.put("destinationLng", 80.15);
        route.put("routeCoordinates", "[[12.90,80.10],[12.92,80.12],[12.95,80.15]]");
        route.put("distanceMeters", 7600.0);
        route.put("durationSeconds", 900.0);
        route.put("stops", java.util.List.of(Map.of("name", "Market", "lat", 12.92, "lng", 80.12)));
        ResponseEntity<String> saved = owner.post("/api/organizations/" + orgId + "/routes", route);
        assertEquals(201, saved.getStatusCode().value(), saved.getBody());
        long routeId = json(saved).get("id").asLong();

        // Lists carry the stops but not the heavy geometry.
        JsonNode listed = json(owner.get("/api/organizations/" + orgId + "/routes"));
        assertEquals(1, listed.get(0).get("stops").size());
        assertTrue(listed.get(0).get("routeCoordinates").isNull());

        JsonNode trip = json(owner.post("/api/vehicle-sessions",
                Map.of("orgId", orgId, "vehicleId", vehicleId, "routeId", routeId)));
        long tripId = trip.at("/session/id").asLong();
        assertEquals("Morning loop", trip.at("/session/routeName").asText());
        assertEquals("Campus gate", trip.at("/session/destinationName").asText());
        assertEquals("Market", trip.at("/route/stops/0/name").asText());

        // Deleting the route does not touch the trip that is using it.
        assertEquals(204, owner.delete("/api/organizations/" + orgId + "/routes/" + routeId).getStatusCode().value());
        JsonNode still = json(owner.get("/api/vehicle-sessions/active"));
        assertEquals("[[12.90,80.10],[12.92,80.12],[12.95,80.15]]", still.at("/route/routeCoordinates").asText());

        owner.post("/api/vehicle-sessions/" + tripId + "/stop", Map.of());
    }

    @Test
    void aTripNobodyEndedIsEndedForThem() throws Exception {
        Person owner = person("owner");
        Person driver = person("driver");
        long orgId = createOrg(owner, "Forgetful Fleet", "PUBLIC", null);
        invite(owner, orgId, driver, "DRIVER", false);
        long vehicleId = addVehicle(owner, orgId, "FF-1");

        // 1. By an admin.
        long first = json(startTrip(driver, orgId, vehicleId)).at("/session/id").asLong();
        assertTrue(position(driver, first, 11.0, 77.0, 10.0, 3.0));
        JsonNode forced = json(owner.post("/api/vehicle-sessions/" + first + "/end", Map.of()));
        assertEquals("COMPLETED", forced.get("status").asText());
        assertEquals("ADMIN", forced.get("endReason").asText());
        assertTrue(hasNotification(driver.id, "vehicle_session_ended"), "the driver is told");
        assertEquals(409, driver.post("/api/vehicle-sessions/" + first + "/position",
                Map.of("lat", 11.001, "lng", 77.0)).getStatusCode().value(), "their phone is told to stop sending");

        // 2. Automatically. A trip whose phone is still reporting is left alone …
        long second = json(startTrip(driver, orgId, vehicleId)).at("/session/id").asLong();
        assertFalse(sessionService.endByTimeout(second, 30), "heard from a moment ago — not abandoned");
        assertEquals("ACTIVE", sessionRepository.findById(second).orElseThrow().getStatus());
        // … one that went silent is ended and its vehicle is free again.
        assertTrue(sessionService.endByTimeout(second, 0));
        assertEquals("TIMEOUT", sessionRepository.findById(second).orElseThrow().getEndReason());
        assertEquals(201, startTrip(driver, orgId, vehicleId).getStatusCode().value());

        // 3. Because the driver was suspended in the organization.
        long driverMemberId = memberId(json(owner.get("/api/organizations/" + orgId + "/members")), driver.id);
        assertEquals(200, owner.patch("/api/organizations/" + orgId + "/members/" + driverMemberId,
                Map.of("status", "SUSPENDED")).getStatusCode().value());
        assertEquals(204, driver.get("/api/vehicle-sessions/active").getStatusCode().value());
        assertEquals(403, startTrip(driver, orgId, vehicleId).getStatusCode().value());
        assertEquals(200, owner.patch("/api/organizations/" + orgId + "/members/" + driverMemberId,
                Map.of("status", "ACTIVE")).getStatusCode().value());
        assertEquals(201, startTrip(driver, orgId, vehicleId).getStatusCode().value());
    }

    @Test
    void emergenciesAndSeatsAreSharedLive() throws Exception {
        Person owner = person("owner");
        Person driver = person("driver");
        Person stranger = person("stranger");
        long orgId = createOrg(owner, "Signal Coaches", "PUBLIC", null);
        invite(owner, orgId, driver, "DRIVER", false);
        long vehicleId = addVehicle(owner, orgId, "SC-9");
        long tripId = json(startTrip(driver, orgId, vehicleId)).at("/session/id").asLong();

        assertEquals(403, stranger.put("/api/vehicle-sessions/" + tripId + "/crowd",
                Map.of("level", "FULL")).getStatusCode().value());
        assertEquals("FULL", json(driver.put("/api/vehicle-sessions/" + tripId + "/crowd",
                Map.of("level", "full"))).get("crowdLevel").asText());

        // Only the driver raises an emergency; the admins are notified.
        assertEquals(403, owner.put("/api/vehicle-sessions/" + tripId + "/sos",
                Map.of("active", true)).getStatusCode().value());
        JsonNode raised = json(driver.put("/api/vehicle-sessions/" + tripId + "/sos",
                Map.of("active", true, "message", "Flat tyre near the bridge")));
        assertTrue(raised.get("sosActive").asBoolean());
        assertTrue(hasNotification(owner.id, "vehicle_sos"));
        assertEquals(1, json(owner.get("/api/organizations/" + orgId + "/dashboard")).get("sosActive").asInt());

        JsonNode seen = find(json(stranger.get("/api/organizations/" + orgId + "/vehicles")), vehicleId);
        assertTrue(seen.at("/trip/sos").asBoolean());
        assertEquals("FULL", seen.at("/trip/crowdLevel").asText());

        // An admin may clear it.
        assertFalse(json(owner.put("/api/vehicle-sessions/" + tripId + "/sos",
                Map.of("active", false))).get("sosActive").asBoolean());

        driver.post("/api/vehicle-sessions/" + tripId + "/stop", Map.of());
    }

    @Test
    void anAlertFiresOnceWhenTheVehicleComesNear() throws Exception {
        Person owner = person("owner");
        Person waiting = person("waiting");
        long orgId = createOrg(owner, "Nearly There Buses", "PUBLIC", null);
        long vehicleId = addVehicle(owner, orgId, "NT-3");

        Map<String, Object> alert = new HashMap<>();
        alert.put("vehicleId", vehicleId);
        alert.put("label", "Lake View stop");
        alert.put("lat", 10.0000);
        alert.put("lng", 76.0000);
        alert.put("radiusMeters", 500);
        assertEquals(200, waiting.put("/api/vehicle-alerts", alert).getStatusCode().value());
        assertEquals("Lake View stop", json(waiting.get("/api/organizations/" + orgId + "/vehicles/" + vehicleId))
                .at("/myAlert/label").asText());

        long tripId = json(startTrip(owner, orgId, vehicleId)).at("/session/id").asLong();
        assertTrue(position(owner, tripId, 10.0500, 76.0000, 10.0, 8.0)); // 5.5 km away
        assertFalse(hasNotification(waiting.id, "vehicle_alert"));

        // Positions are stored (and alerts checked) every few seconds.
        Thread.sleep(5_200);

        // A leap of five kilometres in a few seconds is refused as a GPS jump …
        assertFalse(position(owner, tripId, 10.0020, 76.0000, 10.0, 8.0));
        assertFalse(position(owner, tripId, 10.0020, 76.0000, 10.0, 8.0));
        assertFalse(position(owner, tripId, 10.0020, 76.0000, 10.0, 8.0));
        // … but a device that keeps insisting is believed: the EARLIER fix was the wrong one.
        assertTrue(position(owner, tripId, 10.0020, 76.0000, 10.0, 8.0));
        assertTrue(json(owner.get("/api/vehicle-sessions/active")).at("/session/distanceMeters").asDouble() < 50,
                "a corrected position is not distance driven");

        assertTrue(hasNotification(waiting.id, "vehicle_alert"), "told when the bus came within 500 m");
        long told = countNotifications(waiting.id, "vehicle_alert");

        Thread.sleep(5_200);
        assertTrue(position(owner, tripId, 10.0021, 76.0000, 10.0, 2.0));
        assertEquals(told, countNotifications(waiting.id, "vehicle_alert"), "once per trip, not once per position");

        owner.post("/api/vehicle-sessions/" + tripId + "/stop", Map.of());
        assertEquals(204, waiting.delete("/api/vehicle-alerts/" + vehicleId).getStatusCode().value());
    }

    @Test
    void announcementsReachMembersAndFollowers() throws Exception {
        Person owner = person("owner");
        Person follower = person("follower");
        Person stranger = person("stranger");
        long orgId = createOrg(owner, "Bulletin Buses", "PUBLIC", null);
        follower.put("/api/organizations/" + orgId + "/saved", Map.of());

        assertEquals(403, follower.post("/api/organizations/" + orgId + "/announcements",
                Map.of("title", "Hi", "message", "I am not an admin")).getStatusCode().value());

        ResponseEntity<String> posted = owner.post("/api/organizations/" + orgId + "/announcements",
                Map.of("title", "Route 4 starts late", "message", "Twenty minutes late today.", "level", "WARNING"));
        assertEquals(201, posted.getStatusCode().value(), posted.getBody());

        assertTrue(hasNotification(follower.id, "org_announcement"));
        assertFalse(hasNotification(stranger.id, "org_announcement"));
        assertFalse(hasNotification(owner.id, "org_announcement"), "not sent back to its author");

        JsonNode list = json(stranger.get("/api/organizations/" + orgId + "/announcements"));
        assertEquals("Route 4 starts late", list.get(0).get("title").asText());
        long announcementId = list.get(0).get("id").asLong();
        assertEquals(204, owner.delete("/api/organizations/" + orgId + "/announcements/" + announcementId)
                .getStatusCode().value());
        assertEquals(0, json(stranger.get("/api/organizations/" + orgId + "/announcements")).size());
    }

    @Test
    void thePlatformAdminCanVerifyAndSuspend() throws Exception {
        Person platformAdmin = person("root", "ADMIN");
        Person owner = person("owner");
        Person stranger = person("stranger");
        long orgId = createOrg(owner, "Suspendable Shuttles", "PUBLIC", null);
        long vehicleId = addVehicle(owner, orgId, "SS-1");
        long tripId = json(startTrip(owner, orgId, vehicleId)).at("/session/id").asLong();

        assertEquals(403, owner.get("/api/admin/organizations").getStatusCode().value());
        assertEquals(403, owner.patch("/api/admin/organizations/" + orgId,
                Map.of("verified", true)).getStatusCode().value());

        assertTrue(json(platformAdmin.get("/api/admin/organizations?search=suspendable")).get("total").asInt() >= 1);
        assertEquals(204, platformAdmin.patch("/api/admin/organizations/" + orgId,
                Map.of("verified", true)).getStatusCode().value());
        assertTrue(json(stranger.get("/api/organizations/" + orgId)).at("/card/verified").asBoolean());

        assertEquals(204, platformAdmin.patch("/api/admin/organizations/" + orgId,
                Map.of("status", "SUSPENDED")).getStatusCode().value());

        // Its trips end, nobody outside can see it, nothing can be started.
        assertFalse(sessionRepository.findById(tripId).orElseThrow().isActive());
        assertEquals(403, stranger.get("/api/organizations/" + orgId).getStatusCode().value());
        assertEquals(403, startTrip(owner, orgId, vehicleId).getStatusCode().value());
        // Its own admins can still open it and see why.
        assertEquals("SUSPENDED", json(owner.get("/api/organizations/" + orgId)).at("/card/status").asText());
        assertTrue(hasNotification(owner.id, "org_notice"));

        assertEquals(204, platformAdmin.patch("/api/admin/organizations/" + orgId,
                Map.of("status", "ACTIVE")).getStatusCode().value());
        assertEquals(200, stranger.get("/api/organizations/" + orgId).getStatusCode().value());
        assertTrue(json(platformAdmin.get("/api/admin/dashboard")).get("totalOrganizations").asInt() >= 1);
    }

    // ════════════════════════════════════════════════════════
    // LIVE — the /ws/fleet socket
    // ════════════════════════════════════════════════════════

    @Test
    void watchersFollowAVehicleAcrossTrips() throws Exception {
        Person owner = person("owner");
        Person driver = person("driver");
        Person watcher = person("watcher");
        long orgId = createOrg(owner, "Livewire Lines", "PUBLIC", null);
        invite(owner, orgId, driver, "DRIVER", false);
        long vehicleId = addVehicle(owner, orgId, "LW-1");

        Listener watching = new Listener();
        Listener fleetMap = new Listener();
        Listener driving = new Listener();
        WebSocketSession watcherWs = socket(watcher, watching);
        WebSocketSession ownerWs = socket(owner, fleetMap);
        WebSocketSession driverWs = socket(driver, driving);
        try {
            // Watching starts BEFORE the vehicle is on a trip.
            send(watcherWs, Map.of("type", "watch-vehicle", "vehicleId", vehicleId));
            send(ownerWs, Map.of("type", "watch-org", "orgId", orgId));
            assertNotNull(watching.await("watching", 5000), "vehicle watch acknowledged");
            assertNotNull(fleetMap.await("watching", 5000), "fleet watch acknowledged");

            long tripId = json(startTrip(driver, orgId, vehicleId)).at("/session/id").asLong();
            JsonNode wentLive = watching.await("session-started", 5000);
            assertNotNull(wentLive, "the vehicle went live for the person watching it");
            assertEquals(tripId, wentLive.get("sessionId").asLong());
            assertNotNull(fleetMap.await("session-started", 5000), "… and on the fleet map");

            // The driver's phone reports over the socket.
            send(driverWs, Map.of("type", "position", "sessionId", tripId,
                    "lat", 12.9716, "lng", 77.5946, "accuracy", 6, "speed", 9.5, "heading", 270));
            JsonNode moved = watching.await("position", 5000);
            assertNotNull(moved, "the watcher sees the position");
            assertEquals(12.9716, moved.get("lat").asDouble(), 1e-9);
            assertEquals(vehicleId, moved.get("vehicleId").asLong());
            assertEquals(270, moved.get("heading").asDouble(), 1e-9);
            assertNotNull(fleetMap.await("position", 5000), "the fleet map sees it too");

            // A stranger's socket cannot inject a position for this trip.
            Listener intruding = new Listener();
            WebSocketSession intruderWs = socket(watcher, intruding);
            try {
                send(intruderWs, Map.of("type", "position", "sessionId", tripId, "lat", 1.0, "lng", 1.0));
                JsonNode refused = intruding.await("error", 5000);
                assertNotNull(refused);
                assertEquals("position-refused", refused.get("code").asText());
            } finally {
                close(intruderWs);
            }

            driver.put("/api/vehicle-sessions/" + tripId + "/sos", Map.of("active", true));
            JsonNode sos = fleetMap.await("sos", 5000);
            assertNotNull(sos, "an emergency appears on the fleet map at once");
            assertTrue(sos.get("active").asBoolean());

            driver.post("/api/vehicle-sessions/" + tripId + "/stop", Map.of());
            JsonNode over = watching.await("session-ended", 5000);
            assertNotNull(over, "the watcher is told the trip ended");
            assertEquals("DRIVER", over.get("reason").asText());

            // The driver's phone, should it still be sending, is told to stop.
            Thread.sleep(900);
            send(driverWs, Map.of("type", "position", "sessionId", tripId, "lat", 12.9720, "lng", 77.5946));
            JsonNode stopSending = driving.await("error", 5000);
            assertNotNull(stopSending);
            assertEquals("trip-ended", stopSending.get("code").asText());

            // Same watcher, same socket, next trip: live again without asking twice.
            long nextTrip = json(startTrip(driver, orgId, vehicleId)).at("/session/id").asLong();
            JsonNode again = watching.await("session-started", 5000);
            assertNotNull(again, "a new trip of the watched vehicle goes live on the same socket");
            assertEquals(nextTrip, again.get("sessionId").asLong());
            driver.post("/api/vehicle-sessions/" + nextTrip + "/stop", Map.of());
        } finally {
            close(watcherWs);
            close(ownerWs);
            close(driverWs);
        }
    }

    @Test
    void aPrivateFleetCannotBeWatchedWithoutAccess() throws Exception {
        Person owner = person("owner");
        Person outsider = person("outsider");
        JsonNode org = json(owner.post("/api/organizations", Map.of(
                "name", "Closed Circuit Cabs", "visibility", "PRIVATE", "accessPassword", "closed-circuit")));
        long orgId = org.at("/card/id").asLong();
        String code = org.at("/card/orgCode").asText();
        long vehicleId = addVehicle(owner, orgId, "CC-1");

        Listener listener = new Listener();
        WebSocketSession ws = socket(outsider, listener);
        try {
            send(ws, Map.of("type", "watch-vehicle", "vehicleId", vehicleId));
            JsonNode refused = listener.await("error", 5000);
            assertNotNull(refused, "watching a private vehicle is refused");
            assertEquals("forbidden", refused.get("code").asText());

            send(ws, Map.of("type", "watch-org", "orgId", orgId));
            assertEquals("forbidden", listener.await("error", 5000).get("code").asText());

            // Nothing leaks: a position sent now never reaches this socket.
            long tripId = json(startTrip(owner, orgId, vehicleId)).at("/session/id").asLong();
            assertTrue(position(owner, tripId, 9.9312, 76.2673, 8.0, 4.0));
            assertNull(listener.await("position", 700), "no live data without access");
            assertNull(listener.await("session-started", 100));

            // With the code and password it works — until the access is taken away.
            assertEquals(200, outsider.post("/api/organizations/access",
                    Map.of("orgCode", code, "password", "closed-circuit")).getStatusCode().value());
            send(ws, Map.of("type", "watch-vehicle", "vehicleId", vehicleId));
            assertNotNull(listener.await("watching", 5000));
            Thread.sleep(900);
            assertTrue(position(owner, tripId, 9.9320, 76.2673, 8.0, 4.0));
            assertNotNull(listener.await("position", 5000), "now the position arrives");

            assertEquals(204, owner.delete("/api/organizations/" + orgId + "/access/" + outsider.id)
                    .getStatusCode().value());
            assertNotNull(listener.await("access-changed", 5000), "the open map is told it lost access");
            Thread.sleep(900);
            assertTrue(position(owner, tripId, 9.9330, 76.2673, 8.0, 4.0));
            assertNull(listener.await("position", 700), "and receives nothing more");

            owner.post("/api/vehicle-sessions/" + tripId + "/stop", Map.of());
        } finally {
            close(ws);
        }
    }

    @Test
    void theSocketNeedsALogin() {
        org.junit.jupiter.api.Assertions.assertThrows(Exception.class,
                () -> new StandardWebSocketClient()
                        .execute(new Listener(), new WebSocketHttpHeaders(),
                                URI.create("ws://localhost:" + port + "/ws/fleet"))
                        .get(5, TimeUnit.SECONDS),
                "an anonymous handshake must be refused");
    }

    // ════════════════════════════════════════════════════════
    // HELPERS
    // ════════════════════════════════════════════════════════

    /** A signed-in test account that can call the API. */
    private final class Person {
        final long id;
        final String username;
        final String email;
        final String cookie;

        Person(long id, String username, String email, String cookie) {
            this.id = id;
            this.username = username;
            this.email = email;
            this.cookie = cookie;
        }

        ResponseEntity<String> get(String path) {
            return call(HttpMethod.GET, path, null);
        }

        ResponseEntity<String> post(String path, Object body) throws Exception {
            return call(HttpMethod.POST, path, body);
        }

        ResponseEntity<String> put(String path, Object body) throws Exception {
            return call(HttpMethod.PUT, path, body);
        }

        ResponseEntity<String> patch(String path, Object body) throws Exception {
            return call(HttpMethod.PATCH, path, body);
        }

        ResponseEntity<String> delete(String path) {
            return call(HttpMethod.DELETE, path, null);
        }

        private ResponseEntity<String> call(HttpMethod method, String path, Object body) {
            HttpHeaders headers = new HttpHeaders();
            headers.add("Cookie", cookie);
            String payload = null;
            if (body != null) {
                headers.setContentType(MediaType.APPLICATION_JSON);
                try {
                    payload = objectMapper.writeValueAsString(body);
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            }
            return rest.exchange(path, method, new HttpEntity<>(payload, headers), String.class);
        }
    }

    private Person person(String label) throws Exception {
        return person(label, null);
    }

    private Person person(String label, String role) throws Exception {
        int n = SEQ.incrementAndGet();
        String secret = "pw-" + java.util.UUID.randomUUID();
        User user = new User();
        user.setUsername("fleet_" + label + "_" + n);
        user.setEmail("fleet_" + label + "_" + n + "@test.com");
        user.setMobile("+91 90000 " + String.format("%05d", n));
        user.setPassword(passwordEncoder.encode(secret));
        if (role != null) user.setRole(role);
        User saved = userRepository.save(user);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String body = objectMapper.writeValueAsString(Map.of("email", saved.getEmail(), "password", secret));
        ResponseEntity<String> res = rest.postForEntity("/api/auth/login", new HttpEntity<>(body, headers), String.class);
        assertEquals(200, res.getStatusCode().value(), "login should succeed");
        String cookie = res.getHeaders().getFirst("Set-Cookie");
        assertNotNull(cookie, "login must return a session cookie");
        return new Person(saved.getId(), saved.getUsername(), saved.getEmail(), cookie.split(";")[0]);
    }

    private long createOrg(Person owner, String name, String visibility, String password) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("name", name);
        body.put("orgType", "TRANSPORT");
        body.put("visibility", visibility);
        if (password != null) body.put("accessPassword", password);
        ResponseEntity<String> res = owner.post("/api/organizations", body);
        assertEquals(201, res.getStatusCode().value(), res.getBody());
        return json(res).at("/card/id").asLong();
    }

    private long addVehicle(Person manager, long orgId, String code) throws Exception {
        ResponseEntity<String> res = manager.post("/api/organizations/" + orgId + "/vehicles",
                Map.of("vehicleCode", code, "vehicleType", "BUS", "capacity", 40));
        assertEquals(201, res.getStatusCode().value(), res.getBody());
        return json(res).get("id").asLong();
    }

    /** Invite and accept. */
    private void invite(Person manager, long orgId, Person target, String role, boolean byEmail) throws Exception {
        ResponseEntity<String> invited = manager.post("/api/organizations/" + orgId + "/members",
                Map.of("identifier", byEmail ? target.email.toUpperCase() : target.username, "role", role));
        assertEquals(201, invited.getStatusCode().value(), invited.getBody());
        long invitationId = json(invited).get("id").asLong();
        ResponseEntity<String> accepted = target.post(
                "/api/organizations/invitations/" + invitationId + "/accept", Map.of());
        assertEquals(200, accepted.getStatusCode().value(), accepted.getBody());
    }

    private ResponseEntity<String> startTrip(Person driver, long orgId, long vehicleId) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("orgId", orgId);
        body.put("vehicleId", vehicleId);
        body.put("destinationName", "Terminus");
        body.put("destinationLat", 12.5);
        body.put("destinationLng", 78.5);
        return driver.post("/api/vehicle-sessions", body);
    }

    /** POST one GPS fix; true when the server used it. */
    private boolean position(Person driver, long tripId, double lat, double lng, Double accuracy, Double speed)
            throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("lat", lat);
        body.put("lng", lng);
        body.put("accuracy", accuracy);
        body.put("speed", speed);
        ResponseEntity<String> res = driver.post("/api/vehicle-sessions/" + tripId + "/position", body);
        assertEquals(200, res.getStatusCode().value(), res.getBody());
        return json(res).get("accepted").asBoolean();
    }

    private JsonNode json(ResponseEntity<String> response) throws Exception {
        assertNotNull(response.getBody(), "expected a body, got status " + response.getStatusCode());
        return objectMapper.readTree(response.getBody());
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static JsonNode find(JsonNode list, long id) {
        for (JsonNode item : list) {
            if (item.get("id").asLong() == id) return item;
        }
        return null;
    }

    private static long memberId(JsonNode members, long userId) {
        for (JsonNode member : members) {
            if (member.get("userId").asLong() == userId) return member.get("id").asLong();
        }
        throw new AssertionError("user #" + userId + " is not in the member list: " + members);
    }

    private boolean hasNotification(long userId, String type) {
        return countNotifications(userId, type) > 0;
    }

    private long countNotifications(long userId, String type) {
        return notificationRepository.findAll().stream()
                .filter(n -> n.getUserId() != null && n.getUserId() == userId && type.equals(n.getType()))
                .count();
    }

    // ── WebSocket ──

    private WebSocketSession socket(Person person, Listener listener) throws Exception {
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.add("Cookie", person.cookie);
        WebSocketSession session = new StandardWebSocketClient()
                .execute(listener, headers, URI.create("ws://localhost:" + port + "/ws/fleet"))
                .get(5, TimeUnit.SECONDS);
        assertNotNull(listener.await("connected", 5000), "the socket says hello");
        return session;
    }

    private void send(WebSocketSession session, Map<String, Object> message) throws Exception {
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
    }

    private static void close(WebSocketSession session) {
        try {
            if (session != null && session.isOpen()) session.close();
        } catch (Exception ignored) {
            // already closed
        }
    }

    /** Collects messages and lets a test wait for one of a given type. */
    static class Listener extends TextWebSocketHandler {
        private final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        private final ObjectMapper mapper = new ObjectMapper();

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) {
            messages.add(message.getPayload());
        }

        JsonNode await(String type, long timeoutMs) throws Exception {
            long deadline = System.currentTimeMillis() + timeoutMs;
            while (System.currentTimeMillis() < deadline) {
                String payload = messages.poll(Math.max(1, deadline - System.currentTimeMillis()), TimeUnit.MILLISECONDS);
                if (payload == null) return null;
                JsonNode node = mapper.readTree(payload);
                if (type.equals(node.path("type").asText())) return node;
            }
            return null;
        }
    }
}
