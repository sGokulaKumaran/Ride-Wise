package vehicle.ridewise.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vehicle.ridewise.entity.Feedback;

import java.util.List;

@Repository
public interface FeedbackRepository extends JpaRepository<Feedback, Long> {

    List<Feedback> findByUserIdOrderByCreatedAtDesc(Long userId);

    long countByStatus(String status);

    @Query("SELECT f FROM Feedback f " +
           "WHERE (:status = '' OR f.status = :status) " +
           "AND (:category = '' OR f.category = :category) " +
           "AND (:search = '' OR LOWER(f.subject) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "     OR LOWER(f.message) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "     OR LOWER(COALESCE(f.username, '')) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "     OR LOWER(COALESCE(f.userEmail, '')) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "ORDER BY f.createdAt DESC")
    Page<Feedback> searchFeedback(@Param("status") String status,
                                  @Param("category") String category,
                                  @Param("search") String search,
                                  Pageable pageable);
}

