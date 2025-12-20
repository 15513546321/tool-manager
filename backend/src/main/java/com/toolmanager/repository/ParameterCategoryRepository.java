package com.toolmanager.repository;

import com.toolmanager.entity.ParameterCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ParameterCategoryRepository extends JpaRepository<ParameterCategory, Long> {
    List<ParameterCategory> findByBigClass(String bigClass);
    
    List<ParameterCategory> findByBigClassAndSmallClass(String bigClass, String smallClass);
    
    boolean existsByBigClassAndSmallClass(String bigClass, String smallClass);
}
