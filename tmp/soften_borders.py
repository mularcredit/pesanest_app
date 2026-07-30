import sys

path = '/Users/mac/Desktop/prudenceapp/src/components/dashboard/PaymentQueue.tsx'
with open(path, 'r', encoding='utf-8') as f:
    data = f.read()

# Soften borders according to user feedback
data = data.replace('border-slate-900', 'border-slate-300')
data = data.replace('border-black', 'border-slate-400')
data = data.replace('border-2 ', 'border ')

with open(path, 'w', encoding='utf-8') as f:
    f.write(data)

print("Borders softened in PaymentQueue.tsx")
