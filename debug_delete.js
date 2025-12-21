// 在浏览器 F12 Console 中运行这个脚本，可以帮助诊断问题

console.log("=== 连接删除诊断工具 ===");

// 保存原始的 delete 方法
const originalDelete = window.fetch;

// 拦截所有 DELETE 请求
window.fetch = function(...args) {
  const [url, options] = args;
  
  if (options && options.method === 'DELETE') {
    console.log('🚨 [INTERCEPTED DELETE]', {
      url: url,
      method: options.method,
      timestamp: new Date().toISOString()
    });
  }
  
  return originalDelete.apply(this, args).then(response => {
    if (options && options.method === 'DELETE') {
      console.log('📥 [DELETE RESPONSE]', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url
      });
      
      // 克隆响应以便读取 body（因为响应只能读一次）
      return response.clone().text().then(text => {
        console.log('📄 [DELETE RESPONSE BODY]', text);
        return response;
      });
    }
    return response;
  }).catch(error => {
    if (options && options.method === 'DELETE') {
      console.error('❌ [DELETE ERROR]', error);
    }
    throw error;
  });
};

console.log("✓ DELETE 请求拦截器已安装");
console.log("现在点击删除按钮，查看控制台输出");
