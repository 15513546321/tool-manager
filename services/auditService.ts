import { Database, TABLE } from './database';

export interface LogEntry {
  id: string;
  timestamp: string;
  ip: string;
  username: string; // Derived from IP or User Context
  action: string;
  details: string;
}

export interface IpMapping {
  ip: string;
  name: string;
}

// Helper to simulate getting client IP
// Changed to localStorage to simulate a static IP per machine (Client Persistence)
export const getCurrentIp = (): string => {
  let ip = localStorage.getItem('mock_client_device_ip');
  if (!ip) {
    // Generate a consistent random mock IP for this browser instance
    // Simulating distinct clients like 192.168.1.X
    const segment = Math.floor(Math.random() * 200) + 50; 
    ip = `192.168.1.${segment}`;
    localStorage.setItem('mock_client_device_ip', ip);
  }
  return ip;
};

export const getIpMappings = (): IpMapping[] => {
  const saved = Database.findAll<IpMapping>(TABLE.IP_MAPPINGS);
  return saved.length > 0 ? saved : [
    { ip: '192.168.1.100', name: '管理员 (Admin)' },
    { ip: '192.168.1.101', name: '开发人员 (Dev)' }
  ];
};

export const saveIpMappings = (mappings: IpMapping[]) => {
  Database.save(TABLE.IP_MAPPINGS, mappings);
};

export const getNameByIp = (ip: string): string => {
  const mappings = getIpMappings();
  const found = mappings.find(m => m.ip === ip);
  
  // Also try to get logged in user from session as fallback
  if (!found) {
      try {
          const userJson = localStorage.getItem('user');
          if (userJson) {
              const user = JSON.parse(userJson);
              return `${user.username} (Unmapped IP)`;
          }
      } catch(e) {}
  }
  
  return found ? found.name : 'Unknown Device';
};

export const recordAction = (action: string, details: string) => {
  const logs = Database.findAll<LogEntry>(TABLE.AUDIT_LOGS);
  
  const ip = getCurrentIp();
  const entry: LogEntry = {
    id: Date.now().toString(),
    timestamp: new Date().toLocaleString(),
    ip: ip,
    username: getNameByIp(ip),
    action,
    details
  };

  // Prepend new log and limit size
  const newLogs = [entry, ...logs].slice(0, 2000); 
  Database.save(TABLE.AUDIT_LOGS, newLogs);
};

export const getLogs = (): LogEntry[] => {
  return Database.findAll<LogEntry>(TABLE.AUDIT_LOGS);
};