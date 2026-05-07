package com.toolmanager.repository;

import com.toolmanager.entity.Menu;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 菜单数据访问层
 * 作者：张擎
 * 时间：2026-05-06
 */
@Repository
public interface MenuRepository extends JpaRepository<Menu, Long> {

    /**
     * 根据父菜单ID查询子菜单
     * @param parentId 父菜单ID
     * @return 子菜单列表
     */
    List<Menu> findByParentIdOrderBySortOrderAsc(Long parentId);

    /**
     * 查询所有启用的菜单
     * @param status 状态
     * @return 菜单列表
     */
    List<Menu> findByStatusOrderBySortOrderAsc(Integer status);

    /**
     * 查询所有菜单（包括禁用的），按排序顺序排列
     * @return 菜单列表
     */
    List<Menu> findAllByOrderBySortOrderAsc();

    /**
     * 根据权限标识查找菜单
     * @param permission 权限标识
     * @return 菜单信息
     */
    Menu findByPermission(String permission);

    /**
     * 根据名称和父ID查找菜单
     * @param name 菜单名称
     * @param parentId 父菜单ID
     * @return 菜单信息
     */
    Menu findByNameAndParentId(String name, Long parentId);

    /**
     * 查询所有非按钮的菜单（目录和页面）
     * @param isButton 是否按钮
     * @param status 状态
     * @return 菜单列表
     */
    List<Menu> findByIsButtonAndStatusOrderBySortOrderAsc(Integer isButton, Integer status);
}
