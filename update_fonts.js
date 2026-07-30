const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        if (file.includes('node_modules') || file.includes('.next') || file.includes('studio') || file.includes('.git')) {
            return;
        }
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./src');
let changedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const regex = /\b(font-bold|font-extrabold|font-black)\b/g;
    
    if (regex.test(content)) {
        const newContent = content.replace(regex, 'font-semibold');
        fs.writeFileSync(file, newContent);
        changedFiles++;
    }
});

console.log(`Updated fonts in ${changedFiles} files.`);
