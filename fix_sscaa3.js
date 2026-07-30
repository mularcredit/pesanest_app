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
let sIdx1 = code.indexOf(stateStartStr);
let sIdx2 = code.indexOf(stateEndStr);
if (sIdx1 !== -1 && sIdx2 !== -1) {
    code = code.substring(0, sIdx1) + code.substring(sIdx2);
}

// 4. Tab button
const btnStartStr = '<button\n                            onClick={async () => {\n                                setActiveTab(\'SSCAA_REPORT\');';
const btnEndStr = '<PiBuildings className="text-lg" /> SSCAA\n                        </button>';
sIdx1 = code.indexOf(btnStartStr);
sIdx2 = code.indexOf(btnEndStr);
if (sIdx1 !== -1 && sIdx2 !== -1) {
    code = code.substring(0, sIdx1) + code.substring(sIdx2 + btnEndStr.length);
}

// 5. Editor Section
const editorStartStr = '{/* --- SSCAA REPORT EDITOR --- */}';
const editorEndStr = '{/* BOTTOM ACTIONS */}';
sIdx1 = code.indexOf(editorStartStr);
sIdx2 = code.indexOf(editorEndStr);
if (sIdx1 !== -1 && sIdx2 !== -1) {
    code = code.substring(0, sIdx1) + '\n                ' + code.substring(sIdx2);
}

// 6. Draft save condition
const draftStartStr = '} else if (activeTab === \'SSCAA_REPORT\') {\n                                    key = \'studio_draft_sscaa\';\n                                    value = JSON.stringify(sscaaData);\n                                }';
code = code.replace(draftStartStr, '}');

// 7. Download PDF condition
const dlPattern = /\} else if \(activeTab === 'SSCAA_REPORT'\) \{\s*const sscaaRest =[\s\S]*?MyDocument = <SSCAAReportPDF[\s\S]*?;\n\s*\}/g;
code = code.replace(dlPattern, '}');
    
const saveAsPattern = /\} else if \(activeTab === 'SSCAA_REPORT'\) \{\s*const sscaaBlob =[\s\S]*?saveAs\(sscaaBlob, `\$\{sscaaData\.statementNo\}\.pdf`\);\n\s*\}/g;
code = code.replace(saveAsPattern, '}');

// 8. Preview template
const previewStartStr = '{activeTab === \'SSCAA_REPORT\' && (() => {';
const previewEndStr = 'return <SSCAAStatementTemplate {...rest} period={period} />;\n                                })()}';
sIdx1 = code.indexOf(previewStartStr);
sIdx2 = code.indexOf(previewEndStr);
if (sIdx1 !== -1 && sIdx2 !== -1) {
    code = code.substring(0, sIdx1) + code.substring(sIdx2 + previewEndStr.length);
}

fs.writeFileSync(file, code);
