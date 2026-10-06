package vehicle.ridewise.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vehicle.ridewise.entity.OrgRoute;

import java.util.List;
import java.util.Optional;

public interface OrgRouteRepository extends JpaRepository<OrgRoute, Long> {

    /**
     * A route WITHOUT its geometry — what lists show. Loading the whole
     * entity for a list would drag every route's coordinates (hundreds of
     * kilobytes each) through memory for nothing.
     */
    interface Summary {
        Long getId();
        Long getOrgId();
        String getName();
        String getFromName();
        Double getFromLat();
        Double getFromLng();
        String getDestinationName();
        Double getDestinationLat();
        Double getDestinationLng();
        String getStopsJson();
        Double getDistanceMeters();
        Double getDurationSeconds();
    }

    List<Summary> findSummaryByOrgIdOrderByNameAsc(Long orgId);

    Optional<OrgRoute> findByIdAndOrgId(Long id, Long orgId);

    long countByOrgId(Long orgId);
}
