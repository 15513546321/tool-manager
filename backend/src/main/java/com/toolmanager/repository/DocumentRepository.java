package com.toolmanager.repository;

import com.toolmanager.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findByCategory(String category);
    
    List<Document> findByCategoryAndSubCategory(String category, String subCategory);
    
    List<Document> findByTitleContainingIgnoreCase(String title);
    
    List<Document> findByCategoryOrderByUpdatedAtDesc(String category);
}

