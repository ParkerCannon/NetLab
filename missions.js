/* NetLab missions — guided labs, task checks, and one-click setup helpers. */
window.NL = window.NL || {};
(function () {
  'use strict';
  const NL = window.NL;
  const M = NL.model;
  const ip = NL.ip;

  // ---------------- small helpers ----------------
  function dev(name) { return M.byName(name); }
  function hostPort(d) { return d ? d.ports[0] : null; }
  function portNamed(d, name) { return d ? d.ports.find(p => p.name === name) || null : null; }
  function isValidHost(p) { return !!(p && ip.valid(p.ip) && !ip.isNetworkOrBroadcast(p.ip, p.prefix)); }

  function setPort(d, portName, addr, prefix, gateway) {
    const p = portNamed(d, portName);
    if (!p) return false;
    p.ip = addr;
    p.prefix = prefix;
    p.gateway = gateway || '';
    return true;
  }

  function link(a, aPort, b, bPort) {
    M.addLink(a.id, portNamed(a, aPort).id, b.id, portNamed(b, bPort).id);
  }

  function configuredPorts(d) {
    return d ? d.ports.filter(p => isValidHost(p)) : [];
  }

  function distinctSubnets(d) {
    const set = new Set();
    for (const p of configuredPorts(d)) set.add(ip.network(p.ip, p.prefix) + '/' + p.prefix);
    return set;
  }

  function hostGatewayOk(hostName, routerName) {
    const h = dev(hostName);
    const r = dev(routerName);
    const hp = hostPort(h);
    if (!h || !r || !isValidHost(hp) || !ip.valid(hp.gateway)) return false;
    const rp = r.ports.find(p => isValidHost(p) && ip.sameSubnet(p.ip, hp.ip, 24) &&
      ip.sameSubnet(p.ip, hp.ip, p.prefix) && ip.sameSubnet(p.ip, hp.ip, hp.prefix));
    if (!rp) return false;
    return hp.gateway === rp.ip;
  }

  function hostInAnyRouterSubnet(hostName, routerName) {
    const h = dev(hostName);
    const r = dev(routerName);
    const hp = hostPort(h);
    if (!h || !r || !isValidHost(hp)) return false;
    return r.ports.some(p => isValidHost(p) && ip.sameSubnet(p.ip, hp.ip, p.prefix));
  }

  function pingOk(from, to) {
    const a = dev(from);
    const b = dev(to);
    if (!a || !b) return false;
    return !!(NL.flags && NL.flags.pings && NL.flags.pings[a.id + '>' + b.id]);
  }

  function lastPing(from, to) {
    const a = dev(from);
    const b = dev(to);
    const last = NL.flags && NL.flags.last;
    if (!a || !b || !last) return null;
    return last.srcId === a.id && last.dstId === b.id ? last : null;
  }

  function staticRouteCovers(routerName, targetIp) {
    const r = dev(routerName);
    if (!r || !ip.valid(targetIp)) return false;
    return M.routesOf(r).some(rt => !rt.connected && ip.inSubnet(targetIp, rt.network, rt.prefix));
  }

  function anyPingOk() {
    return !!(NL.flags && NL.flags.pings && Object.keys(NL.flags.pings).length);
  }

  function hostsInSameSubnet() {
    const hosts = M.state.devices.filter(d => d.type === 'pc' || d.type === 'server');
    for (let i = 0; i < hosts.length; i++) {
      for (let j = i + 1; j < hosts.length; j++) {
        const a = hostPort(hosts[i]);
        const b = hostPort(hosts[j]);
        if (isValidHost(a) && isValidHost(b) && a.ip !== b.ip &&
            ip.sameSubnet(a.ip, b.ip, a.prefix) && ip.sameSubnet(a.ip, b.ip, b.prefix)) return true;
      }
    }
    return false;
  }

  function deviceHasDhcpLease(d) {
    const p = hostPort(d);
    return !!(p && p.dhcp && ip.valid(p.ip) && p.lease);
  }

  function dhcpClientOk(name) {
    return deviceHasDhcpLease(dev(name));
  }

  function dhcpServerOk(name) {
    const d = dev(name);
    if (!d) return false;
    const info = M.dhcpServerInfo(d);
    return !!(info && info.ok);
  }

  function anyDhcpLease() {
    return M.state.devices.some(deviceHasDhcpLease);
  }

  // ---------------- lab 1: same LAN ----------------
  const lanLab = {
    id: 'lan',
    name: '1 · Same LAN with a switch',
    kicker: 'Lab 1 · Ethernet',
    title: 'Two PCs, one switch',
    intro: 'A switch is the simplest network you can build. Put two computers in the same IP subnet, wire them to a switch, and watch the switch learn which MAC address lives on which port.',
    chips: ['Ethernet', 'MAC learning', 'ARP'],
    tip: 'A MAC address is the hardware name of a network card. An IP address is the logical address you assign. Switches forward using MAC addresses; routers forward using IP addresses.',
    build(pos) {
      const a = M.addDevice('pc', Object.assign({ name: 'PC-A' }, pos(0.10, 0.32)));
      const sw = M.addDevice('switch', Object.assign({ name: 'SW1' }, pos(0.44, 0.32)));
      const b = M.addDevice('pc', Object.assign({ name: 'PC-B' }, pos(0.78, 0.32)));
      link(a, 'eth0', sw, 'Fa0/1');
      link(b, 'eth0', sw, 'Fa0/2');
    },
    tasks: [
      {
        id: 'ip-a',
        title: 'Give PC-A an address',
        detail: 'PC-A should be 192.168.1.10 with a 24-bit mask (255.255.255.0). Select it and use the Device tab, or press the button below.',
        focus: 'PC-A',
        apply() {
          const a = dev('PC-A');
          if (!a) return 'PC-A is missing — reset the lab.';
          setPort(a, 'eth0', '192.168.1.10', 24, '');
          return 'PC-A is now 192.168.1.10/24.';
        },
        check() { return isValidHost(hostPort(dev('PC-A'))); }
      },
      {
        id: 'ip-b',
        title: 'Put PC-B in the same subnet',
        detail: 'Give PC-B 192.168.1.20/24. Same first three numbers means same subnet, so the two PCs can talk without a router.',
        focus: 'PC-B',
        apply() {
          const b = dev('PC-B');
          if (!b) return 'PC-B is missing — reset the lab.';
          setPort(b, 'eth0', '192.168.1.20', 24, '');
          return 'PC-B is now 192.168.1.20/24.';
        },
        check() {
          const a = hostPort(dev('PC-A'));
          const b = hostPort(dev('PC-B'));
          return !!(isValidHost(a) && isValidHost(b) && a.ip !== b.ip &&
            ip.sameSubnet(a.ip, b.ip, 24) && ip.sameSubnet(a.ip, b.ip, a.prefix));
        }
      },
      {
        id: 'ping',
        title: 'Ping PC-A → PC-B',
        detail: 'Switch to the Ping tool and click PC-A, then PC-B. Watch the journey: first an ARP broadcast asks for the MAC address, then the ICMP echo request follows.',
        run: { from: 'PC-A', to: 'PC-B' },
        check() { return pingOk('PC-A', 'PC-B'); }
      },
      {
        id: 'learn',
        title: 'See the switch learn both MAC addresses',
        detail: 'Open SW1 in the Device tab and look at its MAC address table. After the ping it should know which port each PC is on.',
        focus: 'SW1',
        check() {
          const sw = dev('SW1');
          return !!(sw && Object.keys(sw.macTable).length >= 2);
        }
      }
    ]
  };

  // ---------------- lab 2: gateway ----------------
  const gatewayLab = {
    id: 'gateway',
    name: '2 · Router between two subnets',
    kicker: 'Lab 2 · IP & gateways',
    title: 'Crossing the subnet border',
    intro: 'Two subnets cannot talk directly — a router has to carry packets between them. Each PC points at the router interface on its own side, and the router forwards by looking up the destination IP.',
    chips: ['Subnet mask', 'Default gateway', 'Routing table'],
    tip: 'The default gateway is just the router address on your LAN. If the destination is outside your subnet, your PC hands the packet to that address.',
    build(pos) {
      const a = M.addDevice('pc', Object.assign({ name: 'PC-A' }, pos(0.03, 0.30)));
      const s1 = M.addDevice('switch', Object.assign({ name: 'SW1' }, pos(0.22, 0.30)));
      const r = M.addDevice('router', Object.assign({ name: 'R1' }, pos(0.42, 0.30)));
      const s2 = M.addDevice('switch', Object.assign({ name: 'SW2' }, pos(0.62, 0.30)));
      const b = M.addDevice('pc', Object.assign({ name: 'PC-B' }, pos(0.81, 0.30)));
      link(a, 'eth0', s1, 'Fa0/1');
      link(s1, 'Fa0/2', r, 'Gi0/0');
      link(r, 'Gi0/1', s2, 'Fa0/1');
      link(s2, 'Fa0/2', b, 'eth0');
    },
    tasks: [
      {
        id: 'router-ip',
        title: 'Address both router interfaces',
        detail: 'R1 needs 192.168.1.1/24 on Gi0/0 (the left LAN) and 192.168.2.1/24 on Gi0/1 (the right LAN). A router is the doorway between two subnets.',
        focus: 'R1',
        apply() {
          const r = dev('R1');
          if (!r) return 'R1 is missing — reset the lab.';
          setPort(r, 'Gi0/0', '192.168.1.1', 24, '');
          setPort(r, 'Gi0/1', '192.168.2.1', 24, '');
          return 'R1: Gi0/0 = 192.168.1.1/24, Gi0/1 = 192.168.2.1/24.';
        },
        check() {
          const r = dev('R1');
          return !!(r && configuredPorts(r).length >= 2 && distinctSubnets(r).size >= 2);
        }
      },
      {
        id: 'host-a',
        title: 'Point PC-A at its gateway',
        detail: 'PC-A: 192.168.1.10/24, gateway 192.168.1.1. The gateway must be an address on PC-A’s own subnet — that is R1’s left interface.',
        focus: 'PC-A',
        apply() {
          const a = dev('PC-A');
          if (!a) return 'PC-A is missing — reset the lab.';
          setPort(a, 'eth0', '192.168.1.10', 24, '192.168.1.1');
          return 'PC-A is 192.168.1.10/24 with gateway 192.168.1.1.';
        },
        check() { return hostGatewayOk('PC-A', 'R1'); }
      },
      {
        id: 'host-b',
        title: 'Point PC-B at the other router interface',
        detail: 'PC-B: 192.168.2.10/24, gateway 192.168.2.1. It is in a different subnet from PC-A, so every packet has to cross R1.',
        focus: 'PC-B',
        apply() {
          const b = dev('PC-B');
          if (!b) return 'PC-B is missing — reset the lab.';
          setPort(b, 'eth0', '192.168.2.10', 24, '192.168.2.1');
          return 'PC-B is 192.168.2.10/24 with gateway 192.168.2.1.';
        },
        check() {
          const a = hostPort(dev('PC-A'));
          const b = hostPort(dev('PC-B'));
          if (!(isValidHost(a) && isValidHost(b) && !ip.sameSubnet(a.ip, b.ip, a.prefix))) return false;
          return hostGatewayOk('PC-B', 'R1') && hostInAnyRouterSubnet('PC-B', 'R1');
        }
      },
      {
        id: 'ping',
        title: 'Ping across the router',
        detail: 'Ping PC-A → PC-B. Look for the line “ICMP echo request (routed)” in the log and watch the TTL drop by one at R1.',
        run: { from: 'PC-A', to: 'PC-B' },
        check() {
          const last = lastPing('PC-A', 'PC-B');
          return !!(pingOk('PC-A', 'PC-B') && last && last.hops >= 2);
        }
      }
    ]
  };

  // ---------------- lab 3: static routing ----------------
  const staticLab = {
    id: 'static',
    name: '3 · Two routers & static routes',
    kicker: 'Lab 3 · Routing',
    title: 'Teaching routers about far networks',
    intro: 'Each router only knows the networks plugged into it. To reach a network on the far side, add a static route that says “send it to the next router”. This is real routing — just typed by hand.',
    chips: ['Static routes', 'Next hop', 'TTL'],
    tip: 'A static route has three parts: the destination network, the prefix length, and the next-hop IP. The next hop must be reachable through a directly connected interface.',
    build(pos) {
      const a = M.addDevice('pc', Object.assign({ name: 'PC-A' }, pos(0.05, 0.40)));
      const r1 = M.addDevice('router', Object.assign({ name: 'R1' }, pos(0.30, 0.40)));
      const r2 = M.addDevice('router', Object.assign({ name: 'R2' }, pos(0.58, 0.40)));
      const b = M.addDevice('pc', Object.assign({ name: 'PC-B' }, pos(0.82, 0.40)));
      link(a, 'eth0', r1, 'Gi0/0');
      link(r1, 'Gi0/1', r2, 'Gi0/0');
      link(r2, 'Gi0/1', b, 'eth0');
    },
    tasks: [
      {
        id: 'r1-ip',
        title: 'Address R1',
        detail: 'R1: Gi0/0 = 10.0.0.1/24 (toward PC-A) and Gi0/1 = 10.0.1.1/24 (toward R2).',
        focus: 'R1',
        apply() {
          const r = dev('R1');
          if (!r) return 'R1 is missing — reset the lab.';
          setPort(r, 'Gi0/0', '10.0.0.1', 24, '');
          setPort(r, 'Gi0/1', '10.0.1.1', 24, '');
          return 'R1: Gi0/0 = 10.0.0.1/24, Gi0/1 = 10.0.1.1/24.';
        },
        check() {
          const r = dev('R1');
          return !!(r && configuredPorts(r).length >= 2 && distinctSubnets(r).size >= 2);
        }
      },
      {
        id: 'r2-ip',
        title: 'Address R2',
        detail: 'R2: Gi0/0 = 10.0.1.2/24 (toward R1) and Gi0/1 = 10.0.2.1/24 (toward PC-B). Both routers share the 10.0.1.0/24 link.',
        focus: 'R2',
        apply() {
          const r = dev('R2');
          if (!r) return 'R2 is missing — reset the lab.';
          setPort(r, 'Gi0/0', '10.0.1.2', 24, '');
          setPort(r, 'Gi0/1', '10.0.2.1', 24, '');
          return 'R2: Gi0/0 = 10.0.1.2/24, Gi0/1 = 10.0.2.1/24.';
        },
        check() {
          const r1 = dev('R1');
          const r2 = dev('R2');
          if (!r1 || !r2 || configuredPorts(r2).length < 2 || distinctSubnets(r2).size < 2) return false;
          const r1nets = distinctSubnets(r1);
          return [...distinctSubnets(r2)].some(n => r1nets.has(n));
        }
      },
      {
        id: 'hosts',
        title: 'Configure both PCs',
        detail: 'PC-A: 10.0.0.10/24, gateway 10.0.0.1. PC-B: 10.0.2.10/24, gateway 10.0.2.1.',
        focus: 'PC-A',
        apply() {
          const a = dev('PC-A');
          const b = dev('PC-B');
          if (!a || !b) return 'A PC is missing — reset the lab.';
          setPort(a, 'eth0', '10.0.0.10', 24, '10.0.0.1');
          setPort(b, 'eth0', '10.0.2.10', 24, '10.0.2.1');
          return 'PC-A: 10.0.0.10/24 → 10.0.0.1 · PC-B: 10.0.2.10/24 → 10.0.2.1.';
        },
        check() {
          return hostGatewayOk('PC-A', 'R1') && hostGatewayOk('PC-B', 'R2');
        }
      },
      {
        id: 'routes',
        title: 'Add a static route on each router',
        detail: 'R1 must learn 10.0.2.0/24 via 10.0.1.2. R2 must learn 10.0.0.0/24 via 10.0.1.1. Without these, each router drops packets for the far network.',
        focus: 'R1',
        apply() {
          const r1 = dev('R1');
          const r2 = dev('R2');
          if (!r1 || !r2) return 'A router is missing — reset the lab.';
          M.addStaticRoute(r1, '10.0.2.0', 24, '10.0.1.2');
          M.addStaticRoute(r2, '10.0.0.0', 24, '10.0.1.1');
          return 'R1 → 10.0.2.0/24 via 10.0.1.2 · R2 → 10.0.0.0/24 via 10.0.1.1.';
        },
        check() {
          const a = hostPort(dev('PC-A'));
          const b = hostPort(dev('PC-B'));
          if (!isValidHost(a) || !isValidHost(b)) return false;
          return staticRouteCovers('R1', b.ip) && staticRouteCovers('R2', a.ip);
        }
      },
      {
        id: 'ping',
        title: 'Ping all the way across',
        detail: 'Ping PC-A → PC-B. The packet visits two routers, so the TTL drops twice. If it fails, check both routing tables and each next-hop address.',
        run: { from: 'PC-A', to: 'PC-B' },
        check() {
          const last = lastPing('PC-A', 'PC-B');
          return !!(pingOk('PC-A', 'PC-B') && NL.flags.routed && last && last.hops >= 3);
        }
      }
    ]
  };

  // ---------------- lab 4: DHCP ----------------
  const dhcpLab = {
    id: 'dhcp',
    name: '4 · DHCP & automatic addresses',
    kicker: 'Lab 4 · DHCP',
    title: 'Addresses that hand themselves out',
    intro: 'Typing an address into every PC gets old fast. DHCP is the protocol that does it for you: a server keeps a pool of addresses and leases one to each device that asks. Watch the four-message conversation — Discover, Offer, Request, ACK — then use the leased gateway to cross into another subnet.',
    chips: ['DHCP', 'DORA', 'Leases'],
    tip: 'DHCP runs over broadcast before the client has an address of its own. That is why the server has to sit on the same LAN — or a router has to forward the broadcast as a DHCP relay. NetLab keeps it local so you can see the whole exchange.',
    build(pos) {
      const a = M.addDevice('pc', Object.assign({ name: 'PC-A' }, pos(0.02, 0.24)));
      const b = M.addDevice('pc', Object.assign({ name: 'PC-B' }, pos(0.02, 0.62)));
      const srv = M.addDevice('server', Object.assign({ name: 'DHCP Server' }, pos(0.26, 0.42)));
      const sw = M.addDevice('switch', Object.assign({ name: 'SW1' }, pos(0.47, 0.42)));
      const r = M.addDevice('router', Object.assign({ name: 'R1' }, pos(0.67, 0.42)));
      const c = M.addDevice('pc', Object.assign({ name: 'PC-C' }, pos(0.87, 0.42)));
      link(a, 'eth0', sw, 'Fa0/1');
      link(b, 'eth0', sw, 'Fa0/2');
      link(srv, 'eth0', sw, 'Fa0/3');
      link(sw, 'Fa0/4', r, 'Gi0/0');
      link(r, 'Gi0/1', c, 'eth0');
    },
    tasks: [
      {
        id: 'server-ip',
        title: 'Give the DHCP server a fixed address',
        detail: 'The server needs its own stable address before it can hand any out: 192.168.1.5/24 on the same switch as the PCs. Select DHCP Server and use the Device tab, or press the button below.',
        focus: 'DHCP Server',
        apply() {
          const s = dev('DHCP Server');
          if (!s) return 'DHCP Server is missing — reset the lab.';
          setPort(s, 'eth0', '192.168.1.5', 24, '');
          const p = hostPort(s);
          if (p) { p.dhcp = false; p.lease = null; }
          return 'DHCP Server is now 192.168.1.5/24.';
        },
        check() {
          const p = hostPort(dev('DHCP Server'));
          return !!(isValidHost(p) && ip.sameSubnet(p.ip, '192.168.1.0', 24));
        }
      },
      {
        id: 'server-dhcp',
        title: 'Turn on DHCP with a pool',
        detail: 'Open DHCP Server, switch its DHCP server on, and set a pool of 192.168.1.100 – 192.168.1.150 with gateway 192.168.1.1. The pool is the range of addresses the server is allowed to lend out.',
        focus: 'DHCP Server',
        apply() {
          const s = dev('DHCP Server');
          if (!s) return 'DHCP Server is missing — reset the lab.';
          if (!M.dhcpCapable(s)) return 'DHCP Server cannot run DHCP.';
          M.suggestPool(s);
          s.dhcp.enabled = true;
          s.dhcp.gateway = '192.168.1.1';
          return 'DHCP Server is handing out 192.168.1.100 – 192.168.1.150, gateway 192.168.1.1.';
        },
        check() { return dhcpServerOk('DHCP Server'); }
      },
      {
        id: 'router',
        title: 'Address the router between the two LANs',
        detail: 'R1 is the doorway out of this LAN: Gi0/0 = 192.168.1.1/24 (toward SW1) and Gi0/1 = 192.168.2.1/24 (toward PC-C). DHCP will hand that 192.168.1.1 gateway to PC-A and PC-B.',
        focus: 'R1',
        apply() {
          const r = dev('R1');
          if (!r) return 'R1 is missing — reset the lab.';
          setPort(r, 'Gi0/0', '192.168.1.1', 24, '');
          setPort(r, 'Gi0/1', '192.168.2.1', 24, '');
          return 'R1: Gi0/0 = 192.168.1.1/24, Gi0/1 = 192.168.2.1/24.';
        },
        check() {
          const r = dev('R1');
          return !!(r && configuredPorts(r).length >= 2 && distinctSubnets(r).size >= 2);
        }
      },
      {
        id: 'auto',
        title: 'Let PC-A and PC-B ask for addresses',
        detail: 'Select each PC, choose Automatic under addressing, and press Get an address. The log shows DISCOVER → OFFER → REQUEST → ACK: four broadcasts that end with a working IP, mask and gateway.',
        focus: 'PC-A',
        run: [
          { type: 'dhcp', device: 'PC-A' },
          { type: 'dhcp', device: 'PC-B' }
        ],
        check() { return dhcpClientOk('PC-A') && dhcpClientOk('PC-B'); }
      },
      {
        id: 'pc-c',
        title: 'Configure PC-C by hand',
        detail: 'PC-C: 192.168.2.10/24, gateway 192.168.2.1. Not every device uses DHCP — servers and routers often keep fixed addresses so you can always find them.',
        focus: 'PC-C',
        apply() {
          const c = dev('PC-C');
          if (!c) return 'PC-C is missing — reset the lab.';
          setPort(c, 'eth0', '192.168.2.10', 24, '192.168.2.1');
          const p = hostPort(c);
          if (p) { p.dhcp = false; p.lease = null; }
          return 'PC-C is 192.168.2.10/24 with gateway 192.168.2.1.';
        },
        check() { return hostGatewayOk('PC-C', 'R1'); }
      },
      {
        id: 'ping',
        title: 'Ping from a leased address across the router',
        detail: 'Ping PC-A → PC-C. PC-A got its address, mask and gateway from DHCP without you typing anything — and that gateway carries the packet to 192.168.2.10.',
        run: { from: 'PC-A', to: 'PC-C' },
        check() {
          const last = lastPing('PC-A', 'PC-C');
          return !!(pingOk('PC-A', 'PC-C') && last && last.hops >= 2);
        }
      }
    ]
  };

  // ---------------- lab 5: APIPA & UDP ----------------
  const apipaUdpLab = {
    id: 'apipa-udp',
    name: '5 · APIPA & UDP',
    kicker: 'Lab 5 · Link-local & datagrams',
    title: 'When DHCP fails, and when speed beats reliability',
    intro: 'If a device is set to automatic but no DHCP server answers, it can self-assign an APIPA address in 169.254.0.0/16 so it can still talk on the local link. UDP is a different transport style: no handshake, no guarantee, just fast datagrams used by DNS, streaming and games.',
    chips: ['APIPA 169.254/16', 'UDP', 'Connectionless'],
    tip: 'APIPA addresses only work on the same local segment — there is no default gateway, so traffic cannot cross a router. UDP trades reliability for low overhead; TCP would add a handshake and retransmissions.',
    build(pos) {
      const a = M.addDevice('pc', Object.assign({ name: 'PC-A' }, pos(0.10, 0.30)));
      const b = M.addDevice('pc', Object.assign({ name: 'PC-B' }, pos(0.10, 0.60)));
      const sw = M.addDevice('switch', Object.assign({ name: 'SW1' }, pos(0.42, 0.45)));
      const srv = M.addDevice('server', Object.assign({ name: 'Server' }, pos(0.76, 0.45)));
      link(a, 'eth0', sw, 'Fa0/1');
      link(b, 'eth0', sw, 'Fa0/2');
      link(srv, 'eth0', sw, 'Fa0/3');
      // No DHCP server configured on purpose.
    },
    tasks: [
      {
        id: 'apipa-a',
        title: 'Give PC-A a link-local (APIPA) address',
        detail: 'Select PC-A, set addressing to Automatic, then press "Use APIPA". It self-assigns 169.254.x.x/16 because no DHCP server is present.',
        focus: 'PC-A',
        apply() {
          const a = dev('PC-A'); if (!a) return 'PC-A missing.';
          const p = hostPort(a); if (!p) return 'No port.';
          p.dhcp = true; p.lease = null; M.apipaAssign(p);
          return 'PC-A self-assigned ' + p.ip + '/16 (APIPA).';
        },
        check() {
          const p = hostPort(dev('PC-A'));
          return !!(p && p.apipa && ip.valid(p.ip) && ip.network(p.ip, 16) === '169.254.0.0');
        }
      },
      {
        id: 'apipa-b',
        title: 'Give PC-B an APIPA address too',
        detail: 'PC-B also needs a 169.254.x.x/16 address to be on the same link-local subnet as PC-A.',
        focus: 'PC-B',
        apply() {
          const b = dev('PC-B'); if (!b) return 'PC-B missing.';
          const p = hostPort(b); if (!p) return 'No port.';
          p.dhcp = true; p.lease = null; M.apipaAssign(p);
          return 'PC-B self-assigned ' + p.ip + '/16 (APIPA).';
        },
        check() {
          const pa = hostPort(dev('PC-A')), pb = hostPort(dev('PC-B'));
          return !!(pa && pb && pa.apipa && pb.apipa && ip.sameSubnet(pa.ip, pb.ip, 16));
        }
      },
      {
        id: 'apipa-ping',
        title: 'Ping across the link-local segment',
        detail: 'Ping PC-A → PC-B. APIPA allows same-link communication without a router or DHCP server.',
        run: { from: 'PC-A', to: 'PC-B' },
        check() { return pingOk('PC-A', 'PC-B'); }
      },
      {
        id: 'srv-ip',
        title: 'Give the Server an address on the same link',
        detail: 'For a UDP demo, configure Server as 169.254.10.10/16 so it shares the APIPA subnet.',
        focus: 'Server',
        apply() {
          const s = dev('Server'); if (!s) return 'Server missing.';
          setPort(s, 'eth0', '169.254.10.10', 16, '');
          const p = hostPort(s); if (p) { p.dhcp = false; p.apipa = false; p.lease = null; }
          return 'Server is 169.254.10.10/16.';
        },
        check() {
          const p = hostPort(dev('Server'));
          return !!(isValidHost(p) && ip.network(p.ip, 16) === '169.254.0.0');
        }
      },
      {
        id: 'udp',
        title: 'Send a UDP datagram',
        detail: 'Send a UDP datagram from PC-A to Server (e.g. a DNS-style query on port 53). Notice: no handshake, no reply required — "fire and forget".',
        focus: 'PC-A',
        run: { type: 'udp', from: 'PC-A', to: 'Server', port: 53, app: 'DNS query', label: 'Send UDP' },
        check() {
          return !!(NL.flags && NL.flags.udp && Object.keys(NL.flags.udp).length);
        }
      }
    ]
  };

  // ---------------- lab 6: VLANs & 802.1Q ----------------
  const vlanLab = {
    id: 'vlan',
    name: '6 · VLANs & 802.1Q',
    kicker: 'Lab 6 · Segmentation',
    title: 'Splitting one switch into virtual LANs',
    intro: 'VLANs (802.1Q) separate devices at Layer 2 even when they share the same physical switch. Access ports belong to one VLAN; trunk ports carry multiple VLANs tagged with a VLAN ID. Devices in different VLANs cannot reach each other without a router (inter-VLAN routing).',
    chips: ['802.1Q', 'VLAN', 'Access/Trunk'],
    tip: 'If two PCs are in different VLANs, their frames never reach each other on the switch — even if their IPs look "right". This is a common real-world isolation and security tool.',
    build(pos) {
      const a = M.addDevice('pc', Object.assign({ name: 'PC-A' }, pos(0.08, 0.22)));
      const b = M.addDevice('pc', Object.assign({ name: 'PC-B' }, pos(0.08, 0.52)));
      const c = M.addDevice('pc', Object.assign({ name: 'PC-C' }, pos(0.08, 0.78)));
      const sw = M.addDevice('switch', Object.assign({ name: 'SW1' }, pos(0.45, 0.50)));
      link(a, 'eth0', sw, 'Fa0/1');
      link(b, 'eth0', sw, 'Fa0/2');
      link(c, 'eth0', sw, 'Fa0/3');
    },
    tasks: [
      {
        id: 'ips',
        title: 'Put all PCs on the same IP subnet',
        detail: 'Give PC-A 192.168.10.10/24, PC-B 192.168.10.20/24, PC-C 192.168.10.30/24. Same subnet — but VLANs can still separate them.',
        focus: 'PC-A',
        apply() {
          const a = dev('PC-A'), b = dev('PC-B'), c = dev('PC-C');
          if (!a||!b||!c) return 'Missing PC.';
          setPort(a,'eth0','192.168.10.10',24,'');
          setPort(b,'eth0','192.168.10.20',24,'');
          setPort(c,'eth0','192.168.10.30',24,'');
          return 'All PCs are in 192.168.10.0/24.';
        },
        check() {
          return ['PC-A','PC-B','PC-C'].every(n => isValidHost(hostPort(dev(n))));
        }
      },
      {
        id: 'vlan-ports',
        title: 'Assign access VLANs on SW1',
        detail: 'Open SW1 and set Fa0/1 (PC-A) and Fa0/2 (PC-B) to Access VLAN 10, and Fa0/3 (PC-C) to Access VLAN 20. This creates two isolated broadcast domains on one switch.',
        focus: 'SW1',
        apply() {
          const sw = dev('SW1'); if (!sw) return 'SW1 missing.';
          const p1 = portNamed(sw,'Fa0/1'), p2 = portNamed(sw,'Fa0/2'), p3 = portNamed(sw,'Fa0/3');
          if (p1) { p1.mode='access'; p1.vlan=10; }
          if (p2) { p2.mode='access'; p2.vlan=10; }
          if (p3) { p3.mode='access'; p3.vlan=20; }
          return 'Fa0/1,Fa0/2 → VLAN 10 (access). Fa0/3 → VLAN 20 (access).';
        },
        check() {
          const sw = dev('SW1'); if (!sw) return false;
          const p1 = portNamed(sw,'Fa0/1'), p2 = portNamed(sw,'Fa0/2'), p3 = portNamed(sw,'Fa0/3');
          return !!(p1 && p2 && p3 && p1.vlan===10 && p2.vlan===10 && p3.vlan===20 && p1.mode==='access' && p2.mode==='access' && p3.mode==='access');
        }
      },
      {
        id: 'same-vlan',
        title: 'Ping within the same VLAN',
        detail: 'Ping PC-A → PC-B. Both are in VLAN 10, so the switch forwards frames between them normally.',
        run: { from: 'PC-A', to: 'PC-B' },
        check() { return pingOk('PC-A', 'PC-B'); }
      },
      {
        id: 'diff-vlan',
        title: 'Try to ping across VLANs (it should fail)',
        detail: 'Ping PC-A (VLAN 10) → PC-C (VLAN 20). Even on the same IP subnet, 802.1Q isolation blocks the frame at Layer 2. Read the failure in the log.',
        run: { from: 'PC-A', to: 'PC-C', label: 'Ping A → C' },
        check() {
          const last = lastPing('PC-A', 'PC-C');
          return !!(last && !last.ok);
        }
      }
    ]
  };

  // ---------------- lab 7: Wi-Fi & AAA / 802.1X ----------------
  const wifiSecurityLab = {
    id: 'wifi-sec',
    name: '7 · Wi-Fi, 802.1X & AAA',
    kicker: 'Lab 7 · Wireless & access control',
    title: 'Connecting securely and proving identity',
    intro: 'Wi-Fi (802.11) clients associate with an access point and secure traffic with WPA2 handshakes. Enterprise networks authenticate users/devices with 802.1X (port-based access control) and central AAA servers using RADIUS or TACACS+.',
    chips: ['802.11/WPA2', '802.1X', 'RADIUS', 'TACACS+'],
    tip: '802.1X blocks network access until authentication succeeds. RADIUS commonly carries network access AAA (often with 802.1X), while TACACS+ is popular for granular device administration control.',
    build(pos) {
      const wifi = M.addDevice('wifi', Object.assign({ name: 'WiFi-Client' }, pos(0.08, 0.30)));
      const ap = M.addDevice('ap', Object.assign({ name: 'AP-1' }, pos(0.33, 0.30)));
      const sw = M.addDevice('switch', Object.assign({ name: 'SW1' }, pos(0.55, 0.30)));
      const srv = M.addDevice('server', Object.assign({ name: 'AAA-Server' }, pos(0.80, 0.18)));
      const admin = M.addDevice('pc', Object.assign({ name: 'Admin-PC' }, pos(0.80, 0.52)));
      link(wifi, 'eth0', ap, 'eth0');
      link(ap, 'eth1', sw, 'Fa0/1');
      link(sw, 'Fa0/2', srv, 'eth0');
      link(sw, 'Fa0/3', admin, 'eth0');
    },
    tasks: [
      {
        id: 'ips',
        title: 'Address the clients and AAA server',
        detail: 'WiFi-Client: 10.10.1.20/24. AAA-Server: 10.10.1.10/24. Admin-PC: 10.10.1.30/24. (AP bridges at Layer 2 in this simplified model.)',
        focus: 'WiFi-Client',
        apply() {
          const w = dev('WiFi-Client'), s = dev('AAA-Server'), a = dev('Admin-PC');
          if (!w||!s||!a) return 'Missing device.';
          setPort(w,'eth0','10.10.1.20',24,'');
          setPort(s,'eth0','10.10.1.10',24,'');
          setPort(a,'eth0','10.10.1.30',24,'');
          return 'WiFi-Client 10.10.1.20, AAA-Server 10.10.1.10, Admin-PC 10.10.1.30 (/24).';
        },
        check() {
          return ['WiFi-Client','AAA-Server','Admin-PC'].every(n => isValidHost(hostPort(dev(n))));
        }
      },
      {
        id: 'wifi',
        title: 'Run the Wi-Fi association & WPA2 handshake demo',
        detail: 'Watch beacons/probe, authentication/association, the WPA2 4-way handshake, and encrypted data frames. (Simplified teaching sequence.)',
        focus: 'WiFi-Client',
        run: { type: 'demo', demo: 'wifi', from: 'WiFi-Client', to: 'AP-1', label: 'Wi-Fi/WPA2' },
        check() {
          return !!(NL.flags && NL.flags.demos && NL.flags.demos['Wi-Fi association & WPA2']);
        }
      },
      {
        id: 'dot1x',
        title: 'Run the 802.1X port authentication demo',
        detail: '802.1X uses EAPOL/EAP to authenticate a supplicant before allowing network access (port moves to authorized).',
        focus: 'WiFi-Client',
        run: { type: 'demo', demo: 'dot1x', from: 'WiFi-Client', to: 'AP-1', label: '802.1X' },
        check() {
          return !!(NL.flags && NL.flags.demos && NL.flags.demos['802.1X port authentication']);
        }
      },
      {
        id: 'radius',
        title: 'Run the RADIUS authentication demo',
        detail: 'RADIUS provides centralized AAA over UDP (Access-Request/Challenge/Accept). Commonly used with 802.1X and network access.',
        focus: 'AAA-Server',
        run: { type: 'demo', demo: 'radius', from: 'AP-1', to: 'AAA-Server', label: 'RADIUS' },
        check() {
          return !!(NL.flags && NL.flags.demos && NL.flags.demos['RADIUS authentication']);
        }
      },
      {
        id: 'tacacs',
        title: 'Run the TACACS+ authentication demo',
        detail: 'TACACS+ separates AAA, runs over TCP, and encrypts the full payload — often used for network device admin access control.',
        focus: 'Admin-PC',
        run: { type: 'demo', demo: 'tacacs', from: 'Admin-PC', to: 'AAA-Server', label: 'TACACS+' },
        check() {
          return !!(NL.flags && NL.flags.demos && NL.flags.demos['TACACS+ authentication']);
        }
      }
    ]
  };

  // ---------------- lab 8: Dynamic routing protocols ----------------
  const routingLab = {
    id: 'routing-proto',
    name: '8 · Dynamic routing: OSPF, EIGRP, BGP, IS-IS',
    kicker: 'Lab 8 · Routing protocols',
    title: 'Let routers learn routes automatically',
    intro: 'Instead of typing static routes, dynamic routing protocols let routers exchange reachability information and converge on paths. This lab shows simplified views of OSPF (link-state), EIGRP (advanced distance-vector), IS-IS (link-state), and BGP (path-vector between autonomous systems).',
    chips: ['OSPF', 'EIGRP', 'BGP', 'IS-IS'],
    tip: 'Static routes are simple but manual. Dynamic protocols adapt to topology changes. OSPF/IS-IS build a map (SPF), EIGRP uses metrics/feasible successors, and BGP chooses paths using attributes like AS_PATH.',
    build(pos) {
      const a = M.addDevice('pc', Object.assign({ name: 'PC-A' }, pos(0.04, 0.42)));
      const r1 = M.addDevice('router', Object.assign({ name: 'R1' }, pos(0.28, 0.42)));
      const r2 = M.addDevice('router', Object.assign({ name: 'R2' }, pos(0.52, 0.42)));
      const r3 = M.addDevice('router', Object.assign({ name: 'R3' }, pos(0.72, 0.42)));
      const b = M.addDevice('pc', Object.assign({ name: 'PC-B' }, pos(0.92, 0.42)));
      link(a, 'eth0', r1, 'Gi0/0');
      link(r1, 'Gi0/1', r2, 'Gi0/0');
      link(r2, 'Gi0/1', r3, 'Gi0/0');
      link(r3, 'Gi0/1', b, 'eth0');
    },
    tasks: [
      {
        id: 'addr',
        title: 'Address routers and hosts',
        detail: 'PC-A 10.0.0.10/24 gw 10.0.0.1. R1 10.0.0.1/24 & 10.0.1.1/24. R2 10.0.1.2/24 & 10.0.2.1/24. R3 10.0.2.2/24 & 10.0.3.1/24. PC-B 10.0.3.10/24 gw 10.0.3.1.',
        focus: 'R1',
        apply() {
          const A=dev('PC-A'),B=dev('PC-B'),R1=dev('R1'),R2=dev('R2'),R3=dev('R3');
          if(!A||!B||!R1||!R2||!R3) return 'Missing device.';
          setPort(A,'eth0','10.0.0.10',24,'10.0.0.1');
          setPort(R1,'Gi0/0','10.0.0.1',24,''); setPort(R1,'Gi0/1','10.0.1.1',24,'');
          setPort(R2,'Gi0/0','10.0.1.2',24,''); setPort(R2,'Gi0/1','10.0.2.1',24,'');
          setPort(R3,'Gi0/0','10.0.2.2',24,''); setPort(R3,'Gi0/1','10.0.3.1',24,'');
          setPort(B,'eth0','10.0.3.10',24,'10.0.3.1');
          return 'All interfaces and gateways configured.';
        },
        check() {
          const r1=dev('R1'),r2=dev('R2'),r3=dev('R3');
          return hostGatewayOk('PC-A','R1') && hostGatewayOk('PC-B','R3') && r1 && r2 && r3 && configuredPorts(r1).length>=2 && configuredPorts(r2).length>=2 && configuredPorts(r3).length>=2;
        }
      },
      {
        id: 'ospf',
        title: 'Run OSPF convergence (link-state)',
        detail: 'Run OSPF to exchange LSAs and compute shortest paths. Check router tables for routes learned via ospf, then clear dynamic routes before trying the next protocol.',
        focus: 'R1',
        run: { type: 'routing', protocol: 'ospf', label: 'Run OSPF' },
        check() {
          return !!(NL.flags && NL.flags.routing && NL.flags.routing.ospf);
        }
      },
      {
        id: 'eigrp',
        title: 'Run EIGRP convergence (advanced distance-vector)',
        detail: 'Clear learned routes if needed, then run EIGRP. Neighbors exchange updates with composite metrics (bandwidth/delay in real networks).',
        focus: 'R2',
        run: { type: 'routing', protocol: 'eigrp', label: 'Run EIGRP' },
        check() {
          return !!(NL.flags && NL.flags.routing && NL.flags.routing.eigrp);
        }
      },
      {
        id: 'bgp',
        title: 'Run BGP convergence (path-vector)',
        detail: 'Run BGP. Peers establish a session (OPEN) and exchange UPDATEs advertising prefixes with AS path attributes — used between autonomous systems on the internet.',
        focus: 'R2',
        run: { type: 'routing', protocol: 'bgp', label: 'Run BGP' },
        check() {
          return !!(NL.flags && NL.flags.routing && NL.flags.routing.bgp);
        }
      },
      {
        id: 'isis',
        title: 'Run IS-IS convergence (link-state)',
        detail: 'Run IS-IS. Routers exchange LSPs and compute shortest paths (similar to OSPF, but IS-IS runs at Layer 2 and is common in service provider networks).',
        focus: 'R3',
        run: { type: 'routing', protocol: 'isis', label: 'Run IS-IS' },
        check() {
          return !!(NL.flags && NL.flags.routing && NL.flags.routing.isis);
        }
      },
      {
        id: 'ping',
        title: 'Ping end-to-end using learned routes',
        detail: 'With dynamic routes installed (from the last protocol you ran), ping PC-A → PC-B. Routers forward using learned next hops instead of static entries.',
        run: { from: 'PC-A', to: 'PC-B' },
        check() {
          const last = lastPing('PC-A', 'PC-B');
          return !!(pingOk('PC-A', 'PC-B') && last && last.hops >= 3);
        }
      }
    ]
  };

  // ---------------- lab 9: TLS & IPsec ----------------
  const secureLab = {
    id: 'secure',
    name: '9 · TLS & IPsec',
    kicker: 'Lab 9 · Security protocols',
    title: 'Protecting data in transit',
    intro: 'Security protocols protect confidentiality, integrity, and authenticity. TLS secures application traffic (like HTTPS) with a handshake and session keys. IPsec secures IP packets themselves (often for VPNs) using IKE to negotiate and ESP to encrypt/encapsulate.',
    chips: ['TLS', 'IPsec', 'IKE/ESP'],
    tip: 'TLS usually protects a specific application connection end-to-end. IPsec can protect all IP traffic between gateways/hosts (tunnel mode) or host-to-host (transport mode).',
    build(pos) {
      const client = M.addDevice('pc', Object.assign({ name: 'Client' }, pos(0.12, 0.36)));
      const sw = M.addDevice('switch', Object.assign({ name: 'SW1' }, pos(0.40, 0.36)));
      const gw = M.addDevice('router', Object.assign({ name: 'VPN-GW' }, pos(0.64, 0.36)));
      const web = M.addDevice('server', Object.assign({ name: 'Web-Server' }, pos(0.86, 0.36)));
      link(client,'eth0',sw,'Fa0/1');
      link(sw,'Fa0/2',gw,'Gi0/0');
      link(gw,'Gi0/1',web,'eth0');
    },
    tasks: [
      {
        id: 'ips',
        title: 'Address the endpoints and gateway',
        detail: 'Client 172.16.1.10/24 gw 172.16.1.1. VPN-GW 172.16.1.1/24 & 172.16.2.1/24. Web-Server 172.16.2.10/24 gw 172.16.2.1.',
        focus: 'Client',
        apply() {
          const c=dev('Client'), g=dev('VPN-GW'), w=dev('Web-Server');
          if(!c||!g||!w) return 'Missing device.';
          setPort(c,'eth0','172.16.1.10',24,'172.16.1.1');
          setPort(g,'Gi0/0','172.16.1.1',24,''); setPort(g,'Gi0/1','172.16.2.1',24,'');
          setPort(w,'eth0','172.16.2.10',24,'172.16.2.1');
          return 'Client, VPN-GW, and Web-Server configured.';
        },
        check() {
          return hostGatewayOk('Client','VPN-GW') && hostGatewayOk('Web-Server','VPN-GW');
        }
      },
      {
        id: 'tls',
        title: 'Run the TLS handshake demo',
        detail: 'Client and Web-Server perform a TLS handshake (ClientHello/ServerHello/certificate, key exchange, finished) before sending encrypted application data.',
        focus: 'Client',
        run: { type: 'demo', demo: 'tls', from: 'Client', to: 'Web-Server', label: 'TLS handshake' },
        check() {
          return !!(NL.flags && NL.flags.demos && NL.flags.demos['TLS handshake']);
        }
      },
      {
        id: 'ipsec',
        title: 'Run the IPsec (IKE/ESP) demo',
        detail: 'Peers negotiate IKE security associations and then protect packets with ESP (encryption/integrity) — the basis of many VPNs.',
        focus: 'VPN-GW',
        run: { type: 'demo', demo: 'ipsec', from: 'VPN-GW', to: 'Web-Server', label: 'IPsec IKE/ESP' },
        check() {
          return !!(NL.flags && NL.flags.demos && NL.flags.demos['IPsec IKE & ESP']);
        }
      },
      {
        id: 'ping',
        title: 'Verify connectivity across the gateway',
        detail: 'Ping Client → Web-Server. Under the hood, real deployments could wrap this traffic in TLS or IPsec for protection.',
        run: { from: 'Client', to: 'Web-Server' },
        check() { return pingOk('Client', 'Web-Server'); }
      }
    ]
  };

  // ---------------- lab 10: DNS, NAT, ACLs & traceroute ----------------
  const servicesLab = {
    id: 'services',
    name: '10 · DNS, NAT, ACLs & traceroute',
    kicker: 'Lab 10 · Network+ services',
    title: 'Names, translation, filtering and the path',
    intro: 'Real networks lean on services beyond ping. DNS turns names into addresses, NAT/PAT lets private hosts share a public address, ACLs/firewalls filter traffic, and traceroute reveals the path hop by hop. This lab wires a small network and walks through each idea.',
    chips: ['DNS', 'NAT/PAT', 'ACL', 'Traceroute', 'Ports'],
    tip: 'DNS answers “what IP is this name?”. NAT rewrites addresses at a boundary. ACLs decide permit/deny. Traceroute exploits TTL: each router that discards an expired probe reports back, revealing itself. Common ports to remember: 80/443 web, 22 SSH, 21 FTP, 25 SMTP, 53 DNS, 123 NTP, 161 SNMP, 514 Syslog.',
    build(pos) {
      const a = M.addDevice('pc', Object.assign({ name: 'PC-A' }, pos(0.04, 0.34)));
      const sw1 = M.addDevice('switch', Object.assign({ name: 'SW1' }, pos(0.24, 0.34)));
      const dns = M.addDevice('server', Object.assign({ name: 'DNS-Server' }, pos(0.24, 0.68)));
      const r = M.addDevice('router', Object.assign({ name: 'R1' }, pos(0.50, 0.34)));
      const sw2 = M.addDevice('switch', Object.assign({ name: 'SW2' }, pos(0.72, 0.34)));
      const srv = M.addDevice('server', Object.assign({ name: 'Web-Server' }, pos(0.91, 0.34)));
      link(a, 'eth0', sw1, 'Fa0/1');
      link(dns, 'eth0', sw1, 'Fa0/2');
      link(sw1, 'Fa0/3', r, 'Gi0/0');
      link(r, 'Gi0/1', sw2, 'Fa0/1');
      link(sw2, 'Fa0/2', srv, 'eth0');
    },
    tasks: [
      {
        id: 'addr',
        title: 'Address hosts, servers and the router',
        detail: 'PC-A 192.168.1.10/24 gw 192.168.1.1. DNS-Server 192.168.1.5/24 gw 192.168.1.1. R1 192.168.1.1/24 & 192.168.2.1/24. Web-Server 192.168.2.10/24 gw 192.168.2.1.',
        focus: 'R1',
        apply() {
          const A=dev('PC-A'),D=dev('DNS-Server'),R=dev('R1'),W=dev('Web-Server');
          if(!A||!D||!R||!W) return 'Missing device.';
          setPort(A,'eth0','192.168.1.10',24,'192.168.1.1');
          setPort(D,'eth0','192.168.1.5',24,'192.168.1.1');
          setPort(R,'Gi0/0','192.168.1.1',24,''); setPort(R,'Gi0/1','192.168.2.1',24,'');
          setPort(W,'eth0','192.168.2.10',24,'192.168.2.1');
          return 'All addresses and gateways configured.';
        },
        check() {
          return hostGatewayOk('PC-A','R1') && hostGatewayOk('DNS-Server','R1') && hostGatewayOk('Web-Server','R1') &&
            configuredPorts(dev('R1')).length >= 2;
        }
      },
      {
        id: 'dns-record',
        title: 'Run a DNS server with an A record',
        detail: 'Open DNS-Server and add an A record: web.local → 192.168.2.10. DNS servers answer name queries with address records (UDP/TCP 53).',
        focus: 'DNS-Server',
        apply() {
          const d = dev('DNS-Server'); if (!d) return 'DNS-Server missing.';
          d.dns = { enabled: true, records: [{ name: 'web.local', ip: '192.168.2.10' }] };
          if (d.services) d.services.dns = true;
          return 'DNS-Server hosts web.local → 192.168.2.10.';
        },
        check() {
          const d = dev('DNS-Server');
          return !!(d && d.dns && d.dns.enabled && Array.isArray(d.dns.records) &&
            d.dns.records.some(r => r.name === 'web.local' && r.ip === '192.168.2.10'));
        }
      },
      {
        id: 'dns-resolve',
        title: 'Resolve the name from PC-A',
        detail: 'Select PC-A and press Resolve in the DNS section (query web.local). Watch the DNS query and response; the app then knows the IP behind the name.',
        focus: 'PC-A',
        run: { type: 'dns', device: 'PC-A', name: 'web.local' },
        check() {
          const a = dev('PC-A');
          return !!(a && NL.flags && NL.flags.dns && NL.flags.dns[a.id + '>web.local']);
        }
      },
      {
        id: 'services',
        title: 'Turn on common services on Web-Server',
        detail: 'Open Web-Server and enable HTTP (80) and HTTPS (443) under Services. Ports identify which application should receive traffic.',
        focus: 'Web-Server',
        apply() {
          const w = dev('Web-Server'); if (!w) return 'Web-Server missing.';
          if (!w.services) w.services = {};
          w.services.http = true; w.services.https = true;
          return 'Web-Server now offers HTTP 80 and HTTPS 443.';
        },
        check() {
          const w = dev('Web-Server');
          return !!(w && w.services && w.services.http && w.services.https);
        }
      },
      {
        id: 'nat',
        title: 'Enable NAT/PAT on R1',
        detail: 'Open R1, enable NAT, choose PAT, set the inside network 192.168.1.0/24 and an outside IP like 203.0.113.1. Traffic leaving the private LAN is translated.',
        focus: 'R1',
        apply() {
          const r = dev('R1'); if (!r) return 'R1 missing.';
          r.nat = { enabled: true, mode: 'pat', inside: '192.168.1.0/24', outside: '203.0.113.1', statics: [], translations: [] };
          return 'R1: NAT/PAT enabled (192.168.1.0/24 → 203.0.113.1).';
        },
        check() {
          const r = dev('R1');
          return !!(r && r.nat && r.nat.enabled);
        }
      },
      {
        id: 'acl-block',
        title: 'Block ICMP with an ACL rule',
        detail: 'On R1, enable the ACL and add: deny icmp any → 192.168.2.10. ACLs/firewalls permit or deny traffic by matching criteria.',
        focus: 'R1',
        apply() {
          const r = dev('R1'); if (!r) return 'R1 missing.';
          r.acl = { enabled: true, rules: [{ action: 'deny', proto: 'icmp', src: 'any', dst: '192.168.2.10' }] };
          NL.flags.aclDenyAdded = true;
          return 'R1 ACL: deny icmp from any to 192.168.2.10.';
        },
        check() {
          return !!(NL.flags && NL.flags.aclDenyAdded);
        }
      },
      {
        id: 'acl-test',
        title: 'See the ACL block a ping',
        detail: 'Ping PC-A → Web-Server. R1 should drop the ICMP request because the deny rule matches. The log explains which rule blocked it.',
        run: { from: 'PC-A', to: 'Web-Server' },
        check() {
          return !!(NL.flags && NL.flags.aclDenied);
        }
      },
      {
        id: 'permit',
        title: 'Permit traffic again and verify',
        detail: 'Remove or replace the deny rule with a permit rule, then ping again. Rules are evaluated top-down; the first match wins.',
        focus: 'R1',
        apply() {
          const r = dev('R1'); if (!r) return 'R1 missing.';
          r.acl = { enabled: true, rules: [{ action: 'permit', proto: 'icmp', src: 'any', dst: '192.168.2.10' }] };
          NL.flags.aclPermitAdded = true;
          return 'R1 ACL now permits ICMP to 192.168.2.10.';
        },
        check() {
          return !!(NL.flags && NL.flags.aclPermitAdded);
        }
      },
      {
        id: 'trace',
        title: 'Traceroute to discover the path',
        detail: 'Select PC-A and press Traceroute. Probes with increasing TTL reveal R1 (ICMP Time Exceeded) and then the destination.',
        focus: 'PC-A',
        run: { type: 'trace', from: 'PC-A', to: 'Web-Server' },
        check() {
          const a = dev('PC-A'), b = dev('Web-Server');
          return !!(a && b && NL.flags && NL.flags.traces && NL.flags.traces[a.id + '>' + b.id]);
        }
      },
      {
        id: 'ping',
        title: 'Confirm end-to-end connectivity',
        detail: 'Ping PC-A → Web-Server once more. DNS, NAT, services, ACLs and routing all coexist on this small network.',
        run: { from: 'PC-A', to: 'Web-Server' },
        check() { return pingOk('PC-A', 'Web-Server'); }
      }
    ]
  };

  // ---------------- sandbox ----------------
  const sandboxLab = {
    id: 'sandbox',
    name: '11 · Free-play sandbox',
    kicker: 'Sandbox · Anything goes',
    title: 'Your own network',
    intro: 'An empty canvas and a box of parts. Build whatever you like, then test it with pings, DHCP, UDP, VLANs, routing protocols, and security demos. The checklist below tracks a few useful milestones.',
    chips: ['Open-ended', 'Experiment', 'Break things'],
    tip: 'Try combining ideas: separate VLANs on a switch, run OSPF between routers, use APIPA when DHCP is missing, or walk through TLS/802.1X/RADIUS flows in the Protocol demos panel.',
    build() { /* intentionally empty */ },
    tasks: [
      {
        id: 'connect',
        title: 'Connect two devices',
        detail: 'Add devices from the left palette and use the Cable tool to wire them together.',
        check() { return M.state.devices.length >= 2 && M.state.links.length >= 1; }
      },
      {
        id: 'subnet',
        title: 'Put two hosts in the same subnet',
        detail: 'Give two PCs or servers addresses that share the same network portion.',
        check() { return hostsInSameSubnet(); }
      },
      {
        id: 'ping',
        title: 'Get a successful ping',
        detail: 'Use the Ping tool: click the source, then the destination.',
        check() { return anyPingOk(); }
      },
      {
        id: 'routed',
        title: 'Send a packet through a router',
        detail: 'Two subnets, a router with an address on each, and matching default gateways. The log should show a routed ICMP request.',
        check() { return !!NL.flags.routed; }
      },
      {
        id: 'dhcp',
        title: 'Get an address from DHCP',
        detail: 'Add a Server (or use a router), give it an address and a pool, then set a PC to Automatic and press Get an address.',
        check() { return anyDhcpLease(); }
      },
      {
        id: 'apipa',
        title: 'Use an APIPA (169.254/16) address',
        detail: 'Set a host to Automatic and use APIPA to self-assign a link-local address when no DHCP server is available.',
        check() {
          return M.state.devices.some(d => d.ports && d.ports.some(p => p.apipa && ip.valid(p.ip) && ip.network(p.ip,16)==='169.254.0.0'));
        }
      },
      {
        id: 'udp',
        title: 'Send a UDP datagram',
        detail: 'Use the UDP action in Protocol demos (on a host) to send a connectionless datagram.',
        check() {
          return !!(NL.flags && NL.flags.udp && Object.keys(NL.flags.udp).length);
        }
      },
      {
        id: 'dynamic',
        title: 'Learn routes dynamically (OSPF/EIGRP/BGP/IS-IS)',
        detail: 'Run a dynamic routing protocol on routers to install learned routes.',
        check() {
          return M.state.devices.some(d => d.dynamicRoutes && d.dynamicRoutes.length);
        }
      },
      {
        id: 'demo',
        title: 'Run a security/Wi-Fi protocol demo',
        detail: 'Run any of TLS, IPsec, RADIUS, TACACS+, 802.1X, Wi-Fi/WPA2, or WPA3 from the Protocol demos panel.',
        check() {
          return !!(NL.flags && NL.flags.demos && Object.keys(NL.flags.demos).length);
        }
      },
      {
        id: 'dns',
        title: 'Resolve a name with DNS',
        detail: 'Add an A record on a server with DNS enabled, then use Resolve in a host’s DNS section.',
        check() {
          return !!(NL.flags && NL.flags.dns && Object.keys(NL.flags.dns).length);
        }
      },
      {
        id: 'trace',
        title: 'Run a traceroute',
        detail: 'Select a host and press Traceroute to reveal the router hops along the path.',
        check() {
          return !!(NL.flags && NL.flags.traces && Object.keys(NL.flags.traces).length);
        }
      },
      {
        id: 'acl-nat',
        title: 'Configure NAT or an ACL on a router',
        detail: 'Open a router and enable NAT/PAT or an ACL rule under the Network+ sections.',
        check() {
          return M.state.devices.some(d => (d.nat && d.nat.enabled) || (d.acl && d.acl.enabled && d.acl.rules && d.acl.rules.length));
        }
      }
    ]
  };

  const labs = [lanLab, gatewayLab, staticLab, dhcpLab, apipaUdpLab, vlanLab, wifiSecurityLab, routingLab, secureLab, servicesLab, sandboxLab];

  function get(id) { return labs.find(l => l.id === id) || null; }
  function indexOf(id) {
    const i = labs.findIndex(l => l.id === id);
    return i < 0 ? 0 : i;
  }

  NL.missions = {
    labs, get, indexOf,
    helpers: {
      dev, hostPort, portNamed, isValidHost, setPort,
      configuredPorts, distinctSubnets, hostGatewayOk,
      staticRouteCovers, pingOk, lastPing,
      deviceHasDhcpLease, dhcpClientOk, dhcpServerOk, anyDhcpLease
    }
  };
})();
