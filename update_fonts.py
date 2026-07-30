import os
import re

def walk(dir):
    results = []
    for root, dirs, files in os.walk(dir):
        if 'node_modules' in root or '.next' in root or 'studio' in root or '.git' in root:
            continue
        for file in files:
            if file.endswith(('.tsx', '.ts', '.jsx', '.js')):
                if 'studio' not in file:
                    results.append(os.path.join(root, file))
    return results

files = walk('./src')
changed_files = 0

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # match exact classes font-bold, font-extrabold, font-black
    if re.search(r'\b(font-bold|font-extrabold|font-black)\b', content):
        new_content = re.sub(r'\b(font-bold|font-extrabold|font-black)\b', 'font-semibold', content)
        with open(file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        changed_files += 1

print(f"Updated fonts in {changed_files} files.")
