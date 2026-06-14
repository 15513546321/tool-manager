package com.toolmanager.controller;

import com.toolmanager.dto.CacheItem;
import com.toolmanager.dto.CacheQueryDto;
import com.toolmanager.dto.CacheRefreshDto;
import com.toolmanager.entity.ApiResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/apps")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
        allowCredentials = "true")
public class CacheRefreshController {

    private final RestTemplate restTemplate;
    /**
     * 查询缓存列表
     * POST /api/apps/cache/list
     * 请求体: { "env": "sit", "appName": "param" }
     */
    @PostMapping("/qryList")
    public ResponseEntity<ApiResult<List<CacheItem>>> listCache(@RequestBody CacheQueryDto request) {
        // TODO: 根据 env 和 appName 从数据库或配置中心查询实际缓存列表
        // 以下为示例数据Ω

        String env = request.getEnv();
        String appName = request.getAppName();
        List<CacheItem> list = new ArrayList<>();

        // 1. 根据前端传来的 appName 和 env 动态组装返回数据
        if ("param".equals(appName)) {
            list.add(new CacheItem(1, "参数规则缓存", "cachedParamRule"));
            list.add(new CacheItem(2, "系统参数缓存", "cachedSysParam"));
        } else if ("channel".equals(appName)) {
            list.add(new CacheItem(3, "渠道路由缓存", "channelRouteCache"));
            list.add(new CacheItem(4, "渠道费率缓存", "channelFeeCache"));
        } else if ("customer".equals(appName)) {
            list.add(new CacheItem(5, "用户基础信息", "userInfoCache"));
        } else {
            // 兜底默认数据
            list.add(new CacheItem(6, "通用默认缓存", "defaultCache"));
        }
        // TODO 待添加对应缓存name
        return ResponseEntity.ok(ApiResult.success(list));
    }

    /**
     * 刷新单个缓存
     * POST /api/apps/cache/refresh
     * 请求体: { "env": "sit", "appName": "param", "cacheName": "userCache" }
     */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResult<String>> refreshCache(@RequestBody CacheRefreshDto request) {

        String env = request.getEnv();
        String appName = request.getAppName();
        String cacheName = request.getCacheName(); // 例如传过来的是 "cachedParamRule"


        // TODO
        // 用于测试,待调整
        String targetUrl = "";
        if (cacheName.equals("cachedParamRule")) {
            log.info("参数中心进来了");
        }
        targetUrl = "http://10.20.72.155:8032/refreshCacheLocal/" + cacheName;

        try {
            // RestTemplate 发送 GET 请求
            // RestTemplate 会自动识别 HTTP 响应头中的 application/json，并将其转换为 Map 结构
            ResponseEntity<Map> response = restTemplate.getForEntity(targetUrl, Map.class);
//            ResponseEntity<String> response = restTemplate.getForEntity(targetUrl, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                // 3. 获取转换后的 Map 数据
                Map<String, Object> responseBody = response.getBody();
//               String responseBody = response.getBody();
                if (responseBody != null) {
                    Object targetCode = responseBody.get("code");
                    Object targetMsg = responseBody.get("msg");

                    String msg = String.format("【%s】刷新请求发送成功! 目标节点返回 code: %s, msg: %s",
                            cacheName, targetCode, targetMsg);
                    return ResponseEntity.ok(ApiResult.success(msg));
                } else {
                    return ResponseEntity.ok(ApiResult.success("【" + cacheName + "】刷新成功，但目标节点没有返回具体数据"));
                }
            } else {
                return ResponseEntity.ok(ApiResult.success("请求失败，目标服务器状态码: " + response.getStatusCodeValue()));
            }

        } catch (Exception e) {
            // 4. 异常处理
            String errorMsg = String.format("请求目标接口异常 [%s]: %s", targetUrl, e.getMessage());
            log.error(errorMsg, e);
            return ResponseEntity.ok(ApiResult.success(errorMsg));
        }
    }
}