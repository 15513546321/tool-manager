package com.toolmanager.service;

import com.toolmanager.dto.MenuDTO;
import com.toolmanager.entity.Menu;
import com.toolmanager.entity.MenuItem;
import com.toolmanager.entity.Role;
import com.toolmanager.entity.User;
import com.toolmanager.repository.MenuRepository;
import com.toolmanager.repository.MenuItemRepository;
import com.toolmanager.repository.UserRepository;
import com.toolmanager.repository.RoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 菜单服务
 * 作者：张擎
 * 时间：2026-05-06
 */
@Service
public class MenuService {

    @Autowired
    private MenuRepository menuRepository;

    @Autowired
    private MenuItemRepository menuItemRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    /**
     * 创建菜单
     */
    @Transactional
    public Menu createMenu(MenuDTO dto, String operator) {
        Menu menu = new Menu();
        menu.setName(dto.getName());
        menu.setPath(dto.getPath());
        menu.setIcon(dto.getIcon());
        menu.setPermission(dto.getPermission());
        menu.setParentId(dto.getParentId() != null ? dto.getParentId() : 0L);
        menu.setSortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : 0);
        menu.setIsButton(dto.getIsButton() != null ? dto.getIsButton() : 0);
        menu.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        menu.setCreatedBy(operator);
        menu.setUpdatedBy(operator);

        Menu savedMenu = menuRepository.save(menu);
        
        // 自动同步到MenuItem表（仅同步非按钮的菜单项）
        if (savedMenu.getIsButton() == 0) {
            syncToMenuItem(savedMenu);
        }
        
        return savedMenu;
    }

    /**
     * 更新菜单
     */
    @Transactional
    public Menu updateMenu(Long id, MenuDTO dto, String operator) {
        Menu menu = menuRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("菜单不存在"));

        menu.setName(dto.getName());
        menu.setPath(dto.getPath());
        menu.setIcon(dto.getIcon());
        menu.setPermission(dto.getPermission());
        if (dto.getParentId() != null) {
            menu.setParentId(dto.getParentId());
        }
        if (dto.getSortOrder() != null) {
            menu.setSortOrder(dto.getSortOrder());
        }
        if (dto.getIsButton() != null) {
            menu.setIsButton(dto.getIsButton());
        }
        if (dto.getStatus() != null) {
            menu.setStatus(dto.getStatus());
        }
        menu.setUpdatedBy(operator);

        Menu savedMenu = menuRepository.save(menu);
        
        // 同步更新到MenuItem表
        if (savedMenu.getIsButton() == 0) {
            syncToMenuItem(savedMenu);
        } else {
            // 如果改为按钮类型，删除对应的MenuItem
            deleteMenuItem(savedMenu.getId());
        }
        
        return savedMenu;
    }

    /**
     * 删除菜单
     */
    @Transactional
    public void deleteMenu(Long id) {
        if (!menuRepository.existsById(id)) {
            throw new RuntimeException("菜单不存在");
        }
        menuRepository.deleteById(id);
        
        // 删除对应的MenuItem
        deleteMenuItem(id);
    }

    /**
     * 根据ID获取菜单
     */
    @Transactional(readOnly = true)
    public Menu getMenuById(Long id) {
        return menuRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("菜单不存在"));
    }

    /**
     * 获取所有菜单（树形结构，包括禁用的）
     */
    @Transactional(readOnly = true)
    public List<Menu> getAllMenus() {
        List<Menu> allMenus = menuRepository.findAllByOrderBySortOrderAsc();
        return buildTree(allMenus, 0L);
    }

    /**
     * 获取所有启用的菜单（非按钮）
     */
    @Transactional(readOnly = true)
    public List<Menu> getActiveMenus() {
        return menuRepository.findByIsButtonAndStatusOrderBySortOrderAsc(0, 1);
    }

    /**
     * 根据用户ID获取有权限的菜单（树形结构）
     * 作者：张擎
     * 时间：2026-05-07
     * @param userId 用户ID
     * @return 用户有权限访问的菜单列表（树形结构）
     */
    @Transactional(readOnly = true)
    public List<Menu> getMenusByUserId(Long userId) {
        // 获取用户信息
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        // 获取用户所有角色关联的菜单
        Set<Menu> userMenus = new LinkedHashSet<>();
        for (Role role : user.getRoles()) {
            for (Menu menu : role.getMenus()) {
                // 只添加启用状态的非按钮菜单
                if (menu.getIsButton() == 0 && menu.getStatus() == 1) {
                    userMenus.add(menu);
                }
            }
        }

        // 将菜单转换为树形结构（先按sortOrder排序确保顺序一致，不受角色遍历顺序影响）
        List<Menu> menuList = new ArrayList<>(userMenus);
        // 排序逻辑：先按父ID分组，再按sortOrder排序，最后按ID排序（确保sortOrder相同时顺序稳定）
        menuList.sort((a, b) -> {
            // 先按父ID分组，确保同级菜单在一起（parentId=0 的一级菜单优先）
            int parentCompare = Long.compare(a.getParentId(), b.getParentId());
            if (parentCompare != 0) {
                return parentCompare;
            }
            // 同级菜单按sortOrder排序
            int sortCompare = Integer.compare(a.getSortOrder(), b.getSortOrder());
            if (sortCompare != 0) {
                return sortCompare;
            }
            // sortOrder相同时，按ID排序确保顺序稳定（避免随机顺序）
            return Long.compare(a.getId(), b.getId());
        });
        return buildTree(menuList, 0L);
    }

    /**
     * 获取所有菜单列表（非树形，按排序号升序）
     */
    @Transactional(readOnly = true)
    public List<Menu> findAllByOrderBySortOrderAsc() {
        return menuRepository.findAllByOrderBySortOrderAsc();
    }

    /**
     * 根据父ID获取子菜单（按排序号升序）
     */
    @Transactional(readOnly = true)
    public List<Menu> findByParentIdOrderBySortOrderAsc(Long parentId) {
        return menuRepository.findByParentIdOrderBySortOrderAsc(parentId);
    }

    /**
     * 同步Menu到MenuItem表
     */
    @Transactional
    private void syncToMenuItem(Menu menu) {
        // 查找或创建MenuItem
        MenuItem menuItem = menuItemRepository.findByMenuId(String.valueOf(menu.getId()))
                .orElse(new MenuItem());
        
        menuItem.setMenuId(String.valueOf(menu.getId()));
        menuItem.setName(menu.getName());
        // 处理 path 为空的情况，设置为空字符串避免数据库约束违反
        menuItem.setPath(menu.getPath() != null ? menu.getPath() : "");
        menuItem.setIcon(menu.getIcon());
        menuItem.setParentId(menu.getParentId() == 0 ? null : String.valueOf(menu.getParentId()));
        menuItem.setSortOrder(menu.getSortOrder());
        menuItem.setVisible(menu.getStatus() == 1);
        menuItem.setUpdatedBy("system");
        
        menuItemRepository.save(menuItem);
    }

    /**
     * 删除MenuItem
     */
    @Transactional
    private void deleteMenuItem(Long menuId) {
        menuItemRepository.findByMenuId(String.valueOf(menuId))
                .ifPresent(menuItemRepository::delete);
    }

    /**
     * 构建树形结构（只包含非按钮的菜单项）
     */
    private List<Menu> buildTree(List<Menu> menus, Long parentId) {
        return menus.stream()
                .filter(menu -> menu.getParentId().equals(parentId) && menu.getIsButton() == 0)
                .sorted((a, b) -> Integer.compare(a.getSortOrder(), b.getSortOrder()))
                .map(menu -> {
                    Menu treeNode = menu;
                    List<Menu> children = buildTree(menus, menu.getId());
                    if (!children.isEmpty()) {
                        treeNode.setChildren(new java.util.LinkedHashSet<>(children));
                    }
                    return treeNode;
                })
                .collect(Collectors.toList());
    }

    /**
     * 切换菜单状态（启用/停用）
     */
    @Transactional
    public Menu toggleMenuStatus(Long id, String operator) {
        Menu menu = menuRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("菜单不存在"));
        
        // 切换状态：1 -> 0, 0 -> 1
        menu.setStatus(menu.getStatus() == 1 ? 0 : 1);
        menu.setUpdatedBy(operator);
        
        Menu savedMenu = menuRepository.save(menu);
        
        // 同步更新到MenuItem表
        if (savedMenu.getIsButton() == 0) {
            syncToMenuItem(savedMenu);
        }
        
        return savedMenu;
    }

    /**
     * 更新菜单状态（直接设置指定状态）
     * 作者：张擎
     * 时间：2026-05-07
     * @param id 菜单ID
     * @param status 状态（1=启用，0=禁用）
     * @param operator 操作人
     * @return 更新后的菜单
     */
    @Transactional
    public Menu updateMenuStatus(Long id, Integer status, String operator) {
        Menu menu = menuRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("菜单不存在"));
        
        menu.setStatus(status);
        menu.setUpdatedBy(operator);
        
        Menu savedMenu = menuRepository.save(menu);
        
        // 如果禁用菜单，自动移除所有角色对该菜单的权限
        if (status == 0) {
            removeMenuFromAllRoles(id);
        }
        
        // 同步更新到MenuItem表
        if (savedMenu.getIsButton() == 0) {
            syncToMenuItem(savedMenu);
        }
        
        return savedMenu;
    }

    /**
     * 从所有角色中移除指定菜单的权限
     * 作者：张擎
     * 时间：2026-05-07
     * @param menuId 菜单ID
     */
    @Transactional
    private void removeMenuFromAllRoles(Long menuId) {
        List<Role> allRoles = roleRepository.findAll();
        for (Role role : allRoles) {
            Set<Menu> menus = role.getMenus();
            if (menus != null) {
                menus.removeIf(menu -> menu.getId().equals(menuId));
            }
        }
    }

    /**
     * 调整菜单排序（上移/下移）
     */
    @Transactional
    public void reorderMenu(Long id, String direction) {
        Menu menu = menuRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("菜单不存在"));
        
        Long parentId = menu.getParentId();
        int currentSortOrder = menu.getSortOrder();
        
        // 获取同级菜单（按排序号排序）
        List<Menu> siblings = menuRepository.findByParentIdOrderBySortOrderAsc(parentId);
        
        int currentIndex = -1;
        for (int i = 0; i < siblings.size(); i++) {
            if (siblings.get(i).getId().equals(id)) {
                currentIndex = i;
                break;
            }
        }
        
        if (currentIndex == -1) {
            throw new RuntimeException("菜单不存在于同级列表中");
        }
        
        int targetIndex = -1;
        
        if ("up".equals(direction) && currentIndex > 0) {
            // 上移：移动到前一个位置
            targetIndex = currentIndex - 1;
        } else if ("down".equals(direction) && currentIndex < siblings.size() - 1) {
            // 下移：移动到后一个位置
            targetIndex = currentIndex + 1;
        } else {
            throw new RuntimeException("已经是" + ("up".equals(direction) ? "第一个" : "最后一个") + "，无法继续" + ("up".equals(direction) ? "上移" : "下移"));
        }
        
        // 交换位置
        Menu targetMenu = siblings.get(targetIndex);
        
        // 交换排序号
        int targetSortOrder = targetMenu.getSortOrder();
        menu.setSortOrder(targetSortOrder);
        targetMenu.setSortOrder(currentSortOrder);
        
        menuRepository.save(menu);
        menuRepository.save(targetMenu);
        
        // 同步更新到MenuItem表（仅非按钮菜单）
        if (menu.getIsButton() == 0) {
            syncToMenuItem(menu);
        }
        if (targetMenu.getIsButton() == 0) {
            syncToMenuItem(targetMenu);
        }
        
        // 重新整理所有同级菜单的排序号，确保从1开始连续递增
        reorganizeSortOrder(parentId);
    }
    
    /**
     * 重新整理同级菜单的排序号，确保从1开始连续递增
     * @param parentId 父菜单ID
     */
    @Transactional
    private void reorganizeSortOrder(Long parentId) {
        // 获取同级菜单（按当前排序号排序）
        List<Menu> siblings = menuRepository.findByParentIdOrderBySortOrderAsc(parentId);
        
        // 重新分配排序号，从1开始连续递增
        for (int i = 0; i < siblings.size(); i++) {
            Menu sibling = siblings.get(i);
            int newSortOrder = i + 1;
            if (sibling.getSortOrder() != newSortOrder) {
                sibling.setSortOrder(newSortOrder);
                menuRepository.save(sibling);
                
                // 同步更新到MenuItem表（仅非按钮菜单）
                if (sibling.getIsButton() == 0) {
                    syncToMenuItem(sibling);
                }
            }
        }
    }

    /**
     * 转换为DTO
     */
    public MenuDTO toDTO(Menu menu) {
        MenuDTO dto = new MenuDTO();
        dto.setId(menu.getId());
        dto.setName(menu.getName());
        dto.setPath(menu.getPath());
        dto.setIcon(menu.getIcon());
        dto.setPermission(menu.getPermission());
        dto.setParentId(menu.getParentId());
        dto.setSortOrder(menu.getSortOrder());
        dto.setIsButton(menu.getIsButton());
        dto.setStatus(menu.getStatus());
        dto.setCreatedAt(menu.getCreatedAt());
        dto.setUpdatedAt(menu.getUpdatedAt());
        dto.setCreatedBy(menu.getCreatedBy());
        dto.setUpdatedBy(menu.getUpdatedBy());

        // 转换子菜单
        if (menu.getChildren() != null && !menu.getChildren().isEmpty()) {
            dto.setChildren(menu.getChildren().stream()
                    .map(this::toDTO)
                    .collect(Collectors.toList()));
        }

        return dto;
    }
}
