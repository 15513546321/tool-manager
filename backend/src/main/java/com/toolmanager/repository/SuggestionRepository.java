package com.toolmanager.repository;

import com.toolmanager.entity.Suggestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SuggestionRepository extends JpaRepository<Suggestion, Long> {
    List<Suggestion> findByStatus(String status);
    
    List<Suggestion> findByCategory(String category);
    
    List<Suggestion> findAllByOrderByCreatedAtDesc();
}
