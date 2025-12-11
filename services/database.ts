/**
 * Database Service Adapter
 * 
 * This service provides a centralized persistence layer. 
 * In a full-stack environment, this would connect to a Spring Boot backend with H2/MySQL.
 * For this frontend application, it implements the Repository pattern using LocalStorage 
 * to ensure data persistence across reloads.
 */

export const TABLE = {
  ANNOUNCEMENTS: 'announcements',
  DOCS: 'docs',
  DOC_CATEGORIES: 'docCategories',
  PARAMS: 'sysParams',
  MENUS: 'appMenus',
  AUDIT_LOGS: 'auditLogs',
  IP_MAPPINGS: 'ipMappings',
  TEMPLATES: 'xmlTemplates',
  GITLAB_SETTINGS: 'gitlabSettings',
  ORACLE_CONNS: 'oracleConnections', // Legacy
  ORACLE_SOURCE_CONNS: 'oracleSourceConnections',
  ORACLE_TARGET_CONNS: 'oracleTargetConnections',
  SUGGESTIONS: 'suggestions',
  GITEE_CONFIG: 'giteeConfig'
};

export const Database = {
  /**
   * Simulate SELECT * FROM table
   */
  findAll: <T>(table: string): T[] => {
    try {
      const data = localStorage.getItem(table);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error(`DB Read Error [${table}]`, e);
      return [];
    }
  },

  /**
   * Simulate INSERT / UPDATE (Bulk Save)
   */
  save: <T>(table: string, data: T[]) => {
    try {
      localStorage.setItem(table, JSON.stringify(data));
    } catch (e) {
      console.error(`DB Write Error [${table}]`, e);
    }
  },
  
  /**
   * Retrieve configuration object (e.g. key-value pairs)
   */
  findObject: <T>(table: string): T | null => {
      try {
        const data = localStorage.getItem(table);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        return null;
      }
  },
  
  /**
   * Save configuration object
   */
  saveObject: <T>(table: string, data: T) => {
      localStorage.setItem(table, JSON.stringify(data));
  }
};