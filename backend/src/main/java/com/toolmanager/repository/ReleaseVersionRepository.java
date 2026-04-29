package com.toolmanager.repository;

import com.toolmanager.entity.ReleaseVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReleaseVersionRepository extends JpaRepository<ReleaseVersion, Long> {
    Optional<ReleaseVersion> findByVersionName(String versionName);

    List<ReleaseVersion> findAllByOrderByUpdatedAtDesc();
}
