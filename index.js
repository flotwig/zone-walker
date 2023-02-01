#!/usr/bin/env node

const { program } = require('commander')
const getdns = require('getdns')
const dns = require('dns')
const dnsPromises = dns.promises

program
    .name('zone-walker')
    .description('Walks through DNS zones using NSEC responses and writes found domains to stdout.')
    .argument('<zone>', 'zone to traverse, e.g. "arpa."')
    .option('-R, --rps <rps>', 'maximum number of domains to process per second', 10)
    .option('-S, --start <domain>', 'start walking from after a specific domain (exclusive)')
    .parse()

const zone = program.args[0]

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
// https://www.rfc-editor.org/rfc/rfc4034#section-6
// https://bert-hubert.blogspot.com/2015/10/how-to-do-fast-canonical-ordering-of.html
function compareName(a, b) {
    const aReverse = a.split('.').filter((x) => x).reverse().join('.')
    const bReverse = b.split('.').filter((x) => x).reverse().join('.')
    return aReverse.toLowerCase().localeCompare(bReverse.toLowerCase())
}

function getNsecNextName(name, context) {
    const extensions = {
        dnssec_return_only_secure: true
    }
    const incremented = incrementName(name)
    return new Promise((resolve, reject) => {
        context.general(incremented, getdns.RRTYPE_A, extensions, (err, res) => {
            if (err) {
                console.error('Error getting ' + incremented)
                console.error(err)
                return reject(err)
            }

            if (res.replies_tree.length > 1) {
                console.error('NOTE: multiple in replies_tree for ' + incremented)
            }

            if (!res.replies_tree[0]) {
                console.error(res)
                return reject(new Error('Missing replies tree for ' + incremented + ' Does this zone use DNSSEC?'))
            }

            let nsecs = res.replies_tree[0].authority.filter(record => {
                if (!record.rdata.next_domain_name) return false
                // only next_domain_names greater than the current name
                return compareName(incremented, record.rdata.next_domain_name) < 0
            }).sort((a, b) => {
                return compareName(a.rdata.next_domain_name, b.rdata.next_domain_name)
            })

            if (nsecs.length === 0) {
                // fall-back - necessary for end, loop when there is no greater domain
                nsecs = res.replies_tree[0].authority.filter(record => {
                    // TODO: this could probably be made more specific
                    return record.type === getdns.RRTYPE_NSEC && record.name.toLowerCase().endsWith(name.toLowerCase())
                })
            }

            const nsec = nsecs[0]

            if (!nsec) {
                console.error(res.replies_tree[0].authority)
                reject(new Error('Missing nsec on ' + incremented))
            }

            if (!nsec.rdata.next_domain_name) {
                reject(new Error('Missing next_domain_name on ' + incremented + ', cannot proceed'))
            }

            resolve(nsec.rdata.next_domain_name)
        })
    })
}

function delay(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}

async function walkZone(zone, context) {
    const minMs = 1000 / program.opts().rps
    let current = zone
    function tryAgain(ms) {
        return async (err) => {
            console.error('Received error on ' + current + ', retrying in ' + ms + 'ms')
            console.error(err)
            await delay(ms)
            return getNsecNextName(current, context)
        }
    }
    while (current) {
        const started = Date.now()
        const nextName = await getNsecNextName(current, context)
            .catch(tryAgain(500))
            .catch(tryAgain(2500))
            .catch(tryAgain(5000))
            .catch(tryAgain(10000))
            .catch(tryAgain(10000))
            .catch(tryAgain(10000))
            .catch(tryAgain(120000))
            .catch(tryAgain(5000))
            .catch(tryAgain(5000))

        if (nextName === zone) {
            console.error('Loop detected, ending')
            break
        }
        console.log(nextName.slice(0, -1).toLowerCase())
        current = nextName
        const duration = Date.now() - started
        if (duration < minMs) {
            await delay(minMs - duration)
        }
    }
}

dnsPromises.resolveNs(zone).then(async (addresses) => {
    console.error('Found ' + addresses.length + ' nameservers for ' + zone + ':' + addresses)
    const ipAddresses = await Promise.all(addresses.map(async (address) => {
        const result = await dnsPromises.lookup(address)
        return result.address
    }))
    console.error('Resolved to IPs:' + ipAddresses)

    const context = getdns.createContext({
        resolution_type: getdns.RESOLUTION_RECURSING,
        upstream_recursive_servers: ipAddresses,
        timeout: 5000,
        return_dnssec_status: true
    })

    process.on('beforeExit', () => {
        context.destroy()
    })

    const start = program.opts().start || `.${zone}`

    walkZone(start, context)
})
