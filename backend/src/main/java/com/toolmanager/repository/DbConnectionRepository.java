package com.toolmanager.repository;

import com.toolmanager.entity.DbConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DbConnectionRepository extends JpaRepository<DbConnection, Long> {
    List<DbConnection> findByType(String type);
    Optional<DbConnection> findByNameAndType(String name, String type);
}
