import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('app/api', function(filePath) {
  if (filePath.endsWith('route.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('withRateLimit')) return;

    let modified = false;
    let newContent = `import { withRateLimit } from "@/lib/middleware/with-rate-limit";\n` + content;
    
    let exportsToAdd = [];
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
    
    methods.forEach(method => {
      const regex = new RegExp(`export\\s+async\\s+function\\s+${method}\\b`, 'g');
      if (regex.test(newContent)) {
        newContent = newContent.replace(regex, `async function ${method}_handler`);
        exportsToAdd.push(`export const ${method} = withRateLimit(${method}_handler);`);
        modified = true;
      }
    });

    if (modified) {
      newContent += `\n\n${exportsToAdd.join('\n')}\n`;
      fs.writeFileSync(filePath, newContent);
      console.log(`Updated ${filePath}`);
    }
  }
});
