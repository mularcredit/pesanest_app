const fs = require('fs');
let file = 'src/app/finance-studio/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. imports
code = code.replace(/import \{ SSCAAStatementTemplate, SSCAATransaction \} from '@\/components\/finance-studio\/SSCAAStatementTemplate';\n/g, '');
code = code.replace(/, SSCAAReportPDF/g, '');
code = code.replace(/, getSSCAAStatementData/g, '');

// 2. Active Tab Type
code = code.replace(/ \| 'SSCAA_REPORT'/g, '');

// 3. State removal
const stateStartStr = '// --- STATE FOR SSCAA REPORT ---';
const stateEndStr = '// --- UNIQUENESS CHECK ---';
const stateStart = code.indexOf(stateStartStr);
const stateEnd = code.indexOf(stateEndStr);
if (stateStart !== -1 && stateEnd !== -1) {
    code = code.substring(0, stateStart) + code.substring(stateEnd);
}

// 4. Tab button
const btnStartStr = '<button\n                            onClick={async () => {\n                                setActiveTab(\'SSCAA_REPORT\');';
const btnEndStr = '<PiBuildings className="text-lg" /> SSCAA\n                        </button>';
const btnStart = code.indexOf(btnStartStr);
const btnEnd = code.indexOf(btnEndStr) + btnEndStr.length;
if (btnStart !== -1 && btnEnd !== -1) {
    code = code.substring(0, btnStart) + code.substring(btnEnd);
}

// 5. Editor Section
const editorStartStr = '{/* --- SSCAA REPORT EDITOR --- */}';
const editorEndStr = '{/* BOTTOM ACTIONS */}';
const editorStart = code.indexOf(editorStartStr);
const editorEnd = code.indexOf(editorEndStr);
if (editorStart !== -1 && editorEnd !== -1) {
    // Keep BOTTOM ACTIONS
    code = code.substring(0, editorStart) + '\n                ' + code.substring(editorEnd);
}

// 6. Draft save condition
const draftStartStr = '} else if (activeTab === \'SSCAA_REPORT\') {\n                                    key = \'studio_draft_sscaa\';\n                                    value = JSON.stringify(sscaaData);\n                                }';
code = code.replace(draftStartStr, '}');

// 7. Download PDF condition
const dlStartStr = '} else if (activeTab === \'SSCAA_REPORT\') {';
const dlStart = code.indexOf(dlStartStr);
if (dlStart !== -1) {
    // Need to find the end of this block
    const dlPattern = /\} else if \(activeTab === 'SSCAA_REPORT'\) \{\s*const sscaaRest =[\s\S]*?MyDocument = <SSCAAReportPDF[\s\S]*?;\n\s*\}/g;
    code = code.replace(dlPattern, '}');
    
    // Also remove the saveAs part for SSCAA
    const saveAsPattern = /\} else if \(activeTab === 'SSCAA_REPORT'\) \{\s*const sscaaBlob =[\s\S]*?saveAs\(sscaaBlob, `\$\{sscaaData\.statementNo\}\.pdf`\);\n\s*\}/g;
    code = code.replace(saveAsPattern, '}');
}

// 8. Preview template
const previewStartStr = '{activeTab === \'SSCAA_REPORT\' && (() => {';
const previewEndStr = 'return <SSCAAStatementTemplate {...rest} period={period} />;\n                                })()}';
const previewStart = code.indexOf(previewStartStr);
const previewEnd = code.indexOf(previewEndStr) + previewEndStr.length;
if (previewStart !== -1 && previewEnd !== -1) {
    code = code.substring(0, previewStart) + code.substring(previewEnd);
}

fs.writeFileSync(file, code);
