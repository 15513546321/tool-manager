package com.toolmanager.repository;

import com.toolmanager.entity.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    Optional<Announcement> findByVersion(String version);
    
    List<Announcement> findByStatus(String status);
    
    List<Announcement> findByStatusOrderByCreatedAtDesc(String status);
}
