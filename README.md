# zone-walker

A CLI tool to walk through DNS zones using NSEC responses and enumerate the domains in a zone.

> ⚠️ zone-walker is beta software. Please report any issues encountered.

## Installation

Requirements:

* `getdns` library installed - on Ubuntu, this requires the `libgetdns-dev` package.
* Node.js (tested on Node.js 16)

`zone-walker` is available via npm:

```
npm install --global zone-walker
```

Or use `npx`:

```
npx zone-walker ...
```

## Usage

```
Usage: zone-walker [options] <zone>

Walks through DNS zones using NSEC responses and writes found domains to stdout.

Arguments:
  zone             zone to traverse, e.g. "arpa."

Options:
  -R, --rps <rps>  maximum number of domains to process per second (default: 10)
  -h, --help       display help for command
```

### Example

```
> zone-walker arpa.
as112.arpa
e164.arpa
home.arpa
in-addr.arpa
in-addr-servers.arpa
[ ... ]
```

## See Also

* [`zone-walks`](https://github.com/flotwig/zone-walks/) - updated repository of TLD walks created using this tool
* [`ldns-walk`](https://github.com/NLnetLabs/ldns/blob/develop/examples/ldns-walk.c) - similar tool written in C, crashes when walking larger zones
* [`dnsrecon`](https://github.com/darkoperator/dnsrecon) - DNS reconnaisance in Python, supports zone walking, though it doesn't work for TLDs
* [TLDR2's Walkable Zones list](https://github.com/monoidic/TLDR2/blob/master/walkable_zones.md) - updated list of TLDs which allow zone walking
