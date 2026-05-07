package com.toolmanager.repository;

import com.toolmanager.entity.MenuItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MenuItemRepository extends JpaRepository<MenuItem, Long> {
    Optional<MenuItem> findByMenuId(String menuId);
    
    List<MenuItem> findAllByMenuId(String menuId);
    
    List<MenuItem> findByParentIdOrderBySortOrder(String parentId);
    
    List<MenuItem> findAllByOrderBySortOrder();
}
