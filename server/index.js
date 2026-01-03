/**
 * J.A.R.V.I.S. Local Server
 * Handles system commands like opening applications
 * Run with: node server/index.js
 */

import http from 'http';
import { exec } from 'child_process';
import { parse } from 'url';

const PORT = 3001;

// Application mappings for Windows
const APP_COMMANDS = {
  // Browsers
  'chrome': 'start chrome',
  'google chrome': 'start chrome',
  'browser': 'start chrome',
  'edge': 'start msedge',
  'microsoft edge': 'start msedge',
  'firefox': 'start firefox',
  
  // System Tools
  'calculator': 'start calc',
  'calc': 'start calc',
  'notepad': 'start notepad',
  'paint': 'start mspaint',
  'wordpad': 'start wordpad',
  'snipping tool': 'start snippingtool',
  'snip': 'start snippingtool',
  
  // File Explorer
  'explorer': 'start explorer',
  'file explorer': 'start explorer',
  'files': 'start explorer',
  'my computer': 'start explorer',
  
  // Settings & Control Panel
  'settings': 'start ms-settings:',
  'control panel': 'start control',
  'device manager': 'start devmgmt.msc',
  'task manager': 'start taskmgr',
  
  // Microsoft Office
  'word': 'start winword',
  'microsoft word': 'start winword',
  'excel': 'start excel',
  'microsoft excel': 'start excel',
  'powerpoint': 'start powerpnt',
  'outlook': 'start outlook',
  
  // Media
  'spotify': 'start spotify',
  'vlc': 'start vlc',
  'media player': 'start wmplayer',
  'windows media player': 'start wmplayer',
  'photos': 'start ms-photos:',
  
  // Communication
  'discord': 'start discord',
  'slack': 'start slack',
  'teams': 'start msteams',
  'microsoft teams': 'start msteams',
  'zoom': 'start zoom',
  'skype': 'start skype',
  
  // Development
  'vscode': 'start code',
  'vs code': 'start code',
  'visual studio code': 'start code',
  'visual studio': 'start devenv',
  'cmd': 'start cmd',
  'command prompt': 'start cmd',
  'terminal': 'start wt',
  'windows terminal': 'start wt',
  'powershell': 'start powershell',
  
  // Games & Entertainment
  'steam': 'start steam',
  'epic games': 'start "C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win32\\EpicGamesLauncher.exe"',
  
  // Utilities
  'magnifier': 'start magnify',
  'on-screen keyboard': 'start osk',
  'character map': 'start charmap',
  'disk cleanup': 'start cleanmgr',
  'remote desktop': 'start mstsc',
  
  // Websites (open in default browser)
  'youtube': 'start https://youtube.com',
  'google': 'start https://google.com',
  'gmail': 'start https://gmail.com',
  'github': 'start https://github.com',
  'twitter': 'start https://twitter.com',
  'facebook': 'start https://facebook.com',
  'linkedin': 'start https://linkedin.com',
  'reddit': 'start https://reddit.com',
  'amazon': 'start https://amazon.com',
  'netflix': 'start https://netflix.com',
};

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Find the best matching application
function findApp(query) {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Direct match
  if (APP_COMMANDS[normalizedQuery]) {
    return { name: normalizedQuery, command: APP_COMMANDS[normalizedQuery] };
  }
  
  // Partial match
  for (const [appName, command] of Object.entries(APP_COMMANDS)) {
    if (appName.includes(normalizedQuery) || normalizedQuery.includes(appName)) {
      return { name: appName, command };
    }
  }
  
  // Try as a direct Windows command
  return { name: query, command: `start ${query}` };
}

// Execute command
function openApp(appName) {
  return new Promise((resolve, reject) => {
    const app = findApp(appName);
    
    console.log(`Opening: ${app.name} with command: ${app.command}`);
    
    exec(app.command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        reject(new Error(`Failed to open ${app.name}: ${error.message}`));
        return;
      }
      resolve({ success: true, app: app.name });
    });
  });
}

// Create server
const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }
  
  const parsedUrl = parse(req.url, true);
  
  // Health check
  if (parsedUrl.pathname === '/health') {
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify({ status: 'online', message: 'J.A.R.V.I.S. system server is operational' }));
    return;
  }
  
  // List available apps
  if (parsedUrl.pathname === '/apps') {
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify({ 
      apps: Object.keys(APP_COMMANDS).sort(),
      count: Object.keys(APP_COMMANDS).length 
    }));
    return;
  }
  
  // Open application
  if (parsedUrl.pathname === '/open' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const { app } = JSON.parse(body);
        
        if (!app) {
          res.writeHead(400, corsHeaders);
          res.end(JSON.stringify({ error: 'No application specified' }));
          return;
        }
        
        const result = await openApp(app);
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }
  
  // Open via GET (easier testing)
  if (parsedUrl.pathname === '/open' && req.method === 'GET') {
    const appName = parsedUrl.query.app;
    
    if (!appName) {
      res.writeHead(400, corsHeaders);
      res.end(JSON.stringify({ error: 'No application specified. Use ?app=calculator' }));
      return;
    }
    
    try {
      const result = await openApp(appName);
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  
  // Default response
  res.writeHead(200, corsHeaders);
  res.end(JSON.stringify({
    message: 'J.A.R.V.I.S. System Server',
    endpoints: {
      '/health': 'Check server status',
      '/apps': 'List available applications',
      '/open?app=<name>': 'Open an application (GET)',
      '/open': 'Open an application (POST with { app: "<name>" })',
    }
  }));
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║     J.A.R.V.I.S. SYSTEM SERVER                             ║');
  console.log('║     ─────────────────────────────                          ║');
  console.log(`║     Status: ONLINE                                         ║`);
  console.log(`║     Port: ${PORT}                                             ║`);
  console.log('║                                                            ║');
  console.log('║     Ready to execute system commands.                      ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Available commands:');
  console.log('  - Open applications: "open calculator", "open chrome"');
  console.log('  - Open websites: "open youtube", "open github"');
  console.log('');
});
