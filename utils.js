// return names like `www.website.com.`
function normalizeName(name) {
    return name.split('.').filter(x => x).join('.') + '.'
}

function incrementString(str) {
    const buf = Buffer.from(str, 'ascii')

    for (let i = buf.length; i--; i <= 0) {
        const char = buf[i]
        if (char === 255) continue
        buf.writeUint8(char + 1, i)
        break
    }

    return buf.toString('ascii')
}

function incrementName(name) {
    // TODO: refine this, could skip some labels?
    const labels = name.split('.')
    if (labels[0].length === 63) {
        // avoid overflowing max label length
        labels[0] = incrementString(labels[0])
    } else {
        labels[0] = labels[0] + '\001'
    }
    return labels.join('.')
}

// https://serverfault.com/a/1121552/483223
// https://www.rfc-editor.org/rfc/rfc4034#section-6.1
// https://bert-hubert.blogspot.com/2015/10/how-to-do-fast-canonical-ordering-of.html
function compareName(a, b) {
    const aReverse = a.split('.').filter((x) => x).reverse().join('.')
    const bReverse = b.split('.').filter((x) => x).reverse().join('.')
    return aReverse.toLowerCase().localeCompare(bReverse.toLowerCase())
}

module.exports = {
    normalizeName,
    incrementName,
    compareName
}
