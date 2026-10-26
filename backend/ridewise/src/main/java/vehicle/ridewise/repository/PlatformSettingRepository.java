package vehicle.ridewise.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vehicle.ridewise.entity.PlatformSetting;

@Repository
public interface PlatformSettingRepository extends JpaRepository<PlatformSetting, String> {
}

