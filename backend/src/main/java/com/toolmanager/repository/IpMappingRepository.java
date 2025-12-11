package com.toolmanager.repository;

import com.toolmanager.entity.IpMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IpMappingRepository extends JpaRepository<IpMapping, Long> {
    Optional<IpMapping> findByIp(String ip);
}
