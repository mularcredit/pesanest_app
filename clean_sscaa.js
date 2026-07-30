const fs = require('fs');
let file = 'src/app/finance-studio/page.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/import \{ SSCAAStatementTemplate, SSCAATransaction \} from '@\/components\/finance-studio\/SSCAAStatementTemplate';\n/g, '');
code = code.replace(/, SSCAAReportPDF/g, '');
code = code.replace(/, getSSCAAStatementData/g, '');
code = code.replace(/ \| 'SSCAA_REPORT'/g, '');

const stateRegex = /\/\/\s*---\s*STATE FOR SSCAA REPORT\s*---[\s\S]*?\}\);\n/g;
code = code.replace(stateRegex, '');

const tabRegex = /<button[\s\S]*?setActiveTab\('SSCAA_REPORT'\);[\s\S]*?<\/button>\n/g;
code = code.replace(tabRegex, '');

const editorRegex = /\{\/\* --- SSCAA REPORT EDITOR --- \*\/\}[\s\S]*?\{activeTab === 'SSCAA_REPORT' && \([\s\S]*?\}\)\}/g;
code = code.replace(editorRegex, '');

// other activeTab conditions:
// else if (activeTab === 'SSCAA_REPORT') { ... } for download and PDF
code = code.replace(/else if \(activeTab === 'SSCAA_REPORT'\) \{[\s\S]*?const sscaaRest =[\s\S]*?MyDocument = <SSCAAReportPDF[\s\S]*?;\n\s*\}/g, '');
code = code.replace(/else if \(activeTab === 'SSCAA_REPORT'\) \{[\s\S]*?const sscaaBlob =[\s\S]*?saveAs\(sscaaBlob,\s*`\$\{sscaaData\.statementNo\}\.pdf`\);\n\s*\}/g, '');
code = code.replace(/\{activeTab === 'SSCAA_REPORT' && \(\(\) => \{[\s\S]*?return <SSCAAStatementTemplate[\s\S]*?\}\)\(\)\}/g, '');

fs.writeFileSync(file, code);
