import re

file_path = '/Users/mac/Desktop/pesanest1/src/components/dashboard/ApprovalQueue.tsx'

with open(file_path, 'r') as f:
    content = f.read()

# Replace state definition
content = content.replace(
    'const [isProcessing, setIsProcessing] = useState(false);',
    'const [processingAction, setProcessingAction] = useState<{id: string, action: string} | null>(null);'
)

# Replace handleApproval signature and body
content = content.replace(
    'setIsProcessing(true);',
    'setProcessingAction({id: approvalId, action});'
)

content = content.replace(
    'setIsProcessing(false);',
    'setProcessingAction(null);'
)

# Now, we need to replace button disabled and icon states.
# The `disabled={isProcessing}` should become `disabled={processingAction !== null}`
content = content.replace(
    'disabled={isProcessing}',
    'disabled={processingAction !== null}'
)

# And inside buttons, `{isProcessing ? <PiSpinner className="animate-spin" /> : <PiCheckCircle />} Approve`
# Need to replace {isProcessing ? ...} with {processingAction?.id === (entity as any).approvalId && processingAction?.action === 'ACTION' ? ...}
# Let's iterate using regex and replace `isProcessing ?` with the specific check.
# Since the buttons might be split across lines, let's craft targeted regexes.

# For Approve:
content = re.sub(
    r"onClick={\(\) => handleApproval\(\(([^ ]+) as any\)\.approvalId, 'APPROVE'\)}(.*?)disabled={processingAction !== null}(.*?)>(\s*)\{isProcessing \?",
    r"onClick={() => handleApproval((\1 as any).approvalId, 'APPROVE')}\2disabled={processingAction !== null}\3>\4{processingAction?.id === (\1 as any).approvalId && processingAction?.action === 'APPROVE' ?",
    content,
    flags=re.DOTALL
)

# For Reject:
content = re.sub(
    r"onClick={\(\) => handleApproval\(\(([^ ]+) as any\)\.approvalId, 'REJECT'\)}(.*?)disabled={processingAction !== null}(.*?)>(\s*)\{isProcessing \?",
    r"onClick={() => handleApproval((\1 as any).approvalId, 'REJECT')}\2disabled={processingAction !== null}\3>\4{processingAction?.id === (\1 as any).approvalId && processingAction?.action === 'REJECT' ?",
    content,
    flags=re.DOTALL
)

# For Adjust:
content = re.sub(
    r"onClick={\(\) => handleApproval\(\(([^ ]+) as any\)\.approvalId, 'ADJUST'\)}(.*?)disabled={processingAction !== null}(.*?)>(\s*)\{isProcessing \?",
    r"onClick={() => handleApproval((\1 as any).approvalId, 'ADJUST')}\2disabled={processingAction !== null}\3>\4{processingAction?.id === (\1 as any).approvalId && processingAction?.action === 'ADJUST' ?",
    content,
    flags=re.DOTALL
)


# There might be some list buttons where disabled and class are in a different order,
# wait, my regex: disabled={processingAction !== null} is in the middle. Let's make an easier regex.

content = re.sub(
    r"onClick={\(\) => handleApproval\(\(([^ ]+) as any\)\.approvalId, '([^']+)'\)}(.*?)\{isProcessing \?",
    r"onClick={() => handleApproval((\1 as any).approvalId, '\2')}\3{processingAction?.id === (\1 as any).approvalId && processingAction?.action === '\2' ?",
    content,
    flags=re.DOTALL
)

with open(file_path, 'w') as f:
    f.write(content)
