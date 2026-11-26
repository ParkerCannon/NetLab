/* NetLab core — IP helpers, device model, and the packet simulator. */
window.NL = window.NL || {};
(function () {
  'use strict';
  const NL = window.NL;

  // ================= IP helpers =================
  const ip = {};

  ip.toInt = function (str) {
    if (typeof str !== 'string') return null;
    const parts = str.trim().split('.');
    if (parts.length !== 4) return null;
    let n = 0;
    for (const part of parts) {
      if (!/^\d{1,3}$/.test(part)) return null;
      const v = Number(part);
      if (v > 255) return null;
      n = n * 256 + v;
    }
    return n >>> 0;
  };

  ip.fromInt = function (n) {
    n = n >>> 0;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  };

  ip.maskInt = function (prefix) {
    if (prefix <= 0) return 0;
    if (prefix >= 32) return 0xffffffff;
    return (0xffffffff << (32 - prefix)) >>> 0;
  };

  ip.mask = function (prefix) { return ip.fromInt(ip.maskInt(prefix)); };

  ip.netInt = function (ipInt, prefix) {
    return (ipInt & ip.maskInt(prefix)) >>> 0;
  };

  ip.network = function (addr, prefix) {
    const n = ip.toInt(addr);
    if (n === null) return null;
    return ip.fromInt(ip.netInt(n, prefix));
  };

  ip.broadcast = function (addr, prefix) {
    const n = ip.toInt(addr);
    if (n === null) return null;
    return ip.fromInt((ip.netInt(n, prefix) | (~ip.maskInt(prefix) >>> 0)) >>> 0);
  };

  ip.sameSubnet = function (a, b, prefix) {
    const na = ip.toInt(a), nb = ip.toInt(b);
    if (na === null || nb === null) return false;
    return ip.netInt(na, prefix) === ip.netInt(nb, prefix);
  };

  ip.inSubnet = function (addr, network, prefix) {
    const n = ip.toInt(addr);
    if (n === null) return false;
    return ip.netInt(n, prefix) === ip.netInt(ip.toInt(network) || 0, prefix);
  };

  ip.valid = function (addr) { return ip.toInt(addr) !== null; };

  ip.isNetworkOrBroadcast = function (addr, prefix) {
    const n = ip.toInt(addr);
    if (n === null) return true;
    if (prefix >= 31) return false;
    return n === ip.netInt(n, prefix) || n === (ip.netInt(n, prefix) | (~ip.maskInt(prefix) >>> 0)) >>> 0;
  };

  ip.hostCount = function (prefix) {
    if (prefix >= 31) return prefix === 32 ? 1 : 2;
    return Math.max(0, Math.pow(2, 32 - prefix) - 2);
  };

  ip.parseCidr = function (str) {
    if (typeof str !== 'string') return null;
    const m = str.trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})\s*\/\s*(\d{1,2})$/);
    if (!m) return null;
    const addr = m[1], prefix = Number(m[2]);
    if (!ip.valid(addr) || prefix < 0 || prefix > 32) return null;
    return { ip: addr, prefix, network: ip.network(addr, prefix) };
  };

  NL.ip = ip;

  // ================= device model =================
  const TYPES = {
    pc: { label: 'PC', icon: 'pc', ports: 1, name: 'PC' },
    server: { label: 'Server', icon: 'server', ports: 1, name: 'Server' },
    switch: { label: 'Switch', icon: 'switch', ports: 8, name: 'Switch' },
    router: { label: 'Router', icon: 'router', ports: 4, name: 'Router' },
    hub: { label: 'Hub', icon: 'hub', ports: 4, name: 'Hub' },
    ap: { label: 'Wi-Fi AP', icon: 'router', ports: 2, name: 'AP' },
    wifi: { label: 'Wi-Fi Client', icon: 'pc', ports: 1, name: 'WiFi' }
  };

  const state = {
    devices: [],
    links: [],
    lessonId: 'lan'
  };

  let nextUid = 1;

  function rid(prefix) { return prefix + '-' + (nextUid++); }

  function randomMac() {
    const bytes = [];
    for (let i = 0; i < 6; i++) bytes.push(Math.floor(Math.random() * 256));
    bytes[0] = (bytes[0] & 0xfc) | 0x02;
    return bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(':');
  }

  function portName(type, index) {
    if (type === 'switch') return 'Fa0/' + (index + 1);
    if (type === 'hub') return 'Port ' + (index + 1);
    if (type === 'router') return 'Gi0/' + index;
    return 'eth' + index;
  }

  function uniqueName(base) {
    const used = new Set(state.devices.map(d => d.name));
    let i = 1;
    while (used.has(base + ' ' + i)) i++;
    return base + ' ' + i;
  }

  function createDevice(type, opts) {
    opts = opts || {};
    const info = TYPES[type];
    if (!info) throw new Error('Unknown device type: ' + type);
    const id = rid(type);
    const dev = {
      id,
      type,
      name: opts.name || uniqueName(info.name),
      x: opts.x || 0,
      y: opts.y || 0,
      ports: [],
      arp: {},
      macTable: {},
      staticRoutes: [],
      dynamicRoutes: [],
      routing: { protocol: 'none', asn: 65001, area: 0, routerId: '', network: '' },
      dhcp: { enabled: false, interfaceId: '', poolStart: '', poolEnd: '', gateway: '' },
      dhcpLeases: [],
      wifi: { ssid: 'NetLab', security: 'open', psk: '', connectedTo: '' },
      vlan: { mode: 'access', vlanId: 1, trunkVlans: '1' },
      dns: { enabled: false, records: [] },
      nat: { enabled: false, mode: 'pat', inside: '', outside: '', statics: [] },
      acl: { enabled: false, rules: [] },
      services: { http: false, https: false, ssh: false, ftp: false, smtp: false, dns: false, ntp: false, snmp: false, syslog: false }
    };
    for (let i = 0; i < info.ports; i++) {
      dev.ports.push({
        id: id + ':p' + i,
        name: portName(type, i),
        mac: randomMac(),
        ip: '',
        prefix: 24,
        gateway: '',
        dhcp: false,
        lease: null,
        apipa: false,
        vlan: 1,
        mode: 'access',
        trunkVlans: '1'
      });
    }
    return dev;
  }

  function addDevice(type, opts) {
    const dev = createDevice(type, opts);
    state.devices.push(dev);
    return dev;
  }

  function getDevice(id) { return state.devices.find(d => d.id === id) || null; }
  function getLink(id) { return state.links.find(l => l.id === id) || null; }
  function byName(name) { return state.devices.find(d => d.name === name) || null; }

  function linkForPort(deviceId, portId) {
    return state.links.find(l =>
      (l.a.deviceId === deviceId && l.a.portId === portId) ||
      (l.b.deviceId === deviceId && l.b.portId === portId)
    ) || null;
  }

  function otherEnd(link, deviceId) {
    return link.a.deviceId === deviceId ? link.b : link.a;
  }

  function linksOf(deviceId) {
    return state.links.filter(l => l.a.deviceId === deviceId || l.b.deviceId === deviceId);
  }

  function freePorts(device) {
    return device.ports.filter(p => !linkForPort(device.id, p.id));
  }

  function addLink(aDeviceId, aPortId, bDeviceId, bPortId) {
    if (aDeviceId === bDeviceId) return null;
    if (!getDevice(aDeviceId) || !getDevice(bDeviceId)) return null;
    if (linkForPort(aDeviceId, aPortId) || linkForPort(bDeviceId, bPortId)) return null;
    const link = {
      id: rid('link'),
      a: { deviceId: aDeviceId, portId: aPortId },
      b: { deviceId: bDeviceId, portId: bPortId }
    };
    state.links.push(link);
    return link;
  }

  function removeDevice(id) {
    state.devices = state.devices.filter(d => d.id !== id);
    state.links = state.links.filter(l => l.a.deviceId !== id && l.b.deviceId !== id);
  }

  function removeLink(id) {
    state.links = state.links.filter(l => l.id !== id);
  }

  function clearDeviceData(dev) {
    dev.arp = {};
    dev.macTable = {};
    dev.staticRoutes = [];
    dev.dynamicRoutes = [];
    dev.dhcpLeases = [];
    if (dev.dns) dev.dns.records = [];
    if (dev.nat) dev.nat.translations = [];
    for (const p of dev.ports) {
      p.ip = '';
      p.prefix = 24;
      p.gateway = '';
      p.dhcp = false;
      p.lease = null;
      p.apipa = false;
      p.vlan = 1;
      p.mode = 'access';
      p.trunkVlans = '1';
    }
  }

  function clearL2Data() {
    for (const d of state.devices) {
      d.arp = {};
      d.macTable = {};
    }
  }

  function clearLab() {
    state.devices = [];
    state.links = [];
    nextUid = 1;
  }

  function primaryPort(dev) {
    return dev.ports.find(p => ip.valid(p.ip)) || dev.ports[0] || null;
  }

  function primaryIp(dev) {
    const p = primaryPort(dev);
    return p && ip.valid(p.ip) ? p.ip : '';
  }

  function isL2(dev) { return dev && (dev.type === 'switch' || dev.type === 'hub' || dev.type === 'ap'); }
  function isHost(dev) { return dev && (dev.type === 'pc' || dev.type === 'server' || dev.type === 'wifi'); }

  function configured(dev) {
    if (isL2(dev) && dev.type !== 'ap') return linksOf(dev.id).length > 0;
    if (dev.type === 'ap') return linksOf(dev.id).length > 0 || dev.ports.some(p => ip.valid(p.ip));
    return dev.ports.some(p => ip.valid(p.ip));
  }

  function deviceStatus(dev) {
    if (isL2(dev) && dev.type !== 'ap') return linksOf(dev.id).length > 0 ? 'ok' : 'warn';
    if (dev.type === 'ap') return (linksOf(dev.id).length > 0 || dev.ports.some(p => ip.valid(p.ip))) ? 'ok' : 'warn';
    return dev.ports.some(p => ip.valid(p.ip)) ? 'ok' : 'warn';
  }

  function statusText(dev) {
    if (isL2(dev) && dev.type !== 'ap') {
      const n = linksOf(dev.id).length;
      return n ? n + ' cable' + (n === 1 ? '' : 's') : 'no cables';
    }
    if (dev.type === 'ap') {
      const n = linksOf(dev.id).length;
      const ssid = dev.wifi && dev.wifi.ssid ? dev.wifi.ssid : 'Wi-Fi';
      return ssid + ' · ' + n + ' link' + (n === 1 ? '' : 's');
    }
    const p = primaryPort(dev);
    if (!p || !ip.valid(p.ip)) return 'no IP yet';
    return p.ip + '/' + p.prefix;
  }

  function connectedRoutes(dev) {
    const out = [];
    for (const p of dev.ports) {
      if (!ip.valid(p.ip)) continue;
      out.push({
        network: ip.network(p.ip, p.prefix),
        prefix: p.prefix,
        gateway: '',
        iface: p.name,
        portId: p.id,
        connected: true
      });
    }
    return out;
  }

  function routeIface(dev, gateway) {
    const g = ip.toInt(gateway);
    if (g === null) return '';
    for (const p of dev.ports) {
      if (!ip.valid(p.ip)) continue;
      if (ip.netInt(g, p.prefix) === ip.netInt(ip.toInt(p.ip), p.prefix)) return p.name;
    }
    return '—';
  }

  function routesOf(dev) {
    const list = connectedRoutes(dev);
    for (const r of dev.staticRoutes) {
      list.push({
        network: r.network,
        prefix: r.prefix,
        gateway: r.gateway,
        iface: routeIface(dev, r.gateway),
        connected: false,
        proto: 'static'
      });
    }
    if (Array.isArray(dev.dynamicRoutes)) {
      for (const r of dev.dynamicRoutes) {
        list.push({
          network: r.network,
          prefix: r.prefix,
          gateway: r.gateway,
          iface: routeIface(dev, r.gateway),
          connected: false,
          proto: r.proto || 'dynamic',
          metric: r.metric
        });
      }
    }
    return list;
  }

  function lookupRoute(dev, dstIp) {
    const dest = ip.toInt(dstIp);
    if (dest === null) return null;
    const candidates = [];
    for (const r of routesOf(dev)) {
      const net = ip.toInt(r.network);
      if (net === null) continue;
      if (ip.netInt(dest, r.prefix) === ip.netInt(net, r.prefix)) candidates.push(r);
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      if (b.prefix !== a.prefix) return b.prefix - a.prefix;
      if (a.connected !== b.connected) return a.connected ? -1 : 1;
      // prefer lower metric for dynamic routes
      const am = a.metric == null ? 1e9 : a.metric;
      const bm = b.metric == null ? 1e9 : b.metric;
      return am - bm;
    });
    return candidates[0];
  }

  function egressForGateway(dev, gateway) {
    const g = ip.toInt(gateway);
    if (g === null) return null;
    for (const p of dev.ports) {
      if (!ip.valid(p.ip)) continue;
      if (ip.netInt(g, p.prefix) === ip.netInt(ip.toInt(p.ip), p.prefix)) return p;
    }
    return null;
  }

  function addStaticRoute(dev, network, prefix, gateway) {
    if (!ip.valid(network) || !ip.valid(gateway)) return false;
    if (prefix < 0 || prefix > 32) return false;
    const net = ip.network(network, prefix);
    if (!net) return false;
    if (dev.staticRoutes.some(r => r.network === net && r.prefix === prefix && r.gateway === gateway)) return false;
    dev.staticRoutes.push({ network: net, prefix, gateway });
    return true;
  }

  function removeStaticRoute(dev, index) {
    if (index < 0 || index >= dev.staticRoutes.length) return;
    dev.staticRoutes.splice(index, 1);
  }

  // ================= DHCP =================
  function dhcpCapable(dev) {
    return !!dev && (dev.type === 'server' || dev.type === 'router');
  }

  // Returns null when this device is not a running DHCP server, or an object
  // describing the pool. { ok: false, error } means enabled but misconfigured.
  function dhcpServerInfo(dev) {
    if (!dhcpCapable(dev) || !dev.dhcp || !dev.dhcp.enabled) return null;
    const cfg = dev.dhcp;
    let port = null;
    if (cfg.interfaceId) {
      const chosen = dev.ports.find(p => p.id === cfg.interfaceId);
      if (!chosen) {
        return { ok: false, error: 'Choose the interface this DHCP server should use.' };
      }
      if (!ip.valid(chosen.ip)) {
        return { ok: false, error: chosen.name + ' has no IP address. A DHCP server needs a fixed address on the LAN it serves.' };
      }
      port = chosen;
    } else {
      port = dev.ports.find(p => ip.valid(p.ip)) || null;
    }
    if (!port) {
      return { ok: false, error: dev.name + ' has no IP address yet. A DHCP server needs a fixed address of its own.' };
    }
    if (!ip.valid(cfg.poolStart) || !ip.valid(cfg.poolEnd)) {
      return { ok: false, error: 'Set a pool start and end address on ' + dev.name + '.' };
    }
    const netLabel = ip.network(port.ip, port.prefix) + '/' + port.prefix;
    if (!ip.sameSubnet(cfg.poolStart, port.ip, port.prefix) || !ip.sameSubnet(cfg.poolEnd, port.ip, port.prefix)) {
      return { ok: false, error: 'The pool must sit inside ' + netLabel + ', the subnet on ' + port.name + '.' };
    }
    if (ip.toInt(cfg.poolStart) > ip.toInt(cfg.poolEnd)) {
      return { ok: false, error: 'The pool start must come before the pool end.' };
    }
    let gateway = '';
    if (ip.valid(cfg.gateway)) {
      if (!ip.sameSubnet(cfg.gateway, port.ip, port.prefix)) {
        return { ok: false, error: 'The gateway handed out must live in the same subnet as the pool.' };
      }
      gateway = cfg.gateway;
    } else if (dev.type === 'router') {
      gateway = port.ip;
    }
    return {
      ok: true, server: dev, port, prefix: port.prefix, gateway,
      start: ip.toInt(cfg.poolStart), end: ip.toInt(cfg.poolEnd)
    };
  }

  function leaseIsLive(lease) {
    const client = getDevice(lease.clientId);
    if (!client) return false;
    const port = client.ports.find(p => p.mac === lease.mac);
    return !!(port && port.dhcp);
  }

  function pruneLeases(server) {
    if (!server || !Array.isArray(server.dhcpLeases)) return [];
    server.dhcpLeases = server.dhcpLeases.filter(leaseIsLive);
    return server.dhcpLeases;
  }

  // Pick a free address for a client MAC. Reuses an existing lease for that MAC.
  function allocateLease(server, clientId, clientMac) {
    const info = dhcpServerInfo(server);
    if (!info || !info.ok) return null;
    const leases = pruneLeases(server);
    const existing = leases.find(l => l.mac === clientMac);
    if (existing) {
      const n = ip.toInt(existing.ip);
      const inPool = n !== null && n >= info.start && n <= info.end &&
        ip.sameSubnet(existing.ip, info.port.ip, info.prefix);
      if (inPool) {
        // The pool or gateway may have changed since the last lease.
        existing.prefix = info.prefix;
        existing.gateway = info.gateway;
        existing.serverIp = info.port.ip;
        existing.assignedAt = Date.now();
        return existing;
      }
      // Out of date — drop it so this client does not keep two reservations.
      server.dhcpLeases = server.dhcpLeases.filter(l => l.mac !== clientMac);
    }

    const reserved = new Set(server.dhcpLeases.map(l => l.ip));
    for (let n = info.start; n <= info.end; n++) {
      const addr = ip.fromInt(n);
      if (ip.isNetworkOrBroadcast(addr, info.prefix)) continue;
      if (addr === info.port.ip) continue;
      if (reserved.has(addr)) continue;
      if (findByIp(addr)) continue;
      return {
        ip: addr,
        prefix: info.prefix,
        gateway: info.gateway,
        mac: clientMac,
        clientId,
        serverId: server.id,
        serverIp: info.port.ip,
        assignedAt: Date.now()
      };
    }
    return null;
  }

  // Drop a client's address and remove its reservation from every server.
  function clearLeaseForPort(port) {
    if (!port) return false;
    const had = ip.valid(port.ip);
    port.lease = null;
    port.ip = '';
    port.gateway = '';
    port.apipa = false;
    for (const d of state.devices) {
      if (Array.isArray(d.dhcpLeases)) {
        d.dhcpLeases = d.dhcpLeases.filter(l => l.mac !== port.mac);
      }
    }
    return had;
  }

  // APIPA: 169.254.0.0/16 self-assigned when DHCP fails/unavailable.
  function apipaAssign(port) {
    if (!port) return null;
    // pick a pseudo-random host in 169.254.1.0-169.254.254.255
    const host = 1 + Math.floor(Math.random() * 254);
    const last = 1 + Math.floor(Math.random() * 254);
    const addr = '169.254.' + host + '.' + last;
    port.ip = addr;
    port.prefix = 16;
    port.gateway = '';
    port.lease = null;
    port.apipa = true;
    return addr;
  }

  function releaseLeaseForPort(dev, port) {
    clearLeaseForPort(port);
    // Releasing an address does not stop the client from using DHCP — it just
    // goes back to having no address until it asks again.
    if (port) port.dhcp = true;
  }

  // Remove one lease from a server and blank the matching client.
  function forgetLease(server, mac) {
    if (!server || !Array.isArray(server.dhcpLeases)) return;
    server.dhcpLeases = server.dhcpLeases.filter(l => l.mac !== mac);
    for (const d of state.devices) {
      for (const p of d.ports) {
        if (p.mac === mac && p.lease && p.lease.serverId === server.id) {
          p.lease = null;
          p.ip = '';
          p.gateway = '';
        }
      }
    }
  }

  function leaseOf(dev) {
    if (!dev) return null;
    for (const p of dev.ports) if (p.lease) return p.lease;
    return null;
  }

  // Fill in a beginner-friendly pool for a device, based on its first IP.
  function suggestPool(dev) {
    if (!dhcpCapable(dev) || !dev.dhcp) return false;
    const port = dev.ports.find(p => ip.valid(p.ip));
    if (!port) return false;
    const net = ip.toInt(ip.network(port.ip, port.prefix));
    const bcast = ip.toInt(ip.broadcast(port.ip, port.prefix));
    const first = net + 1;
    const last = bcast - 1;
    let start = Math.min(net + 100, last);
    if (start < first) start = first;
    let end = Math.min(net + 150, last);
    if (end < start) end = start;
    dev.dhcp.interfaceId = port.id;
    dev.dhcp.poolStart = ip.fromInt(start);
    dev.dhcp.poolEnd = ip.fromInt(end);
    if (!ip.valid(dev.dhcp.gateway) && dev.type === 'router') dev.dhcp.gateway = port.ip;
    return true;
  }

  function findByIp(addr) {
    if (!ip.valid(addr)) return null;
    for (const dev of state.devices) {
      for (const p of dev.ports) {
        if (p.ip === addr) return { device: dev, port: p };
      }
    }
    return null;
  }

  function learnMac(dev, mac, portId) {
    if (!mac || !dev || dev.type !== 'switch') return false;
    const current = dev.macTable[mac];
    if (current === portId) return false;
    dev.macTable[mac] = portId;
    return true;
  }

  function snapshot() {
    return {
      version: 2,
      uid: nextUid,
      lessonId: state.lessonId,
      devices: state.devices,
      links: state.links
    };
  }

  function normalizeDevice(dev) {
    const defaults = { enabled: false, interfaceId: '', poolStart: '', poolEnd: '', gateway: '' };
    dev.dhcp = Object.assign({}, defaults, (dev.dhcp && typeof dev.dhcp === 'object') ? dev.dhcp : {});
    if (!Array.isArray(dev.dhcpLeases)) dev.dhcpLeases = [];
    if (!Array.isArray(dev.dynamicRoutes)) dev.dynamicRoutes = [];
    dev.routing = Object.assign({ protocol: 'none', asn: 65001, area: 0, routerId: '', network: '' },
      (dev.routing && typeof dev.routing === 'object') ? dev.routing : {});
    dev.wifi = Object.assign({ ssid: 'NetLab', security: 'open', psk: '', connectedTo: '' },
      (dev.wifi && typeof dev.wifi === 'object') ? dev.wifi : {});
    dev.vlan = Object.assign({ mode: 'access', vlanId: 1, trunkVlans: '1' },
      (dev.vlan && typeof dev.vlan === 'object') ? dev.vlan : {});
    dev.dns = Object.assign({ enabled: false, records: [] }, (dev.dns && typeof dev.dns === 'object') ? dev.dns : {});
    if (!Array.isArray(dev.dns.records)) dev.dns.records = [];
    dev.nat = Object.assign({ enabled: false, mode: 'pat', inside: '', outside: '', statics: [] }, (dev.nat && typeof dev.nat === 'object') ? dev.nat : {});
    if (!Array.isArray(dev.nat.statics)) dev.nat.statics = [];
    if (!Array.isArray(dev.nat.translations)) dev.nat.translations = [];
    dev.acl = Object.assign({ enabled: false, rules: [] }, (dev.acl && typeof dev.acl === 'object') ? dev.acl : {});
    if (!Array.isArray(dev.acl.rules)) dev.acl.rules = [];
    dev.services = Object.assign({ http: false, https: false, ssh: false, ftp: false, smtp: false, dns: false, ntp: false, snmp: false, syslog: false }, (dev.services && typeof dev.services === 'object') ? dev.services : {});
    for (const p of dev.ports) {
      if (typeof p.dhcp !== 'boolean') p.dhcp = false;
      if (!p.lease || typeof p.lease !== 'object') p.lease = null;
      if (typeof p.apipa !== 'boolean') p.apipa = false;
      if (p.vlan == null) p.vlan = 1;
      if (!p.mode) p.mode = 'access';
      if (p.trunkVlans == null) p.trunkVlans = '1';
    }
  }

  function restore(data) {
    if (!data || !Array.isArray(data.devices) || !Array.isArray(data.links)) return false;
    if (!data.devices.every(d => d && d.id && Array.isArray(d.ports) && Array.isArray(d.staticRoutes))) return false;
    state.devices = data.devices;
    state.links = data.links;
    state.lessonId = data.lessonId || 'sandbox';
    nextUid = Math.max(Number(data.uid) || 1, 1);
    // keep uid ahead of anything already in the saved ids
    for (const d of state.devices) {
      normalizeDevice(d);
      const m = String(d.id).match(/-(\d+)$/);
      if (m) nextUid = Math.max(nextUid, Number(m[1]) + 1);
    }
    return true;
  }

  function clearDynamicRoutes() {
    for (const d of state.devices) d.dynamicRoutes = [];
  }

  function dnsResolveName(name) {
    if (!name) return null;
    const n = String(name).toLowerCase().trim();
    for (const d of state.devices) {
      if (!d.dns || !d.dns.enabled || !Array.isArray(d.dns.records)) continue;
      const rec = d.dns.records.find(r => r && String(r.name||'').toLowerCase().trim() === n && ip.valid(r.ip));
      if (rec) return { server: d, ip: rec.ip, name: rec.name };
    }
    return null;
  }

  function aclAllows(dev, pkt) {
    if (!dev || !dev.acl || !dev.acl.enabled || !Array.isArray(dev.acl.rules) || !dev.acl.rules.length) return true;
    for (const r of dev.acl.rules) {
      if (!r) continue;
      const action = (r.action || 'permit').toLowerCase();
      const proto = (r.proto || 'any').toLowerCase();
      if (proto !== 'any' && proto !== (pkt.proto || '').toLowerCase()) continue;
      if (r.src && r.src !== 'any' && r.src !== pkt.srcIp) continue;
      if (r.dst && r.dst !== 'any' && r.dst !== pkt.dstIp) continue;
      return action === 'permit';
    }
    return true; // implicit permit in this simplified model
  }

  NL.model = {
    TYPES, state,
    createDevice, addDevice, getDevice, getLink, byName,
    linkForPort, otherEnd, linksOf, freePorts, addLink, removeDevice, removeLink,
    clearLab, clearDeviceData, clearL2Data, clearDynamicRoutes,
    isL2, isHost, portVlan, portAllowsVlan, parseVlanList,
    primaryPort, primaryIp, configured, deviceStatus, statusText,
    connectedRoutes, routesOf, lookupRoute, egressForGateway, addStaticRoute, removeStaticRoute,
    findByIp, learnMac, randomMac,
    dhcpCapable, dhcpServerInfo, allocateLease, clearLeaseForPort, releaseLeaseForPort,
    forgetLease, leaseOf, pruneLeases, suggestPool, apipaAssign,
    dnsResolveName, aclAllows,
    snapshot, restore,
    get nextUid() { return nextUid; }
  };

  // ================= simulator =================
  const sim = {
    running: false,
    paused: false,
    step: false,
    stepPulse: false,
    token: 0,
    speed: 1
  };

  const CANCEL = { canceled: true };
  const flags = { pings: {}, routed: false, macLearned: false, dhcp: false, last: null, lastDhcp: null, dns: {}, traces: {}, demos: {}, udp: {}, routing: {}, aclDenied: false, aclDenyAdded: false, aclPermitAdded: false };
  let pauseWaiters = [];

  function releasePause() {
    const waiters = pauseWaiters;
    pauseWaiters = [];
    for (const resolve of waiters) resolve();
  }

  function pauseGate() {
    if (!sim.paused) return Promise.resolve();
    return new Promise(resolve => pauseWaiters.push(resolve));
  }

  function log(kind, text, detail) {
    if (NL.hooks && NL.hooks.log) NL.hooks.log({ kind, text, detail });
  }

  function setFrame(type, srcMac, dstMac, srcIp, dstIp, ttl, proto) {
    if (NL.hooks && NL.hooks.frame) {
      NL.hooks.frame({ type, srcMac, dstMac, srcIp, dstIp, ttl, proto });
    }
  }

  function setStatus(stateName, text) {
    if (NL.hooks && NL.hooks.status) NL.hooks.status(stateName, text);
  }

  function softFail(message, hint) {
    const err = new Error(message);
    err.soft = true;
    err.hint = hint || '';
    return err;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function scaled(ms) {
    return Math.max(30, ms / (sim.speed || 1));
  }

  async function wait(ms, token) {
    await sleep(scaled(ms));
    await pauseGate();
    if (token !== sim.token) throw CANCEL;
  }

  function check(token) {
    if (token !== sim.token) throw CANCEL;
  }

  async function stepGate(token) {
    if (!sim.step && !sim.stepPulse) return;
    sim.stepPulse = false;
    sim.paused = true;
    setStatus('paused', sim.step ? 'Auto-paused — press play to continue' : 'Paused — press Step to advance');
    await pauseGate();
    check(token);
  }

  async function animate(segment, meta, token) {
    if (NL.hooks && NL.hooks.travel) {
      try { await NL.hooks.travel(segment, meta, token); } catch (e) { /* animation errors must not break the sim */ }
    } else {
      await sleep(scaled(meta.duration || 420));
    }
    check(token);
    await pauseGate();
    check(token);
  }

  // 802.1Q helpers (simplified): access ports use p.vlan; trunk ports allow listed VLANs.
  function parseVlanList(str) {
    const out = new Set();
    if (str == null) return out;
    String(str).split(',').forEach(part => {
      part = part.trim();
      if (!part) return;
      if (part.includes('-')) {
        const [a,b] = part.split('-').map(Number);
        if (Number.isInteger(a) && Number.isInteger(b)) for (let i=Math.max(1,a); i<=Math.min(4094,b); i++) out.add(i);
      } else {
        const n = Number(part);
        if (Number.isInteger(n) && n >= 1 && n <= 4094) out.add(n);
      }
    });
    return out;
  }
  function portVlan(port, dev) {
    if (!port) return 1;
    const mode = port.mode || (dev && dev.vlan && dev.vlan.mode) || 'access';
    if (mode === 'trunk') return port.vlan || 1; // native/untagged
    return port.vlan || 1;
  }
  function portAllowsVlan(port, vlan, dev) {
    const mode = port.mode || (dev && dev.vlan && dev.vlan.mode) || 'access';
    if (mode === 'trunk') {
      const allowed = parseVlanList(port.trunkVlans || (dev && dev.vlan && dev.vlan.trunkVlans) || '1');
      if (!allowed.size) allowed.add(1);
      return allowed.has(vlan);
    }
    return (port.vlan || 1) === vlan;
  }

  function transmit(path, meta, token) {
    return (async () => {
      for (const seg of path.segments) {
        await animate(seg, meta, token);
        const toDev = getDevice(seg.to);
        if (toDev && (toDev.type === 'switch' || toDev.type === 'ap') && meta.srcMac) {
          const port = toDev.ports.find(p => p.id === seg.toPort);
          const isNew = learnMac(toDev, meta.srcMac, seg.toPort);
          if (isNew) {
            flags.macLearned = true;
            const kind = toDev.type === 'ap' ? 'Wi-Fi AP' : 'Switch';
            log('switch', toDev.name + ' learns ' + meta.srcMac + ' on ' + (port ? port.name : 'a port') + '.',
              kind + 's build a MAC/forwarding table so they can send frames only where needed instead of flooding everything.');
          }
        }
        if (toDev && (toDev.type === 'switch' || toDev.type === 'ap')) await wait(90, token);
        await stepGate(token);
      }
    })();
  }

  function l2Path(startDeviceId, startPortId, destDeviceId, destMac) {
    const startDev = getDevice(startDeviceId);
    const startPort = startDev ? startDev.ports.find(p => p.id === startPortId) : null;
    const startVlan = portVlan(startPort, startDev);
    const visited = new Set();
    const queue = [{ nodeId: startDeviceId, outPortId: startPortId, segments: [], vlan: startVlan }];
    while (queue.length) {
      const cur = queue.shift();
      const key = cur.nodeId + '|' + cur.outPortId + '|' + cur.vlan;
      if (visited.has(key)) continue;
      visited.add(key);

      const link = linkForPort(cur.nodeId, cur.outPortId);
      if (!link) continue;
      const far = otherEnd(link, cur.nodeId);
      const segments = cur.segments.concat([{
        from: cur.nodeId,
        fromPort: cur.outPortId,
        to: far.deviceId,
        toPort: far.portId,
        linkId: link.id,
        vlan: cur.vlan
      }]);

      if (far.deviceId === destDeviceId) return { segments };

      const farDev = getDevice(far.deviceId);
      if (!farDev || (farDev.type !== 'switch' && farDev.type !== 'hub' && farDev.type !== 'ap')) continue;

      // Classify the untagged frame at the ingress port: an access port assigns its
      // VLAN (PVID), while a trunk only accepts VLANs in its allowed list.
      const ingressPort = farDev.ports.find(p => p.id === far.portId);
      let linkVlan = cur.vlan;
      if (farDev.type !== 'hub' && ingressPort) {
        const imode = ingressPort.mode || (farDev.vlan && farDev.vlan.mode) || 'access';
        if (imode === 'trunk') {
          const allowed = parseVlanList(ingressPort.trunkVlans || (farDev.vlan && farDev.vlan.trunkVlans) || '1');
          if (!allowed.size) allowed.add(1);
          if (!allowed.has(cur.vlan)) continue;
        } else {
          linkVlan = ingressPort.vlan || 1;
        }
      }

      let egress = null;
      // Hubs ignore VLANs/MAC learning (dumb repeaters). Switch/AP can learn and filter.
      if (farDev.type !== 'hub' && destMac) {
        const learnedPort = farDev.macTable[destMac];
        if (learnedPort && learnedPort !== far.portId && linkForPort(farDev.id, learnedPort)) {
          const lp = farDev.ports.find(p => p.id === learnedPort);
          if (lp && portAllowsVlan(lp, linkVlan, farDev)) egress = [learnedPort];
        }
      }
      if (!egress) {
        egress = farDev.ports
          .filter(p => p.id !== far.portId && linkForPort(farDev.id, p.id))
          .filter(p => farDev.type === 'hub' || portAllowsVlan(p, linkVlan, farDev))
          .map(p => p.id);
      }
      for (const portId of egress) {
        queue.push({ nodeId: farDev.id, outPortId: portId, segments, vlan: linkVlan });
      }
    }
    return null;
  }

  function reversePath(path) {
    const segments = path.segments.slice().reverse().map(seg => ({
      from: seg.to,
      fromPort: seg.toPort,
      to: seg.from,
      toPort: seg.fromPort,
      linkId: seg.linkId
    }));
    return { segments };
  }

  async function arpResolve(node, port, targetIp, token) {
    if (!ip.valid(port.ip)) {
      throw softFail(node.name + ' has no IP address on ' + port.name + '.', 'Give it an address first — select the device and fill in the fields.');
    }
    if (node.arp[targetIp]) {
      log('arp', node.name + ' already knows ' + targetIp + ' is at ' + node.arp[targetIp] + '.',
        'Cached in its ARP table, so no broadcast is needed this time.');
      return node.arp[targetIp];
    }

    const found = findByIp(targetIp);
    if (!found) {
      throw softFail(node.name + ' asks "who has ' + targetIp + '?" but nobody answers.',
        'No device has that IP. Check the addresses and gateways you typed.');
    }
    if (found.device.id === node.id) return found.port.mac;

    setStatus('running', 'ARP request…');
    setFrame('ARP request', port.mac, 'FF:FF:FF:FF:FF:FF', port.ip, targetIp, '—', 'ARP');
    log('arp', node.name + ' broadcasts: "Who has ' + targetIp + '? Tell ' + port.ip + '."',
      'It needs the destination MAC address before it can build an Ethernet frame.');
    setStatus('running', node.name + ' is asking for a MAC address…');

    const path = l2Path(node.id, port.id, found.device.id, null);
    if (!path) {
      throw softFail('The ARP request from ' + node.name + ' never reaches ' + targetIp + '.',
        'Those two devices are not connected through switches or hubs on the same LAN.');
    }

    await transmit(path, {
      label: 'ARP ?', color: 'amber', duration: 420,
      srcMac: port.mac, dstMac: 'FF:FF:FF:FF:FF:FF'
    }, token);

    node.arp[targetIp] = found.port.mac;
    found.device.arp[port.ip] = port.mac;
    log('arp', found.device.name + ' replies: "' + targetIp + ' is at ' + found.port.mac + '".',
      'Both devices now have each other in their ARP tables.');

    const back = l2Path(found.device.id, found.port.id, node.id, port.mac);
    if (back) {
      setFrame('ARP reply', found.port.mac, port.mac, targetIp, port.ip, '—', 'ARP');
      await transmit(back, {
        label: 'ARP ✓', color: 'green', duration: 380,
        srcMac: found.port.mac, dstMac: port.mac
      }, token);
    }
    return found.port.mac;
  }

  function hostIp(dev) {
    const p = primaryPort(dev);
    return p && ip.valid(p.ip) ? p.ip : '';
  }

  async function deliver(srcDev, dstIp, token, legSegments, opts) {
    opts = opts || {};
    const proto = opts.proto || 'ICMP';
    const labelBase = opts.label || (proto === 'UDP' ? 'UDP' : 'ICMP');
    const srcIp = hostIp(srcDev);
    let node = srcDev;
    let ttl = 64;
    let hops = 0;

    while (hops < 12) {
      hops++;
      let nextHopIp = '';
      let outPort = null;

      if (node.type === 'router') {
        if (node.ports.some(p => p.ip === dstIp)) {
          log('ip', node.name + ' receives the ' + labelBase + ' packet on one of its own interfaces.', proto === 'UDP' ? 'A router can host services too; in this sim the destination host handles it.' : 'Routers can be pinged too.');
          return { hops, dstDevice: node };
        }
        const route = lookupRoute(node, dstIp);
        if (!route) {
          throw softFail(node.name + ' has no route to ' + dstIp + ', so it drops the packet.',
            'Routers only know directly connected networks by default. Add a static route or run a dynamic routing protocol.');
        }
        if (route.connected) {
          nextHopIp = dstIp;
          outPort = node.ports.find(p => p.id === route.portId) || null;
          log('ip', node.name + ' checks its routing table: ' + dstIp + ' is directly connected on ' + route.iface + '.',
            'Route: ' + route.network + '/' + route.prefix + ' is on ' + route.iface + (route.proto ? ' (' + route.proto + ').' : '.'));
        } else {
          nextHopIp = route.gateway;
          outPort = egressForGateway(node, nextHopIp);
          const via = route.proto && route.proto !== 'static' ? 'learned via ' + route.proto.toUpperCase() : 'added as a static route';
          log('ip', node.name + ' checks its routing table: ' + dstIp + ' matches ' + route.network + '/' + route.prefix + ' → next hop ' + route.gateway + '.',
            'Longest-prefix match wins. This route was ' + via + '.');
          if (!outPort) {
            throw softFail(node.name + ' cannot find a connected interface for its next hop ' + nextHopIp + '.',
              'The next-hop router must share a subnet with one of this router\'s interfaces.');
          }
        }
        ttl -= 1;
        if (ttl <= 0) {
          throw softFail('TTL reached 0 at ' + node.name + '. The packet was dropped.', 'A routing loop or a very long path. Check routes point correctly.');
        }
        log('ip', node.name + ' decrements the TTL to ' + ttl + '.', 'Every router hop subtracts one so loops eventually die.');

        if (node.acl && node.acl.enabled && !aclAllows(node, { proto, srcIp, dstIp })) {
          flags.aclDenied = true;
          throw softFail(node.name + ' ACL denied the ' + proto + ' packet from ' + srcIp + ' to ' + dstIp + '.',
            'An ACL/firewall rule matched this traffic and blocked it. Adjust the rule order/action in the router’s Device tab.');
        }
        if (node.nat && node.nat.enabled) {
          const inside = node.nat.inside || 'the inside network';
          const publicIp = node.nat.outside || primaryIp(node) || 'the outside interface';
          log('ip', node.name + ' applies NAT/PAT: ' + srcIp + ' → ' + publicIp + ' for traffic leaving ' + inside + '.',
            'NAT rewrites private addresses to a public address. PAT tracks ports so many inside hosts can share one public IP. (Translation is shown for teaching; routing here still uses the original packet.)');
          if (!Array.isArray(node.nat.translations)) node.nat.translations = [];
          if (!node.nat.translations.some(t => t.inside === srcIp && t.outside === publicIp)) {
            node.nat.translations.push({ inside: srcIp, outside: publicIp, ts: Date.now() });
          }
        }
      } else {
        const port = node.ports[0];
        if (!ip.valid(port.ip)) {
          throw softFail(node.name + ' has no IP address, so the packet never leaves.', 'Select it and give it an IP address and subnet mask.');
        }
        if (ip.sameSubnet(port.ip, dstIp, port.prefix)) {
          nextHopIp = dstIp;
          log('ip', node.name + ' sees that ' + dstIp + ' is in its own subnet (' + ip.network(port.ip, port.prefix) + '/' + port.prefix + ').',
            'Same subnet means it can talk directly, no router needed.');
        } else {
          if (!ip.valid(port.gateway)) {
            throw softFail(node.name + ' wants ' + dstIp + ', which is on a different subnet, but it has no default gateway.',
              'Set its gateway to the router address on this LAN — for example 192.168.1.1. (Link-local APIPA 169.254/16 cannot use a gateway.)');
          }
          nextHopIp = port.gateway;
          log('ip', node.name + ' sees that ' + dstIp + ' is on another network, so it sends the packet to its gateway ' + nextHopIp + '.',
            'A gateway is the router that knows how to leave this LAN.');
        }
        outPort = port;
      }

      if (!outPort) throw softFail('No usable interface on ' + node.name + '.', 'Check the cables and IP addresses.');
      const found = findByIp(nextHopIp);
      if (!found) {
        throw softFail('No device has the address ' + nextHopIp + ', so the packet has nowhere to go.',
          'Check the gateway addresses and router interfaces.');
      }

      const isFinal = nextHopIp === dstIp;
      const mac = await arpResolve(node, outPort, nextHopIp, token);
      const path = l2Path(node.id, outPort.id, found.device.id, mac);
      if (!path) {
        throw softFail(node.name + ' cannot deliver an Ethernet frame to ' + nextHopIp + '.',
          'They might not be on the same switch segment, or VLANs may be separating them. Check cables and VLAN settings.');
      }

      setStatus('running', node.name + ' → ' + found.device.name);
      const frameType = isFinal ? (proto === 'UDP' ? 'UDP datagram' : 'ICMP echo request') : (proto === 'UDP' ? 'UDP datagram (routed)' : 'ICMP echo request (routed)');
      setFrame(frameType, outPort.mac, mac, srcIp, dstIp, ttl, proto);
      const portsInfo = proto === 'UDP' ? ' · UDP src ' + (opts.srcPort || '?') + ' → dst ' + (opts.dstPort || '?') : '';
      log('ip', node.name + ' sends ' + (proto === 'UDP' ? 'a UDP datagram' : 'an ICMP echo request') + ' to ' + dstIp + (isFinal ? ' (the destination).' : ' via ' + nextHopIp + '.'),
        'Ethernet: ' + outPort.mac + ' → ' + mac + ' · IP: ' + srcIp + ' → ' + dstIp + ' · TTL ' + ttl + portsInfo + (opts.app ? ' · ' + opts.app : ''));

      await transmit(path, {
        label: proto === 'UDP' ? 'UDP' : (isFinal ? 'ICMP' : 'ICMP →'), color: proto === 'UDP' ? 'amber' : 'cyan', duration: 430,
        srcMac: outPort.mac, dstMac: mac
      }, token);

      for (const seg of path.segments) legSegments.push(seg);

      if (isFinal) {
        if (proto === 'UDP') {
          log('ok', found.device.name + ' receives the UDP datagram on port ' + (opts.dstPort || '?') + '.', opts.app ? 'Application: ' + opts.app + '. UDP delivers it to the listening app without a handshake.' : 'UDP delivers it to the listening app without a handshake or acknowledgment.');
        } else if (found.device.type === 'router') {
          log('ip', found.device.name + ' receives the echo request on ' + found.port.name + '.', 'The destination address belongs to this router.');
        } else {
          log('ok', found.device.name + ' receives the echo request.', 'It will answer with an echo reply.');
        }
        return { hops, dstDevice: found.device };
      }

      if (found.device.type !== 'router') {
        throw softFail('The frame reached ' + found.device.name + ' but ' + dstIp + ' lives somewhere else.',
          'This usually means a gateway is set to the wrong IP.');
      }

      log('ip', found.device.name + ' receives the frame addressed to its MAC, strips the Ethernet header, and looks up ' + dstIp + '.',
        'The destination IP is not the router itself, so it will forward the packet.');
      node = found.device;
      await wait(180, token);
    }

    throw softFail('Too many hops — the packet seems to be looping.', 'Check for routes that point at each other in a circle.');
  }

  async function ping(srcId, dstId) {
    const src = getDevice(srcId);
    const dst = getDevice(dstId);
    if (!src || !dst) return;
    sim.cancel();

    const token = ++sim.token;
    sim.running = true;
    flags.last = null;
    const startedAt = performance.now();

    setStatus('running', 'Starting ping…');
    try {
      if (src.id === dst.id) {
        throw softFail('Pick two different devices to ping.', 'A ping travels between two hosts.');
      }
      const srcPort = primaryPort(src);
      const dstPort = primaryPort(dst);
      if (!srcPort || !ip.valid(srcPort.ip)) {
        throw softFail(src.name + ' has no IP address yet.', 'Select ' + src.name + ' and fill in its IP address first.');
      }
      if (!dstPort || !ip.valid(dstPort.ip)) {
        throw softFail(dst.name + ' has no IP address yet.', 'Select ' + dst.name + ' and fill in its IP address first.');
      }
      const dstIp = dstPort.ip;
      const same = ip.sameSubnet(srcPort.ip, dstIp, srcPort.prefix);

      log('ip', 'Ping: ' + src.name + ' (' + srcPort.ip + ') → ' + dst.name + ' (' + dstIp + ').',
        same ? 'They are in the same subnet, so this should be a direct conversation.' : 'They are in different subnets, so a router must carry the packet.');
      setStatus('running', 'Looking up ' + dstIp + '…');

      const legSegments = [];
      const result = await deliver(src, dstIp, token, legSegments);
      check(token);

      const ms = Math.max(1, Math.round((performance.now() - startedAt) / 12));
      flags.pings[src.id + '>' + dst.id] = true;
      if (result.hops > 1) flags.routed = true;

      setFrame('ICMP echo reply', dstPort.mac, srcPort.mac, dstIp, srcPort.ip, 64 - (result.hops > 1 ? result.hops - 1 : 0), 'ICMP');
      log('ip', dst.name + ' sends an ICMP echo reply back to ' + srcPort.ip + '.', 'The reply retraces the path to the sender.');
      setStatus('running', 'Echo reply coming back…');

      if (legSegments.length) {
        const back = reversePath({ segments: legSegments });
        await transmit(back, {
          label: 'REPLY', color: 'green', duration: 300,
          srcMac: dstPort.mac, dstMac: srcPort.mac
        }, token);
      }

      log('ok', 'Ping succeeded: reply from ' + dstIp + ' — time=' + ms + ' ms, TTL=' + (64 - Math.max(0, result.hops - 1)) + '.',
        'Sent 1 packet, received 1. Round-trip time varies with the number of hops in the real world.');
      setStatus('success', 'Reply received');
      flags.last = { srcId, dstId, ok: true, hops: result.hops, ms };
      if (NL.hooks && NL.hooks.done) NL.hooks.done({ srcId, dstId, ok: true, hops: result.hops, ms });
    } catch (err) {
      if (err === CANCEL) {
        if (token === sim.token) {
          log('warn', 'Simulation stopped.', '');
          setStatus('idle', '');
        }
      } else if (err && err.soft) {
        check(token);
        log('warn', err.message, err.hint);
        log('warn', 'Ping failed: request timed out.', 'Read the last few lines — the first warning is usually the real cause.');
        setStatus('failed', 'Request timed out');
        flags.last = { srcId, dstId, ok: false, message: err.message };
        if (NL.hooks && NL.hooks.done) NL.hooks.done({ srcId, dstId, ok: false, message: err.message });
      } else {
        console.error(err);
        log('warn', 'Something went wrong inside the simulator.', String(err && err.message || err));
        setStatus('failed', 'Simulator error');
      }
    } finally {
      if (token === sim.token) sim.running = false;
    }
  }

  // ================= DHCP simulator (DORA) =================
  function dhcpCandidates(src, port) {
    const out = [];
    for (const d of state.devices) {
      const info = dhcpServerInfo(d);
      if (!info) continue;
      const path = l2Path(src.id, port.id, d.id, null);
      if (!path) continue;
      out.push({ server: d, info, path });
    }
    return out;
  }

  async function dhcpRequest(srcId) {
    const src = getDevice(srcId);
    if (!src) return;
    sim.cancel();

    const token = ++sim.token;
    sim.running = true;
    flags.lastDhcp = null;
    const startedAt = performance.now();

    setStatus('running', 'Starting DHCP…');
    try {
      if (src.type !== 'pc' && src.type !== 'server') {
        throw softFail('Only PCs and servers get addresses from DHCP.',
          'A router is configured by hand: its interfaces are the fixed doorways for each subnet.');
      }
      const port = src.ports[0];
      if (!port) throw softFail(src.name + ' has no network interface.');
      if (!linkForPort(src.id, port.id)) {
        throw softFail(src.name + ' is not plugged into anything yet.',
          'Use the Cable tool to connect it to a switch or router before asking for an address.');
      }

      const candidates = dhcpCandidates(src, port);
      if (!candidates.length) {
        throw softFail('No DHCP server answered ' + src.name + '.',
          'A DHCP DISCOVER is a broadcast, so it only reaches this local network. Add a Server or Router on the same switch and turn on its DHCP server.');
      }
      const usable = candidates.filter(c => c.info.ok);
      if (!usable.length) {
        throw softFail(candidates[0].info.error || 'The DHCP server on this network is misconfigured.',
          'Open the server, give it an address on this LAN, and set a pool of addresses.');
      }

      let chosen = null;
      let lease = null;
      for (const c of usable) {
        const candidate = allocateLease(c.server, src.id, port.mac);
        if (candidate) { chosen = c; lease = candidate; break; }
      }
      if (!chosen) {
        throw softFail('The DHCP pool has no free addresses left.',
          'Make the pool bigger, or release a lease from another device.');
      }

      const server = chosen.server;
      const serverPort = chosen.info.port;
      const forward = chosen.path;
      const back = reversePath(forward);
      const gatewayText = lease.gateway ? ' and gateway ' + lease.gateway : '';

      if (port.lease) {
        log('dhcp', src.name + ' already has a lease on ' + port.ip + ', so it asks the server to confirm it again.',
          'A real renewal is a unicast REQUEST/ACK. NetLab replays the full DORA exchange so you can follow every step.');
      } else {
        log('dhcp', src.name + ' has no address, so it broadcasts a DHCP DISCOVER.',
          'It does not know any server address yet, so it asks everyone on the LAN.');
      }

      setStatus('running', 'DHCP DISCOVER…');
      setFrame('DHCP DISCOVER', port.mac, 'FF:FF:FF:FF:FF:FF', '0.0.0.0', '255.255.255.255', '—', 'DHCP');
      await transmit(forward, {
        label: 'DISCOVER', color: 'purple', duration: 460,
        srcMac: port.mac, dstMac: 'FF:FF:FF:FF:FF:FF'
      }, token);
      await wait(120, token);

      setStatus('running', 'DHCP OFFER…');
      setFrame('DHCP OFFER', serverPort.mac, 'FF:FF:FF:FF:FF:FF', serverPort.ip, '255.255.255.255', '—', 'DHCP');
      log('dhcp', server.name + ' offers ' + lease.ip + ' to ' + src.name + '.',
        'The offer comes from ' + serverPort.ip + ' on ' + serverPort.name + '.');
      await transmit(back, {
        label: 'OFFER ' + lease.ip, color: 'purple', duration: 430,
        srcMac: serverPort.mac, dstMac: 'FF:FF:FF:FF:FF:FF'
      }, token);
      await wait(120, token);

      setStatus('running', 'DHCP REQUEST…');
      setFrame('DHCP REQUEST', port.mac, 'FF:FF:FF:FF:FF:FF', '0.0.0.0', '255.255.255.255', '—', 'DHCP');
      log('dhcp', src.name + ' requests the offered address ' + lease.ip + '.',
        'The request is broadcast too, so every server knows which offer was accepted.');
      await transmit(forward, {
        label: 'REQUEST', color: 'amber', duration: 430,
        srcMac: port.mac, dstMac: 'FF:FF:FF:FF:FF:FF'
      }, token);
      await wait(120, token);

      setStatus('running', 'DHCP ACK…');
      setFrame('DHCP ACK', serverPort.mac, port.mac, serverPort.ip, lease.ip, '—', 'DHCP');
      await transmit(back, {
        label: 'ACK', color: 'green', duration: 380,
        srcMac: serverPort.mac, dstMac: port.mac
      }, token);

      // The ACK is the moment the client may actually use the address.
      port.dhcp = true;
      port.ip = lease.ip;
      port.prefix = lease.prefix;
      port.gateway = lease.gateway || '';
      port.lease = {
        ip: lease.ip,
        prefix: lease.prefix,
        gateway: lease.gateway || '',
        serverId: server.id,
        serverName: server.name,
        serverIp: lease.serverIp
      };
      if (!server.dhcpLeases.some(l => l.mac === port.mac)) server.dhcpLeases.push(lease);

      const ms = Math.max(1, Math.round((performance.now() - startedAt) / 12));
      log('ok', 'DHCP ACK received. ' + src.name + ' is now ' + lease.ip + '/' + lease.prefix + gatewayText + '.',
        'Real leases also carry a timer, often 24 hours. NetLab keeps yours until you release it.');
      setStatus('success', 'Address obtained');
      flags.dhcp = true;
      flags.lastDhcp = {
        srcId: src.id, serverId: server.id, ip: lease.ip, prefix: lease.prefix,
        gateway: lease.gateway || '', ok: true, ms
      };
      if (NL.hooks && NL.hooks.done) {
        NL.hooks.done({
          type: 'dhcp', srcId: src.id, ok: true, ip: lease.ip, prefix: lease.prefix,
          gateway: lease.gateway || '', serverId: server.id, hops: forward.segments.length
        });
      }
    } catch (err) {
      if (err === CANCEL) {
        if (token === sim.token) {
          log('warn', 'Simulation stopped.', '');
          setStatus('idle', '');
        }
      } else if (err && err.soft) {
        check(token);
        log('warn', err.message, err.hint);
        log('warn', 'DHCP failed: no address was given out.', 'Fix the first warning above, then try again.');
        setStatus('failed', 'No DHCP address');
        flags.lastDhcp = { srcId, ok: false, message: err.message };
        if (NL.hooks && NL.hooks.done) {
          NL.hooks.done({ type: 'dhcp', srcId, ok: false, message: err.message });
        }
      } else {
        console.error(err);
        log('warn', 'Something went wrong inside the DHCP simulation.', String(err && err.message || err));
        setStatus('failed', 'Simulator error');
      }
    } finally {
      if (token === sim.token) sim.running = false;
    }
  }

  // ================= UDP (connectionless) =================
  async function udpSend(srcId, dstId, opts) {
    opts = opts || {};
    const src = getDevice(srcId);
    const dst = getDevice(dstId);
    if (!src || !dst) return;
    sim.cancel();
    const token = ++sim.token;
    sim.running = true;
    const startedAt = performance.now();
    const srcPortNum = opts.srcPort || 50000 + Math.floor(Math.random() * 1000);
    const dstPortNum = opts.dstPort || 53;
    const app = opts.app || 'DNS query';
    setStatus('running', 'Sending UDP datagram…');
    try {
      if (src.type !== 'pc' && src.type !== 'server' && src.type !== 'wifi' && src.type !== 'ap') {
        throw softFail('Pick a host to send UDP from.', 'Routers forward packets; hosts create them.');
      }
      const sp = primaryPort(src); const dp = primaryPort(dst);
      if (!sp || !ip.valid(sp.ip)) throw softFail(src.name + ' has no IP address yet.', 'Give it an address first.');
      if (!dp || !ip.valid(dp.ip)) throw softFail(dst.name + ' has no IP address yet.', 'Give it an address first.');
      const dstIp = dp.ip;
      log('ip', src.name + ' creates a UDP datagram to ' + dst.name + ' (' + dstIp + ':' + dstPortNum + ', ' + app + ').',
        'UDP is connectionless: no handshake, no delivery guarantee, just "fire and forget". Source port ' + srcPortNum + ' identifies the sender\'s conversation.');
      const leg = [];
      const result = await deliver(src, dstIp, token, leg, { proto: 'UDP', srcPort: srcPortNum, dstPort: dstPortNum, app: app, label: 'UDP' });
      const ms = Math.max(1, Math.round((performance.now() - startedAt) / 12));
      setStatus('success', 'UDP delivered');
      flags.last = { srcId, dstId, ok: true, hops: result.hops, ms, proto: 'udp' };
      flags.udp[src.id + '>' + dst.id] = true;
      if (NL.hooks && NL.hooks.done) NL.hooks.done({ type: 'udp', srcId, dstId, ok: true, hops: result.hops, ms, proto: 'udp' });
    } catch (err) {
      if (err === CANCEL) { if (token === sim.token) { log('warn','Simulation stopped.',''); setStatus('idle',''); } }
      else if (err && err.soft) { check(token); log('warn', err.message, err.hint); setStatus('failed','UDP not delivered'); if (NL.hooks && NL.hooks.done) NL.hooks.done({type:'udp',srcId,dstId,ok:false,message:err.message,proto:'udp'}); }
      else { console.error(err); log('warn','Something went wrong.',''); setStatus('failed','Simulator error'); }
    } finally { if (token === sim.token) sim.running = false; }
  }

  // ================= Generic protocol demos =================
  async function sendMsg(path, meta, token) {
    setFrame(meta.type, meta.srcMac || '—', meta.dstMac || '—', meta.srcIp || '—', meta.dstIp || '—', meta.ttl || '—', meta.proto || '—');
    await transmit(path, { label: meta.label || meta.type, color: meta.color || 'cyan', duration: meta.duration || 420, srcMac: meta.srcMac }, token);
  }

  async function demoSequence(srcId, dstId, steps, title) {
    const src = getDevice(srcId), dst = getDevice(dstId);
    if (!src || !dst) return;
    sim.cancel();
    const token = ++sim.token; sim.running = true; flags.last = null;
    setStatus('running', title || 'Protocol demo…');
    try {
      const sp = primaryPort(src), dp = primaryPort(dst);
      if (!sp || !dp) throw softFail('Both devices need network interfaces.');
      const path = l2Path(src.id, sp.id, dst.id, null) || { segments: [] };
      const back = path.segments.length ? reversePath(path) : { segments: [] };
      for (const step of steps) {
        check(token);
        log(step.kind || 'ip', step.text, step.detail || '');
        const usePath = step.dir === 'back' ? back : path;
        const from = step.dir === 'back' ? dst : src;
        const to = step.dir === 'back' ? src : dst;
        const fp = primaryPort(from), tp = primaryPort(to);
        if (usePath.segments.length) {
          await sendMsg(usePath, {
            type: step.frame || step.label, label: step.label, color: step.color || 'cyan',
            srcMac: fp ? fp.mac : '', dstMac: tp ? tp.mac : 'FF:FF:FF:FF:FF:FF',
            srcIp: fp && ip.valid(fp.ip) ? fp.ip : (step.srcIp || '0.0.0.0'),
            dstIp: tp && ip.valid(tp.ip) ? tp.ip : (step.dstIp || '255.255.255.255'),
            ttl: step.ttl || '—', proto: step.proto || step.frame || '—', duration: step.duration || 420
          }, token);
        }
        await wait(step.wait || 160, token);
      }
      log('ok', title + ' complete.', 'This was a simplified teaching view of the protocol exchange.');
      setStatus('success', 'Demo complete');
      flags.last = { srcId, dstId, ok: true, demo: title };
      flags.demos[title] = true;
      if (NL.hooks && NL.hooks.done) NL.hooks.done({ type: 'demo', srcId, dstId, ok: true, demo: title });
    } catch (err) {
      if (err === CANCEL) { if (token === sim.token) { log('warn','Simulation stopped.',''); setStatus('idle',''); } }
      else if (err && err.soft) { check(token); log('warn', err.message, err.hint); setStatus('failed','Demo failed'); if (NL.hooks && NL.hooks.done) NL.hooks.done({type:'demo',ok:false,message:err.message}); }
      else { console.error(err); log('warn','Something went wrong.',''); setStatus('failed','Simulator error'); }
    } finally { if (token === sim.token) sim.running = false; }
  }

  // ================= Traceroute (simplified hop-by-hop) =================
  async function traceroute(srcId, dstId) {
    const src = getDevice(srcId), dst = getDevice(dstId);
    if (!src || !dst) return;
    sim.cancel();
    const token = ++sim.token; sim.running = true; flags.last = null;
    setStatus('running', 'Traceroute…');
    try {
      const sp = primaryPort(src), dp = primaryPort(dst);
      if (!sp || !ip.valid(sp.ip)) throw softFail(src.name + ' has no IP address yet.', 'Give it an address first.');
      if (!dp || !ip.valid(dp.ip)) throw softFail(dst.name + ' has no IP address yet.', 'Give it an address first.');
      const dstIp = dp.ip;
      log('ip', 'Traceroute from ' + src.name + ' to ' + dstIp + '.', 'Sends probes with increasing TTL. Each router that drops a packet (TTL expired) replies with ICMP Time Exceeded, revealing the path.');
      let hopNode = src;
      let reached = false;
      for (let ttl = 1; ttl <= 12; ttl++) {
        check(token);
        // find next hop from hopNode toward dstIp
        let nextHopIp = '', outPort = null, routerHop = null;
        if (hopNode.type === 'router') {
          if (hopNode.ports.some(p => p.ip === dstIp)) { reached = true; break; }
          const route = lookupRoute(hopNode, dstIp);
          if (!route) { log('warn', 'No route from ' + hopNode.name + ' to ' + dstIp + '.', 'Traceroute stops where routing fails.'); break; }
          if (route.connected) { nextHopIp = dstIp; outPort = hopNode.ports.find(p => p.id === route.portId) || null; }
          else { nextHopIp = route.gateway; outPort = egressForGateway(hopNode, nextHopIp); }
          routerHop = hopNode;
        } else {
          const port = primaryPort(hopNode);
          if (!port || !ip.valid(port.ip)) break;
          if (ip.sameSubnet(port.ip, dstIp, port.prefix)) { nextHopIp = dstIp; }
          else {
            if (!ip.valid(port.gateway)) { log('warn', hopNode.name + ' has no gateway for ' + dstIp + '.', 'Traceroute cannot leave the local subnet.'); break; }
            nextHopIp = port.gateway;
          }
          outPort = port;
        }
        const found = findByIp(nextHopIp);
        if (!found || !outPort) { log('warn', 'Next hop ' + nextHopIp + ' unreachable.', ''); break; }
        const mac = await arpResolve(hopNode, outPort, nextHopIp, token);
        const path = l2Path(hopNode.id, outPort.id, found.device.id, mac);
        if (!path) { log('warn', 'No L2 path to ' + nextHopIp + '.', ''); break; }
        setFrame('ICMP Echo (probe)', outPort.mac, mac, sp.ip, dstIp, String(ttl), 'ICMP');
        await transmit(path, { label: 'TTL=' + ttl, color: 'cyan', duration: 360, srcMac: outPort.mac, dstMac: mac }, token);
        for (const seg of path.segments) flags.macLearned = flags.macLearned || false;
        if (nextHopIp === dstIp) {
          log('ok', ttl + '  ' + dstIp + ' (' + dst.name + ') — destination reached.', 'The probe arrived with TTL remaining, so the destination replies.');
          reached = true;
          break;
        }
        if (found.device.type === 'router') {
          const replyIp = found.port.ip || primaryIp(found.device);
          log('ip', ttl + '  ' + (replyIp || found.device.name) + ' (' + found.device.name + ') — ICMP Time Exceeded.', 'TTL expired at this router, so it reports back and the packet is dropped.');
          hopNode = found.device;
          await wait(120, token);
        } else {
          log('warn', 'Probe reached ' + found.device.name + ' unexpectedly.', '');
          break;
        }
      }
      setStatus(reached ? 'success' : 'failed', reached ? 'Trace complete' : 'Trace incomplete');
      flags.last = { srcId, dstId, ok: reached, proto: 'trace' };
      if (reached) flags.traces[srcId + '>' + dstId] = true;
      if (NL.hooks && NL.hooks.done) NL.hooks.done({ type: 'trace', srcId, dstId, ok: reached });
    } catch (err) {
      if (err === CANCEL) { if (token === sim.token) { log('warn','Simulation stopped.',''); setStatus('idle',''); } }
      else if (err && err.soft) { check(token); log('warn', err.message, err.hint); setStatus('failed','Traceroute failed'); if (NL.hooks && NL.hooks.done) NL.hooks.done({type:'trace',ok:false,message:err.message}); }
      else { console.error(err); log('warn','Something went wrong.',''); setStatus('failed','Simulator error'); }
    } finally { if (token === sim.token) sim.running = false; }
  }

  // ================= DNS resolve (simplified) =================
  async function dnsQuery(srcId, name) {
    const src = getDevice(srcId);
    if (!src) return;
    sim.cancel();
    const token = ++sim.token; sim.running = true; flags.last = null;
    setStatus('running', 'DNS query…');
    try {
      const sp = primaryPort(src);
      if (!sp || !ip.valid(sp.ip)) throw softFail(src.name + ' has no IP address yet.', 'Give it an address first.');
      const qname = String(name || 'web.local').trim();
      log('ip', src.name + ' queries DNS for "' + qname + '" (UDP/53).', 'DNS translates human-friendly names to IP addresses. Clients usually ask a configured DNS server.');
      const rec = dnsResolveName(qname);
      // try to animate query to a DNS server if present
      const dnsServer = rec ? rec.server : state.devices.find(d => d.dns && d.dns.enabled);
      if (dnsServer) {
        const dp = primaryPort(dnsServer);
        if (dp && ip.valid(dp.ip)) {
          const path = l2Path(src.id, sp.id, dnsServer.id, null);
          if (path) {
            await sendMsg(path, { type: 'DNS Query', label: 'DNS', color: 'amber', srcMac: sp.mac, dstMac: dp.mac, srcIp: sp.ip, dstIp: dp.ip, proto: 'UDP/DNS' }, token);
            const back = reversePath(path);
            await sendMsg(back, { type: rec ? 'DNS Response' : 'DNS NXDOMAIN', label: rec ? 'A=' + rec.ip : 'NXDOMAIN', color: rec ? 'green' : 'red', srcMac: dp.mac, dstMac: sp.mac, srcIp: dp.ip, dstIp: sp.ip, proto: 'UDP/DNS' }, token);
          }
        }
      }
      if (!rec) {
        log('warn', 'DNS lookup failed: no record for "' + qname + '".', 'Configure a DNS server device with an A record for that name.');
        setStatus('failed', 'Name not resolved');
        flags.last = { srcId, ok: false, proto: 'dns', name: qname };
        if (NL.hooks && NL.hooks.done) NL.hooks.done({ type: 'dns', srcId, ok: false, name: qname });
      } else {
        log('ok', 'DNS resolved "' + qname + '" → ' + rec.ip + ' (from ' + rec.server.name + ').', 'Applications then connect to the returned IP address (often via TCP/UDP).');
        setStatus('success', 'Resolved to ' + rec.ip);
        flags.last = { srcId, ok: true, proto: 'dns', name: qname, ip: rec.ip };
        flags.dns[srcId + '>' + qname] = true;
        if (NL.hooks && NL.hooks.done) NL.hooks.done({ type: 'dns', srcId, ok: true, name: qname, ip: rec.ip });
      }
    } catch (err) {
      if (err === CANCEL) { if (token === sim.token) { log('warn','Simulation stopped.',''); setStatus('idle',''); } }
      else if (err && err.soft) { check(token); log('warn', err.message, err.hint); setStatus('failed','DNS failed'); if (NL.hooks && NL.hooks.done) NL.hooks.done({type:'dns',ok:false,message:err.message}); }
      else { console.error(err); log('warn','Something went wrong.',''); setStatus('failed','Simulator error'); }
    } finally { if (token === sim.token) sim.running = false; }
  }

  // ================= Dynamic routing convergence (simplified) =================
  function routerLinks() {
    const pairs = [];
    const routers = state.devices.filter(d => d.type === 'router');
    for (let i = 0; i < routers.length; i++) {
      for (let j = i + 1; j < routers.length; j++) {
        const a = routers[i], b = routers[j];
        // find a shared link between any ports in same subnet
        for (const pa of a.ports) {
          const lk = linkForPort(a.id, pa.id); if (!lk) continue;
          const far = otherEnd(lk, a.id);
          if (far.deviceId !== b.id) continue;
          const pb = b.ports.find(p => p.id === far.portId);
          if (!pa || !pb || !ip.valid(pa.ip) || !ip.valid(pb.ip)) continue;
          if (ip.sameSubnet(pa.ip, pb.ip, pa.prefix) && ip.sameSubnet(pa.ip, pb.ip, pb.prefix)) {
            pairs.push({ a, b, pa, pb, link: lk });
          }
        }
      }
    }
    return pairs;
  }

  async function runRouting(protocol) {
    sim.cancel();
    const token = ++sim.token; sim.running = true;
    clearDynamicRoutes();
    setStatus('running', protocol.toUpperCase() + ' converging…');
    try {
      const routers = state.devices.filter(d => d.type === 'router');
      if (routers.length < 2) throw softFail('Need at least two routers with connected interfaces to run ' + protocol.toUpperCase() + '.',
        'Connect routers, give their shared link addresses in the same subnet, and try again.');
      const pairs = routerLinks();
      if (!pairs.length) throw softFail('No router neighbors found.', 'Routers must share a directly connected subnet to become neighbors.');

      const protoName = protocol.toUpperCase();
      const desc = {
        ospf: 'OSPF (link-state): routers flood LSAs and build a shortest-path tree (SPF).',
        eigrp: 'EIGRP (advanced distance-vector): neighbors exchange routes with metrics (bandwidth/delay).',
        bgp: 'BGP (path-vector): peers exchange network prefixes between autonomous systems (AS).',
        isis: 'IS-IS (link-state): routers exchange LSPs and compute shortest paths, similar to OSPF but at Layer 2.'
      }[protocol] || 'Dynamic routing exchanges reachability information.';
      log('ip', 'Starting ' + protoName + ' on routers.', desc);

      for (const pair of pairs) {
        check(token);
        const path = { segments: [{ from: pair.a.id, fromPort: pair.pa.id, to: pair.b.id, toPort: pair.pb.id, linkId: pair.link.id }] };
        const back = reversePath(path);
        const hello = protocol === 'bgp' ? 'BGP OPEN' : (protocol === 'isis' ? 'IIH Hello' : protoName + ' Hello');
        const update = protocol === 'bgp' ? 'BGP UPDATE' : (protocol === 'ospf' ? 'OSPF LSA' : protocol === 'isis' ? 'IS-IS LSP' : 'EIGRP Update');
        setStatus('running', hello + '…');
        log('ip', pair.a.name + ' ↔ ' + pair.b.name + ': ' + hello + '.', protocol === 'bgp' ? 'BGP peers form a TCP session between AS ' + (pair.a.routing.asn||65001) + ' and AS ' + (pair.b.routing.asn||65002) + '.' : 'Neighbors discover each other and establish adjacency.');
        await sendMsg(path, { type: hello, label: hello, color: 'purple', srcMac: pair.pa.mac, dstMac: pair.pb.mac, srcIp: pair.pa.ip, dstIp: pair.pb.ip, proto: protoName }, token);
        await sendMsg(back, { type: hello, label: hello, color: 'purple', srcMac: pair.pb.mac, dstMac: pair.pa.mac, srcIp: pair.pb.ip, dstIp: pair.pa.ip, proto: protoName }, token);
        await wait(120, token);
        log('ip', 'Exchanging routes: ' + update + '.', protocol === 'bgp' ? 'Each UPDATE advertises prefixes with AS_PATH attributes.' : 'Routers share reachable networks and compute best paths.');
        await sendMsg(path, { type: update, label: update, color: 'cyan', srcMac: pair.pa.mac, dstMac: pair.pb.mac, srcIp: pair.pa.ip, dstIp: pair.pb.ip, proto: protoName }, token);
        await sendMsg(back, { type: update, label: update, color: 'cyan', srcMac: pair.pb.mac, dstMac: pair.pa.mac, srcIp: pair.pb.ip, dstIp: pair.pa.ip, proto: protoName }, token);
        await wait(120, token);
      }

      // Install learned routes: each router learns connected networks of others via neighbor next hops
      for (const pair of pairs) {
        const addLearned = (learner, neighbor, nextHop) => {
          const connected = connectedRoutes(learner).map(r => r.network + '/' + r.prefix);
          const known = new Set(connected.concat((learner.dynamicRoutes||[]).map(r=>r.network+'/'+r.prefix)).concat((learner.staticRoutes||[]).map(r=>ip.network(r.network,r.prefix)+'/'+r.prefix)));
          for (const r of connectedRoutes(neighbor)) {
            const key = r.network + '/' + r.prefix;
            if (known.has(key)) continue;
            if (!ip.valid(nextHop)) continue;
            learner.dynamicRoutes.push({ network: r.network, prefix: r.prefix, gateway: nextHop, proto: protocol, metric: protocol === 'eigrp' ? 90 : 110 });
            known.add(key);
          }
        };
        addLearned(pair.a, pair.b, pair.pb.ip);
        addLearned(pair.b, pair.a, pair.pa.ip);
      }
      // second pass for multi-hop learning
      const pairs2 = routerLinks();
      for (const pair of pairs2) {
        const propagate = (learner, neighbor, nextHop) => {
          const known = new Set(routesOf(learner).map(r=>r.network+'/'+r.prefix));
          for (const r of (neighbor.dynamicRoutes||[])) {
            const key = r.network + '/' + r.prefix;
            if (known.has(key)) continue;
            learner.dynamicRoutes.push({ network: r.network, prefix: r.prefix, gateway: nextHop, proto: protocol, metric: (r.metric||110)+10 });
            known.add(key);
          }
        };
        propagate(pair.a, pair.b, pair.pb.ip);
        propagate(pair.b, pair.a, pair.pa.ip);
      }

      log('ok', protoName + ' converged. Dynamic routes installed on routers.', 'Open each router\'s routing table to see learned networks marked as ' + protocol + '.');
      setStatus('success', protoName + ' converged');
      flags.last = { ok: true, proto: protocol };
      flags.routing[protocol] = true;
      if (NL.hooks && NL.hooks.done) NL.hooks.done({ type: 'routing', ok: true, proto: protocol });
    } catch (err) {
      if (err === CANCEL) { if (token === sim.token) { log('warn','Simulation stopped.',''); setStatus('idle',''); } }
      else if (err && err.soft) { check(token); log('warn', err.message, err.hint); setStatus('failed','Routing failed'); if (NL.hooks && NL.hooks.done) NL.hooks.done({type:'routing',ok:false,message:err.message}); }
      else { console.error(err); log('warn','Something went wrong.',''); setStatus('failed','Simulator error'); }
    } finally { if (token === sim.token) sim.running = false; }
  }

  function protocolDemo(name, srcId, dstId) {
    const demos = {
      tls: {
        title: 'TLS handshake',
        steps: [
          {label:'ClientHello', color:'cyan', proto:'TLS', kind:'ip', text:'ClientHello: client proposes TLS versions and cipher suites.', detail:'TLS secures HTTP (HTTPS). The handshake negotiates encryption before any app data.'},
          {label:'ServerHello', dir:'back', color:'purple', proto:'TLS', kind:'ip', text:'ServerHello + Certificate: server picks a cipher and proves its identity.', detail:'The certificate is signed by a trusted CA so the client can verify the server.'},
          {label:'Key Exchange', color:'amber', proto:'TLS', kind:'ip', text:'Key exchange: both sides derive shared session keys.', detail:'Modern TLS (1.3) uses ephemeral Diffie-Hellman for forward secrecy.'},
          {label:'Finished', dir:'back', color:'green', proto:'TLS', kind:'ok', text:'Handshake finished. Encrypted application data can flow.', detail:'After this, data is confidential and integrity-protected.'}
        ]
      },
      ipsec: {
        title: 'IPsec IKE & ESP',
        steps: [
          {label:'IKE SA Init', color:'cyan', proto:'IKE', kind:'ip', text:'IKE_SA_INIT: peers negotiate crypto parameters and exchange nonces.', detail:'IPsec protects IP packets (VPNs). IKE sets up the secure channel first.'},
          {label:'IKE Auth', dir:'back', color:'purple', proto:'IKE', kind:'ip', text:'IKE_AUTH: peers authenticate and establish the IKE security association.', detail:'Authentication can use certificates or pre-shared keys.'},
          {label:'ESP Tunnel', color:'amber', proto:'ESP', kind:'ip', text:'ESP packets flow: original IP packets are encapsulated and encrypted.', detail:'ESP provides confidentiality, integrity and anti-replay in tunnel or transport mode.'},
          {label:'Protected Data', dir:'back', color:'green', proto:'ESP', kind:'ok', text:'Bidirectional protected traffic is established.', detail:'The tunnel carries data securely across an untrusted network.'}
        ]
      },
      radius: {
        title: 'RADIUS authentication',
        steps: [
          {label:'Access-Request', color:'cyan', proto:'RADIUS', kind:'ip', text:'NAS sends Access-Request with user credentials to the RADIUS server.', detail:'RADIUS centralizes AAA (Authentication, Authorization, Accounting) over UDP.'},
          {label:'Access-Challenge', dir:'back', color:'amber', proto:'RADIUS', kind:'ip', text:'Server may challenge for more proof (e.g. MFA).', detail:'RADIUS can participate in multi-factor flows.'},
          {label:'Access-Request', color:'cyan', proto:'RADIUS', kind:'ip', text:'Client responds to the challenge.', detail:'Credentials are protected with a shared secret hash.'},
          {label:'Access-Accept', dir:'back', color:'green', proto:'RADIUS', kind:'ok', text:'Access-Accept: user is authenticated and authorized.', detail:'The reply can include VLAN, ACLs, or session limits.'}
        ]
      },
      tacacs: {
        title: 'TACACS+ authentication',
        steps: [
          {label:'START', color:'cyan', proto:'TACACS+', kind:'ip', text:'Client sends START requesting authentication.', detail:'TACACS+ separates AAA and runs over TCP (port 49) with full packet encryption.'},
          {label:'GETUSER', dir:'back', color:'purple', proto:'TACACS+', kind:'ip', text:'Server prompts for username.', detail:'Unlike RADIUS, TACACS+ can control each command (authorization).'},
          {label:'CONTINUE', color:'amber', proto:'TACACS+', kind:'ip', text:'Client supplies username/password.', detail:'Each step is a separate exchange, giving fine-grained control.'},
          {label:'PASS', dir:'back', color:'green', proto:'TACACS+', kind:'ok', text:'Server returns PASS: access granted.', detail:'TACACS+ is common for network device administration.'}
        ]
      },
      dot1x: {
        title: '802.1X port authentication',
        steps: [
          {label:'EAPOL-Start', color:'cyan', proto:'802.1X', kind:'ip', text:'Supplicant sends EAPOL-Start to begin authentication.', detail:'802.1X controls access at the port: unauthorized traffic is blocked until auth succeeds.'},
          {label:'EAP-Request/ID', dir:'back', color:'purple', proto:'EAP', kind:'ip', text:'Authenticator requests identity.', detail:'The switch/AP acts as authenticator, relaying to an auth server (often RADIUS).'},
          {label:'EAP-Response', color:'amber', proto:'EAP', kind:'ip', text:'Supplicant responds with identity/credentials.', detail:'EAP methods (PEAP, TLS, etc.) protect the credentials.'},
          {label:'EAP-Success', dir:'back', color:'green', proto:'802.1X', kind:'ok', text:'EAP-Success: port moves to authorized state.', detail:'The device can now access the network (often placed into a VLAN).'}
        ]
      },
      wifi: {
        title: 'Wi-Fi association & WPA2',
        steps: [
          {label:'Probe/Beacon', dir:'back', color:'cyan', proto:'802.11', kind:'ip', text:'AP advertises SSID via beacons; client probes/scans.', detail:'Wi-Fi uses 802.11 management frames to discover networks.'},
          {label:'Auth/Assoc', color:'purple', proto:'802.11', kind:'ip', text:'Client authenticates and associates with the AP.', detail:'Open networks stop here; secured networks continue with key exchange.'},
          {label:'4-Way Handshake', dir:'back', color:'amber', proto:'WPA2', kind:'ip', text:'WPA2 4-way handshake derives encryption keys (PTK/GTK).', detail:'This proves knowledge of the PSK without sending it and installs keys.'},
          {label:'Encrypted Data', color:'green', proto:'802.11', kind:'ok', text:'Secure, encrypted data frames can be exchanged.', detail:'WPA2/WPA3 protect confidentiality and integrity over the air.'}
        ]
      },
      http: { title: 'HTTP request/response', steps: [
        {label:'TCP SYN', color:'cyan', proto:'TCP', kind:'ip', text:'TCP 3-way handshake begins (SYN) to port 80.', detail:'HTTP typically runs over TCP. Reliable, connection-oriented transport.'},
        {label:'SYN-ACK', dir:'back', color:'purple', proto:'TCP', kind:'ip', text:'Server replies SYN-ACK.', detail:'Connection setup before application data.'},
        {label:'HTTP GET', color:'amber', proto:'HTTP', kind:'ip', text:'Client sends HTTP GET request.', detail:'HTTP is stateless request/response for web content (port 80).'},
        {label:'HTTP 200 OK', dir:'back', color:'green', proto:'HTTP', kind:'ok', text:'Server returns HTTP response with content.', detail:'HTTPS would wrap this in TLS (port 443).'}
      ]},
      https: { title: 'HTTPS (HTTP over TLS)', steps: [
        {label:'TCP SYN', color:'cyan', proto:'TCP', kind:'ip', text:'TCP connection to port 443.', detail:'HTTPS = HTTP secured by TLS.'},
        {label:'TLS Handshake', dir:'back', color:'purple', proto:'TLS', kind:'ip', text:'TLS handshake negotiates encryption and authenticates server.', detail:'Certificates establish trust.'},
        {label:'Encrypted HTTP', color:'amber', proto:'HTTPS', kind:'ip', text:'Client sends encrypted HTTP request inside TLS.', detail:'Confidentiality and integrity protected.'},
        {label:'Encrypted Response', dir:'back', color:'green', proto:'HTTPS', kind:'ok', text:'Server returns encrypted HTTP response.', detail:'Only endpoints can read the content.'}
      ]},
      ntp: { title: 'NTP time synchronization', steps: [
        {label:'NTP Request', color:'cyan', proto:'NTP', kind:'ip', text:'Client sends NTP request (UDP/123) to time server.', detail:'NTP synchronizes clocks across networks.'},
        {label:'NTP Response', dir:'back', color:'green', proto:'NTP', kind:'ok', text:'Server replies with timestamps; client adjusts clock/offset.', detail:'Accurate time is critical for logs, auth, and protocols.'}
      ]},
      snmp: { title: 'SNMP monitoring', steps: [
        {label:'SNMP GET', color:'cyan', proto:'SNMP', kind:'ip', text:'Manager sends SNMP GET (UDP/161) for device metrics.', detail:'SNMP monitors/manages network devices via MIB/OIDs.'},
        {label:'SNMP Response', dir:'back', color:'green', proto:'SNMP', kind:'ok', text:'Agent returns requested values.', detail:'SNMPv3 adds authentication and encryption; traps/informs notify events (162).'}
      ]},
      syslog: { title: 'Syslog event logging', steps: [
        {label:'Syslog Message', color:'amber', proto:'Syslog', kind:'ip', text:'Device sends a syslog event (UDP/514, or TCP/TLS in modern setups).', detail:'Centralized logs help operations, auditing, and troubleshooting.'},
        {label:'Stored', dir:'back', color:'green', proto:'Syslog', kind:'ok', text:'Syslog server stores and indexes the event.', detail:'Severity/facility fields categorize messages.'}
      ]},
      ssh: { title: 'SSH secure remote access', steps: [
        {label:'TCP SYN (22)', color:'cyan', proto:'TCP', kind:'ip', text:'Client initiates TCP connection to SSH port 22.', detail:'SSH provides encrypted remote CLI access.'},
        {label:'Key Exchange', dir:'back', color:'purple', proto:'SSH', kind:'ip', text:'Server and client negotiate keys and algorithms.', detail:'Protects confidentiality and integrity; replaces Telnet.'},
        {label:'Auth/Session', color:'green', proto:'SSH', kind:'ok', text:'User authenticates and gets an encrypted shell session.', detail:'Can also tunnel other traffic (port forwarding).'}
      ]},
      ftp: { title: 'FTP file transfer', steps: [
        {label:'Control (21)', color:'cyan', proto:'FTP', kind:'ip', text:'Client opens FTP control channel on TCP/21.', detail:'FTP uses separate control and data channels.'},
        {label:'Data Channel', dir:'back', color:'amber', proto:'FTP', kind:'ip', text:'Server/client establish data channel for transfer (active/passive modes).', detail:'Credentials/data are plaintext in classic FTP; SFTP/FTPS add security.'},
        {label:'Transfer Complete', color:'green', proto:'FTP', kind:'ok', text:'File data transferred successfully.', detail:'Use secure alternatives when possible.'}
      ]},
      smtp: { title: 'SMTP email delivery', steps: [
        {label:'EHLO/MAIL', color:'cyan', proto:'SMTP', kind:'ip', text:'Client connects to SMTP (TCP/25, submission 587) and starts mail transaction.', detail:'SMTP transfers email between servers/clients.'},
        {label:'RCPT/DATA', color:'amber', proto:'SMTP', kind:'ip', text:'Sender specifies recipients and message data.', detail:'Often secured with STARTTLS or implicit TLS (465).'},
        {label:'250 OK', dir:'back', color:'green', proto:'SMTP', kind:'ok', text:'Server accepts the message for delivery.', detail:'POP3/IMAP are commonly used for retrieval by clients.'}
      ]},
      dhcpv6: { title: 'DHCPv6 (stateful)', steps: [
        {label:'Solicit', color:'cyan', proto:'DHCPv6', kind:'ip', text:'Client multicasts Solicit to locate DHCPv6 servers.', detail:'IPv6 can use DHCPv6 (stateful) and/or SLAAC for addressing.'},
        {label:'Advertise', dir:'back', color:'purple', proto:'DHCPv6', kind:'ip', text:'Server Advertises available configuration.', detail:'Provides addresses and options like DNS servers.'},
        {label:'Request', color:'amber', proto:'DHCPv6', kind:'ip', text:'Client Requests configuration/lease.', detail:'Similar purpose to DHCPv4 but different messages/transport.'},
        {label:'Reply', dir:'back', color:'green', proto:'DHCPv6', kind:'ok', text:'Server Replies with assigned IPv6 configuration.', detail:'Often paired with other IPv6 mechanisms (RA/ND).'}
      ]},
      slaac: { title: 'IPv6 SLAAC & Neighbor Discovery', steps: [
        {label:'Router Solicitation', color:'cyan', proto:'ICMPv6', kind:'ip', text:'Host sends Router Solicitation (RS).', detail:'IPv6 hosts can autoconfigure addresses using SLAAC.'},
        {label:'Router Advertisement', dir:'back', color:'purple', proto:'ICMPv6', kind:'ip', text:'Router sends Router Advertisement (RA) with prefix info.', detail:'Host forms an address from the advertised prefix.'},
        {label:'Neighbor Solicitation', color:'amber', proto:'ICMPv6', kind:'ip', text:'Host performs Duplicate Address Detection / Neighbor Discovery.', detail:'Neighbor Discovery replaces ARP in IPv6.'},
        {label:'Configured', dir:'back', color:'green', proto:'IPv6', kind:'ok', text:'Host has an IPv6 address and can communicate on-link.', detail:'DHCPv6 may still provide additional options (e.g. DNS).'}
      ]},
      wpa3: { title: 'Wi-Fi WPA3 (SAE) association', steps: [
        {label:'Beacon/Probe', dir:'back', color:'cyan', proto:'802.11', kind:'ip', text:'AP advertises WPA3-capable network; client discovers it.', detail:'WPA3 improves Wi-Fi security over WPA2.'},
        {label:'SAE Commit', color:'purple', proto:'WPA3-SAE', kind:'ip', text:'Client and AP perform SAE (Simultaneous Authentication of Equals).', detail:'SAE resists offline password guessing and provides forward secrecy.'},
        {label:'SAE Confirm', dir:'back', color:'amber', proto:'WPA3-SAE', kind:'ip', text:'Peers confirm and derive keys.', detail:'Stronger protection for personal networks.'},
        {label:'Secure Data', color:'green', proto:'802.11', kind:'ok', text:'Encrypted association is established; data can flow securely.', detail:'Enterprise WPA3 builds on 802.1X/EAP as well.'}
      ]}
    };
    const d = demos[name];
    if (!d) return;
    return demoSequence(srcId, dstId, d.steps, d.title);
  }

  sim.ping = ping;
  sim.dhcp = dhcpRequest;
  sim.udp = udpSend;
  sim.routing = runRouting;
  sim.demo = protocolDemo;
  sim.trace = traceroute;
  sim.dns = dnsQuery;
  sim.pause = function () {
    if (!sim.running || sim.paused) return;
    sim.paused = true;
    setStatus('paused', 'Paused — press play to continue');
  };
  sim.resume = function () {
    if (!sim.paused) return;
    sim.paused = false;
    sim.stepPulse = false;
    releasePause();
    if (sim.running) setStatus('running', 'Running…');
  };
  sim.stepOnce = function () {
    if (!sim.running) return;
    if (sim.paused) {
      sim.stepPulse = true;
      sim.paused = false;
      releasePause();
      setStatus('running', 'Stepping…');
    } else {
      sim.paused = true;
      setStatus('paused', 'Paused — press Step to advance one hop');
    }
  };
  sim.cancel = function () {
    sim.token++;
    sim.running = false;
    sim.paused = false;
    sim.stepPulse = false;
    releasePause();
    setStatus('idle', '');
  };

  NL.sim = sim;
  NL.flags = flags;

  NL.resetTrafficFlags = function () {
    flags.pings = {};
    flags.routed = false;
    flags.macLearned = false;
    flags.dhcp = false;
    flags.last = null;
    flags.lastDhcp = null;
  };

  NL.resetFlags = function () {
    NL.resetTrafficFlags();
    flags.dns = {};
    flags.traces = {};
    flags.demos = {};
    flags.udp = {};
    flags.routing = {};
    flags.aclDenied = false;
    flags.aclDenyAdded = false;
    flags.aclPermitAdded = false;
  };

  // Expose a couple of helpers the UI uses.
  NL.log = log;
  NL.setFrame = setFrame;
  NL.setStatus = setStatus;
})();
