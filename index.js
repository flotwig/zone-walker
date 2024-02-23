#!/usr/bin/env node

const { program, InvalidArgumentError } = require('commander')
const getdns = require('getdns')
const dns = require('dns')
const dnsPromises = dns.promises
const { normalizeName, incrementName, compareName } = require('./utils')

const isDebugged = process.env['DEBUG'] && process.env['DEBUG'].includes('zone-walker')

function debug(...args) {
    if (!isDebugged) return
    console.error('zone-walker debug:', ...args)
}

const validDomainChars = '0123456789abcdefghijklmnopqrstuvwxyz'

program
    .name('zone-walker')
    .description('Walks through DNS zones using NSEC responses and writes found domains to stdout.')
    .argument('<zone>', 'zone to traverse, e.g. "arpa."', normalizeName)
    .option('-P, --parallel <parallelism>', `number of parallel searches to run (max: ${validDomainChars.length})`, (v) => {
        if (v < 1 || v > validDomainChars.length) throw new InvalidArgumentError(`parallel must be between 1 and ${validDomainChars.length}`)
        return Number(v)
    }, 1)
    .option('-R, --rps <rps>', 'maximum number of domains to process per second', 10)
    .option('-S, --start <domain>', 'start walking from after a specific domain. ignored if --parallel is passed (exclusive)', normalizeName)
    .parse()

const zone = program.processedArgs[0]

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
                // fall-back for when domains loop back to the start
                for (const record of res.replies_tree[0].authority) {
                    // TODO: this could probably be made more specific
                    if (record.type === getdns.RRTYPE_NSEC && compareName(name, record.rdata.next_domain_name) >= 0) return resolve('')
                    if (record.type === getdns.RRTYPE_NSEC && normalizeName(name) === normalizeName(record.rdata.next_domain_name)) return resolve('')
                }
            }

            const nsec = nsecs[0]

            if (!nsec) {
                console.error(res.replies_tree[0].authority)
                return reject(new Error('Missing nsec on ' + incremented))
            }

            if (!nsec.rdata.next_domain_name) {
                return reject(new Error('Missing next_domain_name on ' + incremented + ', cannot proceed'))
            }

            resolve(nsec.rdata.next_domain_name.toLowerCase())
        })
    })
}

function delay(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}

async function walkZone(start, suffix, end, context) {
    debug('Walking zone from', start, 'to', end, 'expecting suffix', suffix)
    const maxFailureDelay = 2 * 60 * 1000
    const minMs = 1000 / program.opts().rps
    let current = start
    async function attempt(failureDelay) {
        try {
            return await getNsecNextName(current, context)
        } catch (err) {
            console.error('Received error on ' + current + ', retrying in ' + failureDelay + 'ms')
            console.error(err)
            await delay(failureDelay)
            return attempt(Math.min(Math.round(failureDelay * 1.5), maxFailureDelay))
        }
    }
    while (current) {
        const started = Date.now()
        const nextName = await attempt(500)

        if (end && compareName(nextName, end) > 0) {
            debug('End reached starting at', start, 'ending at', end)
            break
        }

        if (compareName(nextName, suffix) === 0) {
            debug(`Next zone ${nextName} is equal to ${suffix}, ending`)
            break
        }

        if (!nextName.endsWith(suffix)) {
            debug(`Next zone ${nextName} does not end with ${suffix}, ending`)
            break
        }

        console.log(nextName.slice(0, -1))
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
    return {
        resolution_type: getdns.RESOLUTION_RECURSING,
        upstream_recursive_servers: ipAddresses,
    }
}).catch(() => {
    console.error('An error occurred while finding nameservers for ' + zone + ', continuing')
    return {
        resolution_type: getdns.RESOLUTION_RECURSING,
        upstream_recursive_servers: []
    }
}).then(contextOpts => {
    const context = getdns.createContext({
        ...contextOpts,
        timeout: 5000,
        return_dnssec_status: true
    })

    process.on('beforeExit', () => {
        context.destroy()
    })

    const suffix = `.${zone}`

    if (program.opts().parallel === 1) {
        const start = program.opts().start || suffix
        return walkZone(start, suffix, undefined, context)
    } else {
        const starts = []
        const step = Math.max(Math.floor(validDomainChars.length / program.opts().parallel))
        let i = 0
        while (i < validDomainChars.length) {
            starts.push(validDomainChars[i])
            i += step
        }
        debug('Using chunks starting with', starts)
        return Promise.all(starts.map((start, i) => {
            const end = (i === validDomainChars.length - 1) ? undefined : starts[i + 1]
            return walkZone(i === 0 ? suffix : (start + suffix), suffix, end ? end + suffix : undefined, context)
        }))
    }
})
