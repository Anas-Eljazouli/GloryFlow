def iso6346_check_digit(owner, serial):
    letter_vals = {}
    val = 10
    for ch in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
        letter_vals[ch] = val
        val += 1
        if val % 11 == 0:
            val += 1
    code = owner + 'U' + serial
    weights = [2**i for i in range(len(code))]
    total = 0
    for i, ch in enumerate(code):
        v = letter_vals[ch] if ch.isalpha() else int(ch)
        total += v * weights[i]
    return (total % 11) % 10

codes = [
    'MSCU2914172', 'CMAU7763170', 'TGHU0669077', 'TEMU4391505',
    'SUDU0080638', 'FSCU6083779', 'CAIU8353372', 'OOLU4068120'
]

print("Validating existing container codes:")
for code in codes:
    owner = code[:3]
    serial = code[4:10]
    check = int(code[10])
    expected = iso6346_check_digit(owner, serial)
    if check == expected:
        print(f'{code}: ✓ VALID')
    else:
        corrected = f'{owner}U{serial}{expected}'
        print(f'{code}: ✗ INVALID - should be {corrected}')
