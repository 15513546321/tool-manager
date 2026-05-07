package com.toolmanager.config;

import com.toolmanager.entity.Menu;
import com.toolmanager.entity.MenuItem;
import com.toolmanager.entity.Role;
import com.toolmanager.entity.User;
import com.toolmanager.repository.MenuItemRepository;
import com.toolmanager.repository.MenuRepository;
import com.toolmanager.repository.RoleRepository;
import com.toolmanager.repository.UserRepository;
import com.toolmanager.util.PasswordUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * 安全数据初始化器
 * 初始化默认管理员用户、角色和菜单权限
 * 作者：张擎
 * 时间：2026-05-07
 */
@Component
@Transactional
public class SecurityDataInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private MenuRepository menuRepository;

    @Autowired
    private MenuItemRepository menuItemRepository;

    @Autowired
    private PasswordUtil passwordUtil;

    @Override
    public void run(String... args) throws Exception {
        // 初始化管理员角色
        Role adminRole = createRoleIfNotExists("ADMIN", "超级管理员", "系统最高权限角色", 1);
        
        // 初始化普通用户角色
        Role userRole = createRoleIfNotExists("USER", "普通用户", "普通权限角色", 2);

        // ============= 初始化一级菜单（按sortOrder排序）=============
        
        // 仪表盘 (sortOrder=0)
        Menu dashboardMenu = createMenuIfNotExists("仪表盘", "/dashboard", "dashboard", "dashboard:view", 0L, 0, 0, 1);
        
        // 接口管理 (sortOrder=1) - 父菜单，无权限标识，无路径
        Menu interfaceMenu = createMenuIfNotExists("接口管理", null, "interface", null, 0L, 1, 0, 1);
        
        // 数据同步 (sortOrder=2) - 父菜单，无权限标识，无路径
        Menu syncMenu = createMenuIfNotExists("数据同步", null, "sync", null, 0L, 2, 0, 1);
        
        // 知识库 (sortOrder=3)
        Menu repoMenu = createMenuIfNotExists("知识库", "/repo", "repo", "repo:view", 0L, 3, 0, 1);
        
        // 格式化工具 (sortOrder=4)
        Menu formatMenu = createMenuIfNotExists("格式化工具", "/format", "format", "format:view", 0L, 4, 0, 1);
        
        // GitLab报表 (sortOrder=5)
        Menu gitlabMenu = createMenuIfNotExists("GitLab报表", "/gitlab-reports", "gitlab", "gitlab:view", 0L, 5, 0, 1);
        
        // Gitee管理 (sortOrder=6)
        Menu giteeMenu = createMenuIfNotExists("Gitee管理", "/gitee", "gitee", "gitee:manage", 0L, 6, 0, 1);
        
        // 参数配置 (sortOrder=7)
        Menu paramsMenu = createMenuIfNotExists("参数配置", "/params", "params", "params:view", 0L, 7, 0, 1);
        
        // 审计日志 (sortOrder=8)
        Menu auditMenu = createMenuIfNotExists("审计日志", "/audit", "audit", "audit:view", 0L, 8, 0, 1);
        
        // 公告通知 (sortOrder=9)
        Menu announcementMenu = createMenuIfNotExists("公告通知", "/announcement", "announcement", "announcement:view", 0L, 9, 0, 1);
        
        // 优化建议 (sortOrder=10)
        Menu suggestionsMenu = createMenuIfNotExists("优化建议", "/suggestions", "suggestions", "suggestions:view", 0L, 10, 0, 1);
        
        // 系统设置 (sortOrder=11) - 父菜单，无权限标识，无路径
        Menu systemMenu = createMenuIfNotExists("系统设置", null, "system", null, 0L, 11, 0, 1);

        // ============= 接口管理子菜单 (sortOrder=1,2,3)=============
        
        Menu docMenu = createMenuIfNotExists("文档管理", "/interface/docs", "docs", "interface:docs", interfaceMenu.getId(), 1, 0, 1);
        Menu codeMenu = createMenuIfNotExists("代码生成", "/interface/code", "code", "interface:code", interfaceMenu.getId(), 2, 0, 1);
        Menu mockMenu = createMenuIfNotExists("模拟报文生成", "/interface/mock-packet", "payload", "interface:mock", interfaceMenu.getId(), 3, 0, 1);
        
        // 接口管理子权限（按钮级）
        createMenuIfNotExists("文档新增", null, null, "interface:docs:add", docMenu.getId(), 1, 1, 1);
        createMenuIfNotExists("文档编辑", null, null, "interface:docs:edit", docMenu.getId(), 2, 1, 1);
        createMenuIfNotExists("文档删除", null, null, "interface:docs:delete", docMenu.getId(), 3, 1, 1);

        // ============= 数据同步子菜单 (sortOrder=1,2)=============
        
        Menu nacosSyncMenu = createMenuIfNotExists("Nacos配置同步", "/sync/nacos", "nacos", "sync:nacos", syncMenu.getId(), 1, 0, 1);
        Menu oracleSyncMenu = createMenuIfNotExists("Oracle DDL同步", "/sync/oracle", "oracle", "sync:oracle", syncMenu.getId(), 2, 0, 1);

        // ============= 系统设置子菜单 (sortOrder=1-5)=============
        
        Menu userMenu = createMenuIfNotExists("用户管理", "/admin/users", "users", "user:manage", systemMenu.getId(), 1, 0, 1);
        Menu roleMenu = createMenuIfNotExists("角色管理", "/admin/roles", "roles", "role:manage", systemMenu.getId(), 2, 0, 1);
        Menu permissionMenu = createMenuIfNotExists("权限管理", "/admin/permissions", "permissions", "permission:manage", systemMenu.getId(), 3, 0, 1);
        Menu menuManagementMenu = createMenuIfNotExists("菜单管理", "/admin/menus", "menu", "menu:manage", systemMenu.getId(), 4, 0, 1);
        Menu ipConfigMenu = createMenuIfNotExists("IP映射配置", "/admin/ip-config", "ip", "ipconfig:manage", systemMenu.getId(), 5, 0, 1);
        
        // 用户管理子权限（按钮级）
        createMenuIfNotExists("用户新增", null, null, "user:add", userMenu.getId(), 1, 1, 1);
        createMenuIfNotExists("用户编辑", null, null, "user:edit", userMenu.getId(), 2, 1, 1);
        createMenuIfNotExists("用户删除", null, null, "user:delete", userMenu.getId(), 3, 1, 1);
        createMenuIfNotExists("用户重置密码", null, null, "user:resetPassword", userMenu.getId(), 4, 1, 1);
        
        // 角色管理子权限（按钮级）
        createMenuIfNotExists("角色新增", null, null, "role:add", roleMenu.getId(), 1, 1, 1);
        createMenuIfNotExists("角色编辑", null, null, "role:edit", roleMenu.getId(), 2, 1, 1);
        createMenuIfNotExists("角色删除", null, null, "role:delete", roleMenu.getId(), 3, 1, 1);
        
        // 菜单管理子权限（按钮级）
        createMenuIfNotExists("菜单新增", null, null, "menu:add", menuManagementMenu.getId(), 1, 1, 1);
        createMenuIfNotExists("菜单编辑", null, null, "menu:edit", menuManagementMenu.getId(), 2, 1, 1);
        createMenuIfNotExists("菜单删除", null, null, "menu:delete", menuManagementMenu.getId(), 3, 1, 1);

        // ============= 给管理员角色分配所有菜单权限 =============
        Set<Menu> allMenus = new LinkedHashSet<>(menuRepository.findAllByOrderBySortOrderAsc());
        adminRole.setMenus(allMenus);
        roleRepository.save(adminRole);

        // 初始化管理员用户
        createAdminUser(adminRole);

        // 初始化前端导航菜单（MenuItem）
        initFrontendMenuItems();
    }

    /**
     * 初始化前端导航菜单项
     */
    private void initFrontendMenuItems() {
        // 删除现有的MenuItem数据
        List<MenuItem> existingItems = menuItemRepository.findAll();
        for (MenuItem item : existingItems) {
            menuItemRepository.deleteById(item.getId());
        }
        
        // 仪表盘
        createMenuItem("1", "仪表盘", "/dashboard", "dashboard", null, 0);
        // 公告通知
        createMenuItem("10", "公告通知", "/announcement", "announcement", null, 1);
        // 优化建议
        createMenuItem("11", "优化建议", "/suggestions", "suggestions", null, 2);
        // 接口管理（父菜单）
        createMenuItem("2", "接口管理", "/interface/docs", "interface", null, 3);
        // 文档管理（子菜单）
        createMenuItem("2-1", "文档管理", "/interface/docs", "docs", "2", 1);
        // 代码生成（子菜单）
        createMenuItem("2-2", "代码生成", "/interface/code", "code", "2", 2);
        // Mock数据包（子菜单）
        createMenuItem("2-3", "模拟报文生成", "/interface/mock-packet", "payload", "2", 3);
        // 数据同步（父菜单）
        createMenuItem("3", "数据同步", "/sync/nacos", "sync", null, 4);
        // Nacos配置同步（子菜单）
        createMenuItem("3-1", "Nacos配置同步", "/sync/nacos", "nacos", "3", 1);
        // Oracle DDL同步（子菜单）
        createMenuItem("3-2", "Oracle DDL同步", "/sync/oracle", "oracle", "3", 2);
        // GitLab报表
        createMenuItem("6", "GitLab报表", "/gitlab-reports", "gitlab", null, 5);
        // Gitee管理
        createMenuItem("7", "Gitee管理", "/gitee", "gitee", null, 6);
        // 格式化工具
        createMenuItem("8", "格式化工具", "/format", "format", null, 7);
        // 参数配置
        createMenuItem("9", "参数配置", "/params", "params", null, 8);
        // 知识库
        createMenuItem("4", "知识库", "/repo", "repo", null, 9);
        // 审计日志
        createMenuItem("5", "审计日志", "/audit", "audit", null, 10);
        // 系统设置（父菜单）
        createMenuItem("12", "系统设置", "/admin/users", "system", null, 11);
        // 用户管理（子菜单）
        createMenuItem("12-1", "用户管理", "/admin/users", "users", "12", 1);
        // 角色管理（子菜单）
        createMenuItem("12-2", "角色管理", "/admin/roles", "roles", "12", 2);
        // 权限管理（子菜单）
        createMenuItem("12-3", "权限管理", "/admin/permissions", "permissions", "12", 3);
        // 菜单管理（子菜单）
        createMenuItem("12-4", "菜单管理", "/admin/menus", "menu", "12", 4);
        // IP映射配置（子菜单）
        createMenuItem("12-5", "IP映射配置", "/admin/ip-config", "ip", "12", 5);
    }

    private void createMenuItem(String menuId, String name, String path, String icon, String parentId, Integer sortOrder) {
        // 先检查是否已存在
        Optional<MenuItem> existingOpt = menuItemRepository.findByMenuId(menuId);
        if (existingOpt.isPresent()) {
            // 更新已存在的菜单项
            MenuItem existingItem = existingOpt.get();
            existingItem.setName(name);
            existingItem.setPath(path);
            existingItem.setIcon(icon);
            existingItem.setParentId(parentId);
            existingItem.setSortOrder(sortOrder);
            existingItem.setVisible(true);
            existingItem.setUpdatedBy("system");
            existingItem.setUpdatedAt(LocalDateTime.now());
            menuItemRepository.save(existingItem);
        } else {
            // 创建新的菜单项
            MenuItem menuItem = new MenuItem();
            menuItem.setMenuId(menuId);
            menuItem.setName(name);
            menuItem.setPath(path);
            menuItem.setIcon(icon);
            menuItem.setParentId(parentId);
            menuItem.setSortOrder(sortOrder);
            menuItem.setVisible(true);
            menuItem.setUpdatedBy("system");
            menuItemRepository.save(menuItem);
        }
    }

    private Role createRoleIfNotExists(String code, String name, String desc, int level) {
        return roleRepository.findByRoleCode(code)
                .orElseGet(() -> {
                    Role role = new Role();
                    role.setRoleCode(code);
                    role.setRoleName(name);
                    role.setDescription(desc);
                    role.setLevel(level);
                    role.setStatus(1);
                    role.setCreatedBy("system");
                    role.setUpdatedBy("system");
                    return roleRepository.save(role);
                });
    }

    private Menu createMenuIfNotExists(String name, String path, String icon, String permission, 
                                       Long parentId, int sortOrder, int isButton, int status) {
        // 尝试查找已存在的菜单
        Menu existingMenu = null;
        
        if (permission != null && !permission.isEmpty()) {
            // 如果有权限标识，通过权限标识查找
            existingMenu = menuRepository.findByPermission(permission);
        } else {
            // 对于没有权限标识的菜单（父菜单），通过名称和父ID查找
            existingMenu = menuRepository.findByNameAndParentId(name, parentId != null ? parentId : 0L);
        }
        
        return existingMenu != null ? existingMenu : createMenu(name, path, icon, permission, parentId, sortOrder, isButton, status);
    }

    private Menu createMenu(String name, String path, String icon, String permission, 
                           Long parentId, int sortOrder, int isButton, int status) {
        Menu menu = new Menu();
        menu.setName(name);
        menu.setPath(path);
        menu.setIcon(icon);
        menu.setPermission(permission);
        menu.setParentId(parentId != null ? parentId : 0L);
        menu.setSortOrder(sortOrder);
        menu.setIsButton(isButton);
        menu.setStatus(status);
        menu.setCreatedBy("system");
        menu.setUpdatedBy("system");
        return menuRepository.save(menu);
    }

    private void createAdminUser(Role adminRole) {
        userRepository.findByUsername("admin")
                .orElseGet(() -> {
                    User admin = new User();
                    admin.setUsername("admin");
                    admin.setPassword(passwordUtil.encryptPassword("admin123"));
                    admin.setSalt(passwordUtil.generateSalt());
                    admin.setRealName("超级管理员");
                    admin.setEmail("admin@example.com");
                    admin.setStatus(1);
                    admin.setCreatedBy("system");
                    admin.setUpdatedBy("system");
                    
                    Set<Role> roles = new HashSet<>();
                    roles.add(adminRole);
                    admin.setRoles(roles);
                    
                    return userRepository.save(admin);
                });
    }
}