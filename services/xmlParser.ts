import { XmlTransaction, XmlField } from '../types';

// --- Helper: Parse Fields Recursively ---
const parseChildren = (element: Element): XmlField[] => {
  const fields: XmlField[] = [];
  const children = Array.from(element.children);
  
  children.forEach(child => {
    const name = child.getAttribute("name") || "";
    const description = child.getAttribute("description") || "";
    const pattern = child.getAttribute("pattern") || undefined;
    const type = child.tagName; 
    
    const field: XmlField = {
      name,
      description,
      type,
      pattern
    };

    if (type === 'field') {
      field.style = child.textContent?.trim() || "";
    }
    
    if (child.children.length > 0) {
      field.children = parseChildren(child);
    }
    
    // Include if it has a name OR it is an object (objects inside arrays might not have names)
    if (name || type === 'object') {
       fields.push(field);
    }
  });
  
  return fields;
};

// --- Helper: Java Parsing ---
const extractJavaDownstreamCalls = (content: string): string[] => {
  const calls: Set<string> = new Set();
  const lines = content.split('\n');
  let currentId = '', currentName = '', currentTrans = '';
  
  lines.forEach(line => {
    const idMatch = line.match(/"serviceId"\s*,\s*"([^"]+)"/);
    if (idMatch) currentId = idMatch[1];
    
    const nameMatch = line.match(/"serviceName"\s*,\s*"([^"]+)"/);
    if (nameMatch) currentName = nameMatch[1];
    
    const transMatch = line.match(/"transId"\s*,\s*"([^"]+)"/);
    if (transMatch) currentTrans = transMatch[1];
    
    if (currentId && currentName && currentTrans) {
      calls.add(`${currentId}.${currentName}.${currentTrans}`);
      currentId = ''; 
      currentName = ''; 
      currentTrans = '';
    }
  });

  return Array.from(calls);
};

// --- Helper: Path Normalization ---
const normalizePath = (path: string): string => {
  // Replace Windows backslashes with forward slashes
  return path.replace(/\\/g, '/');
};

// --- Helper: Get Module Name from Path ---
const getModuleName = (filePath: string): string => {
  const normalized = normalizePath(filePath);
  const parts = normalized.split('/');
  
  // If it's in a directory structure, take the parent folder as module name
  if (parts.length > 1) {
      return parts[parts.length - 2];
  }
  
  // Fallback: use filename without extension
  const fileName = parts[parts.length - 1];
  return fileName.replace(/\.[^/.]+$/, "");
};

export interface FileEntry {
  name: string;
  path: string;
  content: string;
}

// --- Main Parser Function ---
export const parseProjectFiles = (files: FileEntry[]): XmlTransaction[] => {
  const transactions: XmlTransaction[] = [];
  const javaMap: Record<string, string[]> = {}; 
  const javaAuthorMap: Record<string, string> = {}; // 新增：存储类名到作者的映射
  const propertiesMap: Record<string, string> = {}; 
  
  files.forEach(file => {
    if (file.name.endsWith('.java')) {
      // Improved regex to capture class name even if not public or abstract
      const classMatch = file.content.match(/(?:public|protected|private|abstract|static|\s)*class\s+(\w+)/);
      if (classMatch) {
        const className = classMatch[1];
        const calls = extractJavaDownstreamCalls(file.content);
        javaMap[className] = calls;
        
        // 提取 @author 注解
        const authorMatch = file.content.match(/@author\s+([^\n\r]+)/);
        if (authorMatch) {
          javaAuthorMap[className] = authorMatch[1].trim();
        }
      }
    } else if (file.name.endsWith('.properties')) {
      const lines = file.content.split('\n');
      lines.forEach(line => {
        if (line.trim().startsWith('#')) return;
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim(); 
            if (val.includes('.') && !val.includes(':') && !val.includes('\\u')) {
                propertiesMap[key] = val;
            }
        }
      });
    }
  });

  const parser = new DOMParser();
  
  files.forEach(file => {
    if (!file.name.endsWith('.xml')) return;

    try {
        const xmlDoc = parser.parseFromString(file.content, "text/xml");
        
        // Check for parsing errors
        if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
            console.warn(`Skipping invalid XML file: ${file.name}`);
            return;
        }
        
        const localActionMap: Record<string, string> = {}; 
        const actionNodes = xmlDoc.getElementsByTagName("action");
        for (let i = 0; i < actionNodes.length; i++) {
          const name = actionNodes[i].getAttribute("name");
          const clazz = actionNodes[i].getAttribute("class");
          if (name && clazz) {
            localActionMap[name] = clazz;
          }
        }

        const transNodes = xmlDoc.getElementsByTagName("transaction");
        for (let i = 0; i < transNodes.length; i++) {
          const node = transNodes[i];
          const id = node.getAttribute("id") || "";
          const template = node.getAttribute("template") || "";
          const trsName = node.getAttribute("description") || "";
          
          const actionRefs = node.getElementsByTagName("actions")[0]?.getElementsByTagName("ref");
          const actionRef = actionRefs && actionRefs.length > 0 ? actionRefs[0].textContent || "" : "";
          
          let fullClassPath = localActionMap[actionRef] || "";
          if (!fullClassPath) {
            fullClassPath = actionRef;
          }
          
          const simpleClassName = fullClassPath.split('.').pop() || "";
          
          const inputNode = node.getElementsByTagName("input")[0];
          const inputs = inputNode ? parseChildren(inputNode) : [];

          const outputNode = node.getElementsByTagName("output")[0];
          const outputs = outputNode ? parseChildren(outputNode) : [];

          // Use the file path (relative path) to determine module
          const moduleName = getModuleName(file.path);

          const downstreamCalls: Set<string> = new Set();
          if (propertiesMap[id]) downstreamCalls.add(propertiesMap[id]);
          if (propertiesMap[actionRef]) downstreamCalls.add(propertiesMap[actionRef]);
          
          if (simpleClassName && javaMap[simpleClassName]) {
            javaMap[simpleClassName].forEach(call => downstreamCalls.add(call));
          }

          // 从 Java 文件中获取作者信息
          const author = simpleClassName ? javaAuthorMap[simpleClassName] : undefined;

          transactions.push({
            id,
            module: moduleName,
            filePath: normalizePath(file.path), // Ensure path is normalized for display
            template,
            trsName,
            actionRef,
            actionClass: fullClassPath,
            author,
            inputs,
            outputs,
            downstreamCalls: Array.from(downstreamCalls)
          });
        }
    } catch (e) {
        console.error(`Error processing file ${file.name}:`, e);
    }
  });

  return transactions;
};

// --- XML Generator Helpers ---

const buildInputFields = (fields: XmlField[], indent: number): string => {
  const spaces = ' '.repeat(indent);
  return fields.map(field => {
    // Treat 'array' or 'object' types as field-list in Input context
    const isContainer = field.type === 'array' || field.type === 'object' || field.type === 'field-list';
    
    if (isContainer) {
      return `${spaces}<field-list name="${field.name}" description="${field.description || ''}">\n` +
             `${spaces}    <fields>\n` +
             buildInputFields(field.children || [], indent + 8) +
             `${spaces}    </fields>\n` +
             `${spaces}</field-list>\n`;
    } else {
      // Standard field
      const style = field.style ? field.style : '';
      return `${spaces}<field name="${field.name}" description="${field.description || ''}">${style}</field>\n`;
    }
  }).join('');
};

const buildOutputFields = (fields: XmlField[], indent: number): string => {
  const spaces = ' '.repeat(indent);
  return fields.map(field => {
    // Treat 'array' as array->object->[fields] in Output context
    const isArray = field.type === 'array';
    
    if (isArray) {
      return `${spaces}<array name="${field.name}" description="${field.description || ''}" skipNull="true">\n` +
             `${spaces}    <object>\n` +
             buildOutputFields(field.children || [], indent + 8) +
             `${spaces}    </object>\n` +
             `${spaces}</array>\n`;
    } else {
      // Leaf nodes in output usually represented as <string> or similar primitive tags
      return `${spaces}<string name="${field.name}" description="${field.description || ''}"/>\n`;
    }
  }).join('');
};

// --- Main Generation Functions ---

export const generateXml = (t: XmlTransaction): string => {
  return `<transaction id="${t.id}" template="${t.template || 'trsConfirmTemplate'}" description="${t.trsName}">\n` +
         `    <actions>\n` +
         `        <ref>${t.actionRef || ''}</ref>\n` +
         `    </actions>\n` +
         `    <input>\n` +
         buildInputFields(t.inputs, 8) +
         `    </input>\n` +
         `    <output>\n` +
         buildOutputFields(t.outputs, 8) +
         `    </output>\n` +
         `    <view>jsonExtView</view>\n` +
         `</transaction>`;
};

export const generateJava = (t: XmlTransaction, author: string = 'admin'): string => {
  // Extract class name from ID (capitalize first letter, keep rest)
  // e.g., "userQuery" -> "UserQuery", then add "Action" -> "UserQueryAction"
  const baseClassName = t.id 
    ? t.id.charAt(0).toUpperCase() + t.id.slice(1).replace(/([A-Z])/g, (match) => match)
    : 'EntAPQuotaQry';
  const className = `${baseClassName}Action`;
  const description = t.trsName || t.id || '交易描述';
  
  // Extract Request/Response class names based on baseClassName
  const requestClass = `${baseClassName}Request`;
  const responseClass = `${baseClassName}Response`;
  
  return `/**\n` +
         `\n` +
         ` * ${description}\n` +
         ` *\n` +
         ` * @author ${author}\n` +
         ` */\n` +
         `@Slf4j\n` +
         `@Service\n` +
         `@Description("${className}")\n` +
         `public class ${className} extends AbstractExecutableAction {\n` +
         `\n` +
         `    @Autowired\n` +
         `    private EcssSendService ecssSendService;\n` +
         `\n` +
         `    @Override\n` +
         `    public void doexecute(Context context) throws PsException {\n` +
         `        EntUser entUser = (EntUser) context.getUser();\n` +
         `        context.setData("cifNo", entUser.getCifNo());\n` +
         `        context.setDataMap(BeanMapUtils.beanToMap(ecssSendService.send(context, context.getDataMap(),\n` +
         `                ${requestClass}.class, ${responseClass}.class)));\n` +
         `    }\n` +
         `\n` +
         `}`;
};