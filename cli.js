/* NetLab teaching CLI — an IOS-style command parser backed by the lab model. */
window.NL = window.NL || {};
(function () {
  'use strict';
  const NL = window.NL;

  // Every catalog entry is shown in the searchable Network+ command reference.
  // `live` means NetLab can actually run the command; the rest are exam reference.
  const CATALOG = [
    // ---------- navigation & help ----------
    { id: 'help', group: 'Navigation & help', syntax: '?', desc: 'List the commands available in the current mode.', example: '?', tip: 'IOS uses ? for context help. Type "show ?" to see every show option.', live: true },
    { id: 'help-word', group: 'Navigation & help', syntax: 'help', desc: 'Show help for the command system.', example: 'help', tip: 'Equivalent to ? in most IOS modes.', live: true },
    { id: 'enable', group: 'Navigation & help', syntax: 'enable', desc: 'Enter privileged EXEC mode (#).', example: 'enable', tip: 'The > prompt is user EXEC; # is privileged EXEC. Configuration requires #.', live: true },
    { id: 'disable', group: 'Navigation & help', syntax: 'disable', desc: 'Return to user EXEC mode (>).', example: 'disable', tip: 'You cannot enter configure terminal from >.', live: true },
    { id: 'exit', group: 'Navigation & help', syntax: 'exit', desc: 'Leave the current configuration mode, one level at a time.', example: 'exit', tip: 'From interface config, exit returns to global config; one more exit returns to EXEC.', live: true },
    { id: 'end', group: 'Navigation & help', syntax: 'end', desc: 'Return directly to privileged EXEC mode.', example: 'end', tip: 'Ctrl+Z does the same thing on a real router.', live: true },
    { id: 'configure-terminal', group: 'Navigation & help', syntax: 'configure terminal', desc: 'Enter global configuration mode.', example: 'configure terminal', tip: 'Abbreviated as conf t. Changes here affect the running configuration.', live: true },
    { id: 'hostname', group: 'Navigation & help', syntax: 'hostname <name>', desc: 'Change the device name shown in the prompt.', example: 'hostname R1', tip: 'The hostname is locally significant; it is not DNS.', live: true },
    { id: 'history', group: 'Navigation & help', syntax: 'history', desc: 'Show the commands you entered.', example: 'history', tip: 'Use the Up/Down arrow keys to recall commands.', live: true },
    { id: 'clear-screen', group: 'Navigation & help', syntax: 'clear screen', desc: 'Clear the console output.', example: 'clear screen', tip: 'Also accepted: cls.', live: true },
    { id: 'terminal-length', group: 'Navigation & help', syntax: 'terminal length 0', desc: 'Disable page pauses in terminal output.', example: 'terminal length 0', tip: 'Handy before capturing long "show" output.', live: true },
    { id: 'write-memory', group: 'Navigation & help', syntax: 'write memory', desc: 'Save the running configuration.', example: 'write memory', tip: 'On real IOS this copies running-config to startup-config. NetLab saves to this browser.', live: true },
    { id: 'copy-run-start', group: 'Navigation & help', syntax: 'copy running-config startup-config', desc: 'Save the running configuration to NVRAM.', example: 'copy running-config startup-config', tip: 'Same result as write memory on IOS.', live: true },
    { id: 'reload', group: 'Navigation & help', syntax: 'reload', desc: 'Restart the device and load startup-config.', example: 'reload', tip: 'Not executed in NetLab — it would wipe the teaching state.', live: false },

    // ---------- show: interfaces & layer 2 ----------
    { id: 'show-running-config', group: 'Show · interfaces & Layer 2', syntax: 'show running-config', desc: 'Display the current configuration.', example: 'show running-config', tip: 'Abbreviated as sh run. Compare it with show startup-config on a real device.', live: true },
    { id: 'show-ip-interface-brief', group: 'Show · interfaces & Layer 2', syntax: 'show ip interface brief', desc: 'One-line IP and status summary for every interface.', example: 'show ip interface brief', tip: 'Abbreviated as sh ip int br — the most useful first command in a lab.', live: true },
    { id: 'show-interfaces', group: 'Show · interfaces & Layer 2', syntax: 'show interfaces', desc: 'Detailed interface status, MAC and counters.', example: 'show interfaces Gi0/0', tip: 'Add an interface name to focus on one port. NetLab shows simplified counters.', live: true },
    { id: 'show-mac-table', group: 'Show · interfaces & Layer 2', syntax: 'show mac address-table', desc: 'Show the switch MAC address table.', example: 'show mac address-table', tip: 'Switches learn source MACs. A blank table means no frames have arrived yet.', live: true },
    { id: 'show-arp', group: 'Show · interfaces & Layer 2', syntax: 'show arp', desc: 'Show the IPv4-to-MAC resolution cache.', example: 'show arp', tip: 'ARP resolves the next-hop IP to a MAC on the local link only.', live: true },
    { id: 'show-vlan-brief', group: 'Show · interfaces & Layer 2', syntax: 'show vlan brief', desc: 'Show VLAN membership for switch ports.', example: 'show vlan brief', tip: 'Access ports carry one VLAN; trunk ports carry a list of allowed VLANs.', live: true },
    { id: 'show-spanning-tree', group: 'Show · interfaces & Layer 2', syntax: 'show spanning-tree', desc: 'Show the spanning-tree root and port states.', example: 'show spanning-tree', tip: 'STP prevents Layer 2 loops by blocking redundant paths. NetLab shows a simplified view.', live: true },
    { id: 'show-cdp-neighbors', group: 'Show · interfaces & Layer 2', syntax: 'show cdp neighbors', desc: 'Show directly connected Cisco-style neighbors.', example: 'show cdp neighbors', tip: 'CDP is Cisco-proprietary; LLDP is the vendor-neutral equivalent.', live: true },
    { id: 'show-lldp-neighbors', group: 'Show · interfaces & Layer 2', syntax: 'show lldp neighbors', desc: 'Show directly connected LLDP neighbors.', example: 'show lldp neighbors', tip: 'LLDP runs at Layer 2 and reveals the connected device and port.', live: true },
    { id: 'show-interface-status', group: 'Show · interfaces & Layer 2', syntax: 'show interfaces status', desc: 'Show port status, VLAN and duplex summarizing all interfaces.', example: 'show interfaces status', tip: 'often used as show int status on switches', live: false },
    { id: 'show-ipv6-interface', group: 'Show · interfaces & Layer 2', syntax: 'show ipv6 interface brief', desc: 'Show IPv6 addresses and interface status.', example: 'show ipv6 interface brief', tip: 'Look for FE80 link-local addresses and 2000::/3 global addresses.', live: false },

    // ---------- show: routing ----------
    { id: 'show-ip-route', group: 'Show · routing', syntax: 'show ip route', desc: 'Show the IPv4 routing table.', example: 'show ip route', tip: 'Codes: C connected, S static, O OSPF, D EIGRP, I IS-IS, B BGP.', live: true },
    { id: 'show-ip-protocols', group: 'Show · routing', syntax: 'show ip protocols', desc: 'Show the active routing protocol and its parameters.', example: 'show ip protocols', tip: 'Administrative distance: connected 0, static 1, EIGRP 90, OSPF 110, IS-IS 115, RIP 120, BGP 20/200.', live: true },
    { id: 'show-ospf-neighbor', group: 'Show · routing', syntax: 'show ip ospf neighbor', desc: 'Show OSPF neighbor adjacencies.', example: 'show ip ospf neighbor', tip: 'OSPF uses area 0 as the backbone and neighbors must agree on area, timers and subnet.', live: true },
    { id: 'show-eigrp-neighbors', group: 'Show · routing', syntax: 'show ip eigrp neighbors', desc: 'Show EIGRP neighbor adjacencies.', example: 'show ip eigrp neighbors', tip: 'EIGRP uses bandwidth and delay by default; its metric is not hop count.', live: true },
    { id: 'show-bgp-summary', group: 'Show · routing', syntax: 'show ip bgp summary', desc: 'Show BGP peers and prefix counts.', example: 'show ip bgp summary', tip: 'BGP is a path-vector EGP; peers use TCP port 179 and AS numbers.', live: true },
    { id: 'show-isis-neighbors', group: 'Show · routing', syntax: 'show isis neighbors', desc: 'Show IS-IS neighbor adjacencies.', example: 'show isis neighbors', tip: 'IS-IS is a link-state IGP that runs directly over Layer 2, not IP.', live: true },
    { id: 'show-ipv6-route', group: 'Show · routing', syntax: 'show ipv6 route', desc: 'Show the IPv6 routing table.', example: 'show ipv6 route', tip: 'Look for ::/0 default routes and directly connected FE80 links.', live: false },
    { id: 'show-ip-rip', group: 'Show · routing', syntax: 'show ip rip database', desc: 'Show routes learned by RIP.', example: 'show ip rip database', tip: 'RIP is distance-vector, max 15 hops, updates every 30 seconds.', live: false },
    { id: 'show-route-map', group: 'Show · routing', syntax: 'show route-map', desc: 'Show route-map policy configuration.', example: 'show route-map', tip: 'Route maps can match and set attributes for redistribution.', live: false },

    // ---------- show: services & security ----------
    { id: 'show-dhcp-binding', group: 'Show · services & security', syntax: 'show ip dhcp binding', desc: 'Show active DHCP leases.', example: 'show ip dhcp binding', tip: 'DORA: Discover, Offer, Request, ACK. Leases are tracked by MAC address.', live: true },
    { id: 'show-dhcp-pool', group: 'Show · services & security', syntax: 'show ip dhcp pool', desc: 'Show DHCP pool settings and utilization.', example: 'show ip dhcp pool', tip: 'A pool needs a network, default router and DNS/lease values on real IOS.', live: false },
    { id: 'show-nat-translations', group: 'Show · services & security', syntax: 'show ip nat translations', desc: 'Show active NAT/PAT translations.', example: 'show ip nat translations', tip: 'PAT maps many inside addresses to one outside IP using port numbers.', live: true },
    { id: 'show-nat-statistics', group: 'Show · services & security', syntax: 'show ip nat statistics', desc: 'Show NAT hit counts and pool usage.', example: 'show ip nat statistics', tip: 'Use with show ip nat translations when troubleshooting address translation.', live: false },
    { id: 'show-access-lists', group: 'Show · services & security', syntax: 'show access-lists', desc: 'Show ACL rules and match counters.', example: 'show access-lists', tip: 'ACLs are processed top-down and end with an implicit deny on real IOS.', live: true },
    { id: 'show-logging', group: 'Show · services & security', syntax: 'show logging', desc: 'Show recent system log messages.', example: 'show logging', tip: 'Syslog severity ranges from 0 (emergency) to 7 (debugging).', live: true },
    { id: 'show-processes-cpu', group: 'Show · services & security', syntax: 'show processes cpu', desc: 'Show CPU utilization and top processes.', example: 'show processes cpu', tip: 'High CPU can indicate a routing loop, flooding or a control-plane attack.', live: false },
    { id: 'show-ntp-status', group: 'Show · services & security', syntax: 'show ntp status', desc: 'Show Network Time Protocol synchronization state.', example: 'show ntp status', tip: 'NTP uses UDP 123; accurate time matters for logs and certificates.', live: false },
    { id: 'show-snmp', group: 'Show · services & security', syntax: 'show snmp', desc: 'Show SNMP agent statistics and community strings.', example: 'show snmp', tip: 'SNMP uses UDP 161; SNMP traps use UDP 162. Prefer SNMPv3.', live: false },
    { id: 'show-ssh', group: 'Show · services & security', syntax: 'show ip ssh', desc: 'Show SSH server version and configuration.', example: 'show ip ssh', tip: 'SSH (TCP 22) replaces Telnet (TCP 23) because it encrypts the session.', live: false },
    { id: 'show-users', group: 'Show · services & security', syntax: 'show users', desc: 'List currently logged-in console and VTY users.', example: 'show users', tip: 'VTY lines are virtual terminal sessions used by SSH/Telnet.', live: false },
    { id: 'show-version', group: 'Show · services & security', syntax: 'show version', desc: 'Show system image, uptime and hardware details.', example: 'show version', tip: 'Exam questions often use show version to find the IOS image or last reboot reason.', live: true },
    { id: 'show-clock', group: 'Show · services & security', syntax: 'show clock', desc: 'Show the system date and time.', example: 'show clock', tip: 'Timestamps in logs are only useful when the clock is correct.', live: true },
    { id: 'show-ipv6-neighbors', group: 'Show · services & security', syntax: 'show ipv6 neighbors', desc: 'Show IPv6 neighbor discovery cache.', example: 'show ipv6 neighbors', tip: 'This is the IPv6 equivalent of the ARP cache.', live: false },

    // ---------- troubleshoot ----------
    { id: 'ping', group: 'Troubleshooting', syntax: 'ping <ip|name>', desc: 'Send an ICMP echo request and watch for a reply.', example: 'ping 192.168.1.20', tip: 'Start with the gateway, then a remote host. A failure narrows where the path breaks.', live: true },
    { id: 'traceroute', group: 'Troubleshooting', syntax: 'traceroute <ip|name>', desc: 'Discover the hop-by-hop path to a destination.', example: 'traceroute 10.0.0.2', tip: 'Each router that drops an expired probe replies with ICMP Time Exceeded.', live: true },
    { id: 'clear-mac-table', group: 'Troubleshooting', syntax: 'clear mac address-table', desc: 'Clear learned MAC addresses.', example: 'clear mac address-table', tip: 'Useful after moving a device to a different switch port.', live: true },
    { id: 'clear-arp', group: 'Troubleshooting', syntax: 'clear arp-cache', desc: 'Clear the ARP cache.', example: 'clear arp-cache', tip: 'Stale ARP entries can point a MAC to the wrong port.', live: true },
    { id: 'clear-ip-route', group: 'Troubleshooting', syntax: 'clear ip route *', desc: 'Flush learned routes so routing reconverges.', example: 'clear ip route *', tip: 'NetLab clears dynamic routes; static and connected routes remain.', live: true },
    { id: 'clear-counters', group: 'Troubleshooting', syntax: 'clear counters', desc: 'Reset interface counters to zero.', example: 'clear counters', tip: 'Reset counters, wait, then check again to isolate a current problem.', live: false },
    { id: 'debug-ip-packet', group: 'Troubleshooting', syntax: 'debug ip packet', desc: 'Display packets processed by the CPU in real time.', example: 'debug ip packet', tip: 'Use sparingly on production gear — debugging can consume CPU.', live: false },
    { id: 'debug-ospf', group: 'Troubleshooting', syntax: 'debug ip ospf events', desc: 'Display OSPF adjacency and LSA events.', example: 'debug ip ospf events', tip: 'Neighbors stuck in EXSTART often disagree on MTU or router ID.', live: false },
    { id: 'debug-eigrp', group: 'Troubleshooting', syntax: 'debug eigrp packets', desc: 'Display EIGRP hello and update packets.', example: 'debug eigrp packets', tip: 'EIGRP neighbors must agree on AS number and K values.', live: false },
    { id: 'debug-bgp', group: 'Troubleshooting', syntax: 'debug bgp updates', desc: 'Display BGP UPDATE messages.', example: 'debug bgp updates', tip: 'BGP peers must agree on AS, address family and authentication if used.', live: false },
    { id: 'debug-dot1x', group: 'Troubleshooting', syntax: 'debug dot1x events', desc: 'Display 802.1X authentication events.', example: 'debug dot1x events', tip: '802.1X uses EAPOL between supplicant and authenticator, RADIUS to the server.', live: false },
    { id: 'undebug-all', group: 'Troubleshooting', syntax: 'undebug all', desc: 'Turn off all debugging.', example: 'undebug all', tip: 'Abbreviated as u all. Always turn debugging off when finished.', live: true },

    // ---------- configuration ----------
    { id: 'interface', group: 'Configuration', syntax: 'interface <name>', desc: 'Enter interface configuration mode.', example: 'interface Gi0/0', tip: 'Abbreviated as int. The prompt changes to (config-if)#.', live: true },
    { id: 'ip-address', group: 'Configuration', syntax: 'ip address <ip> <mask>', desc: 'Assign an IPv4 address and mask to the interface.', example: 'ip address 192.168.1.1 255.255.255.0', tip: 'A /24 prefix can also be given as 255.255.255.0. Use no ip address to remove it.', live: true },
    { id: 'no-ip-address', group: 'Configuration', syntax: 'no ip address', desc: 'Remove the interface IPv4 address.', example: 'no ip address', tip: 'IOS uses the no form to undo almost any configuration command.', live: true },
    { id: 'shutdown', group: 'Configuration', syntax: 'shutdown', desc: 'Administratively disable the interface.', example: 'shutdown', tip: 'A shut interface shows administratively down/down.', live: true },
    { id: 'no-shutdown', group: 'Configuration', syntax: 'no shutdown', desc: 'Enable the interface.', example: 'no shutdown', tip: 'Abbreviated as no shut. New router interfaces often start shut.', live: true },
    { id: 'description', group: 'Configuration', syntax: 'description <text>', desc: 'Add a local description to an interface.', example: 'description link to R2', tip: 'Descriptions do not affect forwarding but help documentation.', live: true },
    { id: 'default-gateway', group: 'Configuration', syntax: 'ip default-gateway <ip>', desc: 'Set the gateway for a host or switch management IP.', example: 'ip default-gateway 192.168.1.1', tip: 'Routers use routing tables instead; this is mainly for end devices and switches.', live: true },
    { id: 'switchport-mode', group: 'Configuration', syntax: 'switchport mode <access|trunk>', desc: 'Set a switch port to access or trunk mode.', example: 'switchport mode trunk', tip: 'Access ports carry one VLAN; trunks tag frames with 802.1Q.', live: true },
    { id: 'switchport-access-vlan', group: 'Configuration', syntax: 'switchport access vlan <id>', desc: 'Assign an access port to a VLAN.', example: 'switchport access vlan 20', tip: 'The connected device is usually unaware of the VLAN tag.', live: true },
    { id: 'switchport-trunk-vlans', group: 'Configuration', syntax: 'switchport trunk allowed vlan <list>', desc: 'Limit which VLANs cross a trunk.', example: 'switchport trunk allowed vlan 1,10,20', tip: 'Pruning unused VLANs reduces unnecessary flooding and improves security.', live: true },
    { id: 'vlan', group: 'Configuration', syntax: 'vlan <id>', desc: 'Create or enter a VLAN configuration mode.', example: 'vlan 20', tip: 'Valid VLAN IDs are 1–4094; VLAN 1 exists by default.', live: true },
    { id: 'vlan-name', group: 'Configuration', syntax: 'name <text>', desc: 'Name the VLAN in VLAN configuration mode.', example: 'name Sales', tip: 'Names are locally significant and must match on both ends only if you use VTP.', live: true },
    { id: 'ip-route', group: 'Configuration', syntax: 'ip route <network> <mask> <next-hop>', desc: 'Add a static route.', example: 'ip route 192.168.2.0 255.255.255.0 10.0.0.2', tip: 'Static routes have AD 1. A directly attached next hop is required.', live: true },
    { id: 'no-ip-route', group: 'Configuration', syntax: 'no ip route <network> <mask> <next-hop>', desc: 'Remove a static route.', example: 'no ip route 192.168.2.0 255.255.255.0 10.0.0.2', tip: 'Copy the exact line from show running-config.', live: true },
    { id: 'router-ospf', group: 'Configuration', syntax: 'router ospf <process>', desc: 'Start OSPF and enter router configuration mode.', example: 'router ospf 1', tip: 'OSPF is link-state, uses area 0, AD 110, and multicasts 224.0.0.5/6.', live: true },
    { id: 'router-eigrp', group: 'Configuration', syntax: 'router eigrp <as>', desc: 'Start EIGRP and enter router configuration mode.', example: 'router eigrp 100', tip: 'EIGRP is advanced distance-vector, AD 90, metric uses bandwidth and delay.', live: true },
    { id: 'router-bgp', group: 'Configuration', syntax: 'router bgp <as>', desc: 'Start BGP and enter router configuration mode.', example: 'router bgp 65001', tip: 'BGP is path-vector, uses TCP 179, eBGP AD 20 / iBGP AD 200.', live: true },
    { id: 'router-isis', group: 'Configuration', syntax: 'router isis', desc: 'Start IS-IS and enter router configuration mode.', example: 'router isis', tip: 'IS-IS is link-state, AD 115, and runs directly over OSI Layer 2.', live: true },
    { id: 'network-area', group: 'Configuration', syntax: 'network <network> <wildcard> area <id>', desc: 'Enable OSPF on matching interfaces in an area.', example: 'network 10.0.0.0 0.0.0.255 area 0', tip: 'The wildcard mask is the inverse of a subnet mask: /24 = 0.0.0.255.', live: true },
    { id: 'neighbor-remote-as', group: 'Configuration', syntax: 'neighbor <ip> remote-as <as>', desc: 'Define a BGP peer and its autonomous system.', example: 'neighbor 10.0.0.2 remote-as 65002', tip: 'Different AS numbers mean eBGP; the same AS means iBGP.', live: true },
    { id: 'ip-host', group: 'Configuration', syntax: 'ip host <name> <ip>', desc: 'Add a local hostname-to-IP entry.', example: 'ip host web.local 192.168.1.10', tip: 'A local host table is checked before DNS queries on IOS.', live: true },
    { id: 'no-ip-host', group: 'Configuration', syntax: 'no ip host <name>', desc: 'Remove a local host entry.', example: 'no ip host web.local', tip: 'Use no forms to reverse configuration exactly.', live: true },
    { id: 'enable-secret', group: 'Configuration', syntax: 'enable secret <password>', desc: 'Set the encrypted privileged EXEC password.', example: 'enable secret class', tip: 'enable secret uses hashing; enable password is older and weaker.', live: false },
    { id: 'username', group: 'Configuration', syntax: 'username <name> secret <password>', desc: 'Create a local user account.', example: 'username admin secret cisco', tip: 'Local accounts support AAA and SSH login.', live: false },
    { id: 'line-vty', group: 'Configuration', syntax: 'line vty 0 4', desc: 'Enter virtual terminal line configuration mode.', example: 'line vty 0 4', tip: 'VTY lines control remote access (SSH/Telnet), not the console port.', live: false },
    { id: 'transport-ssh', group: 'Configuration', syntax: 'transport input ssh', desc: 'Allow only SSH on VTY lines.', example: 'transport input ssh', tip: 'Always prefer SSH over Telnet because Telnet sends passwords in cleartext.', live: false },
    { id: 'banner-motd', group: 'Configuration', syntax: 'banner motd #<text>#', desc: 'Set the message-of-the-day banner.', example: 'banner motd #Authorized users only#', tip: 'Use a delimiter character that does not appear in the banner text.', live: false },
    { id: 'service-password-encryption', group: 'Configuration', syntax: 'service password-encryption', desc: 'Obfuscate plaintext passwords in the configuration.', example: 'service password-encryption', tip: 'This is weak obfuscation; enable secret uses a real hash.', live: false },
    { id: 'ip-name-server', group: 'Configuration', syntax: 'ip name-server <ip>', desc: 'Configure a DNS server address.', example: 'ip name-server 8.8.8.8', tip: 'DNS uses UDP 53 for normal queries and TCP 53 for large transfers.', live: false },
    { id: 'ntp-server', group: 'Configuration', syntax: 'ntp server <ip>', desc: 'Configure an NTP time source.', example: 'ntp server 192.168.1.1', tip: 'Time synchronization keeps logs, certificates and token authentication valid.', live: false },
    { id: 'snmp-community', group: 'Configuration', syntax: 'snmp-server community <string> ro', desc: 'Set an SNMP read-only community string.', example: 'snmp-server community public ro', tip: 'SNMPv1/v2c communities are cleartext; use SNMPv3 where possible.', live: false },
    { id: 'logging-host', group: 'Configuration', syntax: 'logging host <ip>', desc: 'Send syslog messages to a remote server.', example: 'logging host 192.168.1.50', tip: 'Syslog uses UDP 514; severity 0 is most urgent, 7 is debugging.', live: false },
    { id: 'ipv6-unicast-routing', group: 'Configuration', syntax: 'ipv6 unicast-routing', desc: 'Enable IPv6 routing and router advertisements.', example: 'ipv6 unicast-routing', tip: 'Without this, a router will not forward IPv6 between interfaces.', live: false },
    { id: 'ipv6-address', group: 'Configuration', syntax: 'ipv6 address <address>/<prefix>', desc: 'Assign an IPv6 address to an interface.', example: 'ipv6 address 2001:db8::1/64', tip: 'LANs normally use /64 so SLAAC can build the interface ID.', live: false },
    { id: 'ipv6-route', group: 'Configuration', syntax: 'ipv6 route <prefix> <next-hop>', desc: 'Add a static IPv6 route.', example: 'ipv6 route 2001:db8:1::/48 2001:db8::2', tip: '::/0 is the IPv6 default route.', live: false },
    { id: 'ip-dhcp-pool', group: 'Configuration', syntax: 'ip dhcp pool <name>', desc: 'Create a DHCP pool and enter DHCP config mode.', example: 'ip dhcp pool LAN', tip: 'Inside the pool: network, default-router, dns-server and lease.', live: false },
    { id: 'ip-nat-inside', group: 'Configuration', syntax: 'ip nat inside source list <acl> interface <iface> overload', desc: 'Configure PAT overload on an interface.', example: 'ip nat inside source list 1 interface Gi0/0 overload', tip: 'Also mark interfaces with ip nat inside and ip nat outside.', live: false },
    { id: 'access-list', group: 'Configuration', syntax: 'access-list <num> permit|deny <src> <wildcard>', desc: 'Create a numbered standard ACL.', example: 'access-list 10 deny 192.168.2.0 0.0.0.255', tip: 'Standard ACLs (1–99) filter by source only; place them close to the destination.', live: false },
    { id: 'spanning-tree-portfast', group: 'Configuration', syntax: 'spanning-tree portfast', desc: 'Skip STP listening/learning on an access port.', example: 'spanning-tree portfast', tip: 'Use only on ports connected to end hosts — never on a port toward another switch.', live: false },
    { id: 'channel-group', group: 'Configuration', syntax: 'channel-group <id> mode active', desc: 'Add an interface to an EtherChannel using LACP.', example: 'channel-group 1 mode active', tip: 'LACP is 802.3ad; it bundles links for more bandwidth and redundancy.', live: false },
    { id: 'crypto-isakmp', group: 'Configuration', syntax: 'crypto isakmp policy <priority>', desc: 'Define an IKE phase 1 policy for IPsec.', example: 'crypto isakmp policy 10', tip: 'Phase 1 builds a secure channel; phase 2 builds the IPsec SAs.', live: false },
    { id: 'copy-start-run', group: 'Configuration', syntax: 'copy startup-config running-config', desc: 'Merge saved configuration into the running configuration.', example: 'copy startup-config running-config', tip: 'Useful after a rollback; does not erase lines that are only in running-config.', live: false },
    { id: 'erase-startup', group: 'Configuration', syntax: 'erase startup-config', desc: 'Delete the saved startup configuration.', example: 'erase startup-config', tip: 'Follow with reload to return a device to factory defaults.', live: false }
  ];

  const CATALOG_BY_ID = {};
  CATALOG.forEach(c => { CATALOG_BY_ID[c.id] = c; });

  function tokenize(line) {
    const tokens = [];
    let cur = '';
    let quote = null;
    for (const ch of String(line || '').trim()) {
      if (quote) {
        if (ch === quote) quote = null;
        else cur += ch;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (/\s/.test(ch)) {
        if (cur) { tokens.push(cur); cur = ''; }
      } else cur += ch;
    }
    if (cur) tokens.push(cur);
    return tokens;
  }

  function lower(value) { return String(value == null ? '' : value).toLowerCase(); }

  // A pattern token starting with ":" is an argument. Literal tokens accept
  // IOS-style abbreviations ("sh ip int br" -> "show ip interface brief").
  function matchExact(pattern, tokens) {
    if (pattern.length !== tokens.length) return null;
    const args = {};
    for (let i = 0; i < pattern.length; i++) {
      const p = pattern[i], t = tokens[i];
      if (p.charAt(0) === ':') { args[p.slice(1)] = t; continue; }
      if (lower(p) !== lower(t) && !lower(p).startsWith(lower(t))) return null;
    }
    return args;
  }

  function matchPrefix(pattern, tokens) {
    if (tokens.length > pattern.length) return false;
    for (let i = 0; i < tokens.length; i++) {
      const p = pattern[i], t = tokens[i];
      if (p.charAt(0) === ':') continue;
      if (lower(p) !== lower(t) && !lower(p).startsWith(lower(t))) return false;
    }
    return true;
  }

  function prefixFromMask(mask) {
    if (/^\d{1,2}$/.test(mask)) {
      const n = Number(mask);
      return n >= 0 && n <= 32 ? n : -1;
    }
    const value = NL.ip.toInt(mask);
    if (value === null) return -1;
    let ones = 0;
    for (let bit = 31; bit >= 0; bit--) {
      if ((value >>> bit) & 1) ones++;
      else break;
    }
    // Reject non-contiguous masks such as 255.0.255.0.
    const expected = ones === 0 ? 0 : (0xffffffff << (32 - ones)) >>> 0;
    return expected === value ? ones : -1;
  }

  function prefixFromWildcard(wildcard) {
    const value = NL.ip.toInt(wildcard);
    if (value === null) return -1;
    // An OSPF wildcard is the bitwise inverse of the subnet mask.
    // 0.0.0.255 -> 255.255.255.0 -> /24.
    return prefixFromMask(NL.ip.fromInt((~value) >>> 0));
  }

  function pad(value, width) {
    const s = String(value == null ? '' : value);
    return s + ' '.repeat(Math.max(0, width - s.length));
  }

  function editDistance(a, b) {
    a = lower(a); b = lower(b);
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = dp[j];
        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return dp[b.length];
  }

  function nowString() {
    const d = new Date();
    return d.toUTCString().replace('GMT', 'UTC');
  }

  NL.cli = {
    catalog: CATALOG,

    // Return a filtered copy of the command reference.
    reference(query) {
      const q = lower(query || '').trim();
      if (!q) return CATALOG.map(c => Object.assign({}, c));
      return CATALOG.filter(c =>
        lower(c.syntax).includes(q) || lower(c.desc).includes(q) ||
        lower(c.group).includes(q) || lower(c.tip).includes(q) ||
        lower(c.example).includes(q)
      ).map(c => Object.assign({}, c));
    },

    create(options) {
      options = options || {};
      const ctx = {
        deviceId: options.deviceId || null,
        mode: 'exec',
        privileged: true,
        iface: null,
        router: null,
        vlanId: null,
        history: []
      };

      function device() { return NL.model.getDevice(ctx.deviceId); }
      function out(lines, text, kind) { lines.push({ text: String(text == null ? '' : text), kind: kind || '' }); }
      function modeError(lines, command) {
        out(lines, '% Invalid input detected — "' + command + '" is not available in ' + modeLabel() + '.', 'err');
        out(lines, 'Use "exit" to step back or "end" to return to EXEC mode.', 'dim');
      }
      function privError(lines) {
        out(lines, '% Incomplete command or insufficient privileges.', 'err');
        out(lines, 'Type "enable" first to enter privileged EXEC mode (#).', 'dim');
      }
      function modeLabel() {
        return ({ exec: 'EXEC', config: 'global config', interface: 'interface config', router: 'router config', vlan: 'VLAN config' })[ctx.mode] || ctx.mode;
      }
      function prompt() {
        const dev = device();
        const name = dev ? String(dev.name).replace(/\s+/g, '') : 'none';
        const suffix = ctx.mode === 'config' ? '(config)' :
          ctx.mode === 'interface' ? '(config-if)' :
          ctx.mode === 'router' ? '(config-router)' :
          ctx.mode === 'vlan' ? '(config-vlan)' : '';
        return name + suffix + (ctx.privileged ? '#' : '>');
      }
      function needDevice(lines) {
        const dev = device();
        if (!dev) out(lines, '% No device selected. Choose a device in the console header or click one in the lab.', 'err');
        return dev;
      }
      function needPort(lines, name) {
        const dev = needDevice(lines);
        if (!dev) return null;
        const want = lower(name);
        const port = dev.ports.find(p => lower(p.name) === want);
        if (!port) {
          out(lines, '% Interface ' + name + ' not found on ' + dev.name + '.', 'err');
          out(lines, 'Available: ' + dev.ports.map(p => p.name).join(', '), 'dim');
        }
        return port;
      }
      function changed(result) { result.changed = true; }
      function referenceOnly(lines, id) {
        const c = CATALOG_BY_ID[id];
        out(lines, c ? c.syntax : 'That command', 'info');
        out(lines, c ? c.desc : '', 'dim');
        out(lines, 'This is in the Network+ command reference; NetLab does not simulate it.', 'warn');
        if (c && c.tip) out(lines, 'Exam tip: ' + c.tip, 'dim');
      }

      function resolveTarget(lines, token) {
        const dev = needDevice(lines);
        if (!dev) return null;
        if (NL.ip.valid(token)) {
          const found = NL.model.findByIp(token);
          if (found) return found.device;
          out(lines, '% No device in this lab uses ' + token + '.', 'err');
          return null;
        }
        const rec = NL.model.dnsResolveName(token);
        if (rec) {
          const found = NL.model.findByIp(rec.ip);
          if (found) return found.device;
          out(lines, '% DNS resolved ' + token + ' to ' + rec.ip + ', but no lab device has that address.', 'err');
          return null;
        }
        const byName = NL.model.state.devices.find(d => lower(d.name) === lower(token) || lower(d.name).replace(/\s+/g, '') === lower(token));
        if (byName) return byName;
        out(lines, '% Could not resolve "' + token + '" to an IP or a lab device.', 'err');
        const near = NL.model.state.devices.map(d => d.name).filter(n => lower(n).includes(lower(token.slice(0, 3)))).slice(0, 4);
        if (near.length) out(lines, 'Did you mean: ' + near.join(', ') + '?', 'dim');
        return null;
      }

      function showHelp(lines, tokens) {
        const prefix = tokens.filter(t => t !== '?');
        const available = ROUTES.filter(r => !r.hidden &&
          (r.modes || ['exec']).indexOf(ctx.mode) >= 0 &&
          (!r.priv || ctx.privileged) &&
          matchPrefix(r.tokens, prefix));
        if (!available.length) {
          out(lines, '% No matching commands in ' + modeLabel() + '.', 'err');
          return;
        }
        const seen = {};
        available.forEach(r => {
          if (seen[r.ref]) return;
          seen[r.ref] = true;
          const c = CATALOG_BY_ID[r.ref];
          if (!c) return;
          out(lines, '  ' + pad(c.syntax, 48) + c.desc, 'info');
        });
        out(lines, '', '');
        out(lines, 'Commands: ' + available.length + ' · use ? after any command for more options.', 'dim');
      }

      function showRunningConfig(lines) {
        const dev = needDevice(lines);
        if (!dev) return;
        out(lines, '! NetLab running configuration for ' + dev.name, 'dim');
        out(lines, 'version 15.2', '');
        out(lines, 'hostname ' + dev.name, '');
        out(lines, '!', 'dim');
        dev.ports.forEach(p => {
          out(lines, 'interface ' + p.name, '');
          if (p.desc) out(lines, ' description ' + p.desc, '');
          if (NL.ip.valid(p.ip)) out(lines, ' ip address ' + p.ip + ' ' + NL.ip.mask(p.prefix), '');
          else out(lines, ' no ip address', 'dim');
          if (p.gateway && NL.ip.valid(p.gateway)) out(lines, ' ip default-gateway ' + p.gateway, '');
          out(lines, ' ' + (p.shutdown ? 'shutdown' : 'no shutdown'), '');
          if (dev.type === 'switch' || dev.type === 'ap') {
            out(lines, ' switchport mode ' + (p.mode || 'access'), '');
            if ((p.mode || 'access') === 'access') out(lines, ' switchport access vlan ' + (p.vlan || 1), '');
            else out(lines, ' switchport trunk allowed vlan ' + (p.trunkVlans || '1'), '');
          }
          out(lines, '!', 'dim');
        });
        dev.staticRoutes.forEach(r => out(lines, 'ip route ' + r.network + ' ' + NL.ip.mask(r.prefix) + ' ' + r.gateway, ''));
        if (dev.routing && dev.routing.protocol !== 'none') {
          const p = dev.routing.protocol;
          if (p === 'ospf') {
            out(lines, 'router ospf ' + (dev.routing.process || 1), '');
            if (dev.routing.network) out(lines, ' network ' + dev.routing.network, '');
          } else if (p === 'eigrp') {
            out(lines, 'router eigrp ' + (dev.routing.asn || 100), '');
            if (dev.routing.network) out(lines, ' network ' + dev.routing.network, '');
          } else if (p === 'bgp') {
            out(lines, 'router bgp ' + (dev.routing.asn || 65001), '');
            (dev.routing.neighbors || []).forEach(n => out(lines, ' neighbor ' + n.ip + ' remote-as ' + n.asn, ''));
          } else out(lines, 'router isis', '');
          out(lines, '!', 'dim');
        }
        if (dev.dns && Array.isArray(dev.dns.records)) {
          dev.dns.records.forEach(r => out(lines, 'ip host ' + r.name + ' ' + r.ip, ''));
        }
        out(lines, 'end', 'info');
      }

      function showIpInterfaceBrief(lines) {
        const dev = needDevice(lines);
        if (!dev) return;
        out(lines, pad('Interface', 12) + pad('IP-Address', 17) + pad('OK?', 6) + pad('Method', 10) + 'Status', 'info');
        dev.ports.forEach(p => {
          const ipText = NL.ip.valid(p.ip) ? p.ip : 'unassigned';
          const method = p.dhcp ? 'DHCP' : (p.apipa ? 'APIPA' : 'manual');
          const status = p.shutdown ? 'administratively down/down' :
            (NL.model.linkForPort(dev.id, p.id) ? 'up/up' : 'down/down');
          out(lines, pad(p.name, 12) + pad(ipText, 17) + pad(NL.ip.valid(p.ip) ? 'YES' : 'NO', 6) + pad(method, 10) + status,
            p.shutdown ? 'warn' : (status === 'up/up' ? '' : 'dim'));
        });
      }

      function showInterfaces(lines, name) {
        const dev = needDevice(lines);
        if (!dev) return;
        if (name && lower(name) === 'status') { referenceOnly(lines, 'show-interface-status'); return; }
        const ports = name ? [dev.ports.find(p => lower(p.name) === lower(name))].filter(Boolean) : dev.ports;
        if (!ports.length) { out(lines, '% Interface not found.', 'err'); return; }
        ports.forEach(p => {
          const linked = !!NL.model.linkForPort(dev.id, p.id);
          out(lines, p.name + ' is ' + (p.shutdown ? 'administratively down, line protocol is down' :
            (linked ? 'up, line protocol is up' : 'down, line protocol is down')), linked && !p.shutdown ? 'ok' : 'warn');
          out(lines, '  Hardware is NetLab Ethernet, address is ' + p.mac, '');
          if (NL.ip.valid(p.ip)) out(lines, '  Internet address is ' + p.ip + '/' + p.prefix, 'info');
          if (p.desc) out(lines, '  Description: ' + p.desc, 'dim');
          out(lines, '  MTU 1500 bytes, BW ' + (p.name.startsWith('Gi') ? '1000000' : '100000') + ' Kbit', 'dim');
          out(lines, '  Last input 00:00:01, output 00:00:01, output hang never', 'dim');
          out(lines, '  5 minute input rate 0 bits/sec, 0 packets/sec', 'dim');
          out(lines, '  5 minute output rate 0 bits/sec, 0 packets/sec', 'dim');
          out(lines, '     0 packets input, 0 bytes, 0 no buffer', 'dim');
          out(lines, '     0 packets output, 0 bytes, 0 underruns', 'dim');
          out(lines, '', '');
        });
      }

      function showIpRoute(lines) {
        const dev = needDevice(lines);
        if (!dev) return;
        const routes = NL.model.routesOf(dev);
        out(lines, 'Codes: C - connected, S - static, O - OSPF, D - EIGRP, I - IS-IS, B - BGP', 'dim');
        out(lines, 'Gateway of last resort is ' + (primaryGateway(dev) || 'not set'), 'dim');
        if (!routes.length) { out(lines, '% No routes configured.', 'warn'); return; }
        routes.sort((a, b) => b.prefix - a.prefix);
        routes.forEach(r => {
          const code = r.connected ? 'C' : (r.proto === 'static' ? 'S' :
            ({ ospf: 'O', eigrp: 'D', isis: 'I', bgp: 'B' }[lower(r.proto)] || 'D'));
          const via = r.connected ? 'directly connected, ' + r.iface :
            'via ' + (r.gateway || '—') + (r.iface && r.iface !== '—' ? ', ' + r.iface : '');
          out(lines, pad(code, 2) + '   ' + pad(r.network + '/' + r.prefix, 20) + ' ' + via,
            r.connected ? 'ok' : 'info');
        });
      }

      function primaryGateway(dev) {
        const p = NL.model.primaryPort(dev);
        return p && NL.ip.valid(p.gateway) ? p.gateway : '';
      }

      function showMacTable(lines) {
        const dev = needDevice(lines);
        if (!dev) return;
        out(lines, pad('Vlan', 6) + pad('Mac Address', 20) + pad('Type', 10) + 'Ports', 'info');
        const entries = Object.keys(dev.macTable || {});
        if (!entries.length) { out(lines, '% No MAC addresses learned yet. Run a ping to fill this table.', 'warn'); return; }
        entries.forEach(mac => {
          const portId = dev.macTable[mac];
          const port = dev.ports.find(p => p.id === portId);
          out(lines, pad('1', 6) + pad(mac, 20) + pad('DYNAMIC', 10) + (port ? port.name : portId), '');
        });
      }

      function showArp(lines) {
        const dev = needDevice(lines);
        if (!dev) return;
        out(lines, pad('Protocol', 10) + pad('Address', 17) + pad('Age', 6) + pad('Type', 8) + 'Hardware Addr', 'info');
        const entries = Object.keys(dev.arp || {});
        if (!entries.length) { out(lines, '% No ARP entries. ARP resolves IPv4 addresses to MACs on the local link.', 'warn'); return; }
        entries.forEach(ipAddr => {
          out(lines, pad('Internet', 10) + pad(ipAddr, 17) + pad('-', 6) + pad('ARPA', 8) + dev.arp[ipAddr], '');
        });
      }

      function showVlanBrief(lines) {
        const dev = needDevice(lines);
        if (!dev) return;
        if (dev.type !== 'switch' && dev.type !== 'ap') {
          out(lines, '% ' + dev.name + ' is not a switch. VLAN membership applies to switch/AP ports.', 'warn');
          return;
        }
        out(lines, pad('VLAN', 6) + pad('Name', 16) + pad('Status', 10) + 'Ports', 'info');
        const byVlan = {};
        dev.ports.forEach(p => {
          const key = (p.mode || 'access') === 'trunk' ? 'trunk' : String(p.vlan || 1);
          (byVlan[key] = byVlan[key] || []).push(p.name);
        });
        Object.keys(byVlan).sort((a, b) => lower(a).localeCompare(lower(b))).forEach(key => {
          const name = key === 'trunk' ? 'TRUNK' : ((dev.vlans && dev.vlans[key] && dev.vlans[key].name) || 'VLAN' + key);
          const suffix = key === 'trunk' ? ' allowed ' + (dev.ports.find(p => p.name === byVlan[key][0]) || {}).trunkVlans : '';
          out(lines, pad(key, 6) + pad(name, 16) + pad('active', 10) + byVlan[key].join(', ') + suffix, '');
        });
      }

      function routerNeighbors(lines, protocol) {
        const dev = needDevice(lines);
        if (!dev || dev.type !== 'router') { out(lines, '% This command applies to routers.', 'warn'); return; }
        const peers = [];
        NL.model.linksOf(dev.id).forEach(link => {
          const farId = link.a.deviceId === dev.id ? link.b.deviceId : link.a.deviceId;
          const far = NL.model.getDevice(farId);
          if (!far || far.type !== 'router') return;
          if (protocol !== 'bgp' && far.routing && lower(far.routing.protocol) === protocol) peers.push(far);
          if (protocol === 'bgp' && far.routing && lower(far.routing.protocol) === 'bgp') peers.push(far);
        });
        if (!peers.length) {
          out(lines, '% No ' + protocol.toUpperCase() + ' neighbors found. Configure the same protocol on linked routers.', 'warn');
          return;
        }
        if (protocol === 'ospf') {
          out(lines, pad('Neighbor ID', 18) + pad('Pri', 5) + pad('State', 16) + pad('Dead Time', 12) + 'Address', 'info');
          peers.forEach(p => out(lines, pad(NL.model.primaryIp(p) || p.name, 18) + pad('1', 5) + pad('FULL/DR', 16) + pad('00:00:40', 12) + NL.model.primaryIp(p), 'ok'));
        } else if (protocol === 'eigrp') {
          out(lines, pad('H', 3) + pad('Address', 17) + pad('Hold', 7) + pad('Uptime', 10) + pad('Q', 3) + 'Seq', 'info');
          peers.forEach((p, i) => out(lines, pad(i, 3) + pad(NL.model.primaryIp(p) || p.name, 17) + pad('15', 7) + pad('00:01:20', 10) + pad('0', 3) + (i + 3), 'ok'));
        } else if (protocol === 'bgp') {
          out(lines, pad('Neighbor', 17) + pad('AS', 8) + pad('State/PfxRcd', 14) + 'Learned routes', 'info');
          peers.forEach(p => out(lines, pad(NL.model.primaryIp(p) || p.name, 17) + pad(String(p.routing.asn || '?'), 8) + pad('Established', 14) + String((p.dynamicRoutes || []).length), 'ok'));
        } else {
          out(lines, pad('System ID', 18) + pad('Type', 12) + pad('State', 12) + 'Circuit', 'info');
          peers.forEach(p => out(lines, pad(p.name, 18) + pad('L1/L2', 12) + pad('UP', 12) + (NL.model.primaryIp(p) || 'is-is'), 'ok'));
        }
      }

      function showIpProtocols(lines) {
        const dev = needDevice(lines);
        if (!dev) return;
        const r = dev.routing || {};
        if (!r.protocol || r.protocol === 'none') {
          out(lines, '% No routing protocol configured on ' + dev.name + '.', 'warn');
          out(lines, 'Connected and static routes still work. Try "router ospf 1" in config mode.', 'dim');
          return;
        }
        const p = lower(r.protocol);
        out(lines, 'Routing Protocol is "' + p + '"', 'info');
        out(lines, '  Sending updates every ' + (p === 'rip' ? '30' : p === 'eigrp' ? '5' : '10') + ' seconds', '');
        out(lines, '  Routing for networks:', '');
        out(lines, '    ' + (r.network || 'all connected interfaces'), 'dim');
        out(lines, '  Distance (administrative distance): ' + ({ ospf: 110, eigrp: 90, isis: 115, bgp: 20, rip: 120 }[p] || '—'), '');
        if (r.process && p === 'ospf') out(lines, '  Process ID: ' + r.process, '');
        if (r.asn && (p === 'eigrp' || p === 'bgp')) out(lines, '  Autonomous system: ' + r.asn, '');
        if (r.area !== undefined) out(lines, '  OSPF area: ' + r.area, '');
        out(lines, '  Routing Information Sources:', '');
        out(lines, '    directly connected routers', 'dim');
      }

      function showNeighbors(lines, kind) {
        const dev = needDevice(lines);
        if (!dev) return;
        out(lines, pad('Capability', 12) + pad('Local Intf', 12) + pad('Hold', 7) + pad('Platform', 14) + 'Neighbor', 'info');
        const peers = [];
        NL.model.linksOf(dev.id).forEach(link => {
          const farId = link.a.deviceId === dev.id ? link.b.deviceId : link.a.deviceId;
          const far = NL.model.getDevice(farId);
          if (!far) return;
          const local = dev.ports.find(p => p.id === (link.a.deviceId === dev.id ? link.a.portId : link.b.portId));
          const remote = far.ports.find(p => p.id === (link.a.deviceId === dev.id ? link.b.portId : link.a.portId));
          peers.push({ far, local, remote });
        });
        if (!peers.length) { out(lines, '% No directly connected neighbors.', 'warn'); return; }
        peers.forEach(x => {
          const cap = ({ router: 'Router', switch: 'Switch', hub: 'Hub', server: 'Server', pc: 'Host', ap: 'AP', wifi: 'Host' })[x.far.type] || 'Device';
          out(lines, pad(cap, 12) + pad(x.local ? x.local.name : '—', 12) + pad('150', 7) + pad('NetLab ' + cap, 14) + x.far.name + (x.remote ? ' (' + x.remote.name + ')' : ''), '');
        });
        out(lines, '', '');
        out(lines, kind === 'cdp' ? 'CDP is Cisco-proprietary; LLDP is the open standard alternative.' : 'LLDP is IEEE 802.1AB and works between vendors.', 'dim');
      }

      function showSpanningTree(lines) {
        const dev = needDevice(lines);
        if (!dev) return;
        if (dev.type !== 'switch' && dev.type !== 'ap') { out(lines, '% Spanning tree applies to switches/APs.', 'warn'); return; }
        const bridges = NL.model.state.devices.filter(d => d.type === 'switch' || d.type === 'ap');
        const root = bridges.slice().sort((a, b) => lower(NL.model.primaryPort(a).mac).localeCompare(lower(NL.model.primaryPort(b).mac)))[0] || dev;
        out(lines, 'VLAN0001', 'info');
        out(lines, '  Spanning tree enabled protocol ieee', '');
        out(lines, '  Root ID    Priority    32769', '');
        out(lines, '             Address     ' + (NL.model.primaryPort(root) || {}).mac, '');
        out(lines, '             This bridge is the root' + (root.id === dev.id ? '' : ' is FALSE'), root.id === dev.id ? 'ok' : 'dim');
        out(lines, '  Bridge ID  Priority    32769  (priority 32768 sys-id-ext 1)', '');
        out(lines, '             Address     ' + (NL.model.primaryPort(dev) || {}).mac, '');
        out(lines, '', '');
        out(lines, 'NetLab does not block ports; this is a teaching view of the root election.', 'warn');
      }

      function showDhcpBinding(lines) {
        const dev = needDevice(lines);
        if (!dev) return;
        if (!dev.dhcpLeases || !dev.dhcpLeases.length) { out(lines, '% No active DHCP leases on ' + dev.name + '.', 'warn'); return; }
        out(lines, pad('Address', 17) + pad('Client MAC', 20) + pad('Client', 18) + 'Lease expiration', 'info');
        dev.dhcpLeases.forEach(l => {
          const client = NL.model.getDevice(l.clientId);
          out(lines, pad(l.ip || l.address || '—', 17) + pad(l.mac || '—', 20) + pad(client ? client.name : 'unknown', 18) + 'infinite (simplified)', '');
        });
      }

      function showNat(lines) {
        const dev = needDevice(lines);
        if (!dev) return;
        const list = (dev.nat && dev.nat.translations) || [];
        if (!list.length) { out(lines, '% No active NAT translations.', 'warn'); return; }
        out(lines, pad('Pro', 5) + pad('Inside local', 18) + pad('Inside global', 18) + pad('Outside local', 18) + 'Outside global', 'info');
        list.forEach(t => out(lines, pad('icmp', 5) + pad(t.inside, 18) + pad(t.outside, 18) + pad(t.outside, 18) + t.outside, ''));
      }

      function showAcl(lines) {
        const dev = needDevice(lines);
        if (!dev) return;
        const acl = dev.acl || {};
        if (!acl.rules || !acl.rules.length) { out(lines, '% No access lists configured.', 'warn'); return; }
        out(lines, 'NetLab simplified ACL (' + (acl.enabled ? 'enabled' : 'disabled') + '):', 'info');
        acl.rules.forEach((r, i) => out(lines, '  ' + pad(i + 1, 3) + pad(r.action, 8) + pad(r.proto, 8) + pad(r.src, 17) + r.dst, r.action === 'deny' ? 'warn' : 'ok'));
        out(lines, '  implicit permit (teaching model)', 'dim');
      }

      // ---------- executable command table ----------
      const ROUTES = [];
      function route(ref, tokens, run, opts) {
        ROUTES.push(Object.assign({ ref, tokens, run }, opts || {}));
      }

      route('help', ['?'], (l) => showHelp(l, ['?']), { modes: allModes(), hidden: true });
      route('help', ['help'], (l) => showHelp(l, []), { modes: allModes() });

      route('enable', ['enable'], l => { ctx.privileged = true; out(l, 'NetLab#', 'ok'); });
      route('disable', ['disable'], l => { ctx.privileged = false; out(l, 'NetLab>', 'ok'); });
      route('exit', ['exit'], l => {
        if (ctx.mode === 'interface' || ctx.mode === 'router' || ctx.mode === 'vlan') {
          ctx.mode = 'config'; ctx.iface = null; ctx.router = null; ctx.vlanId = null;
          out(l, 'Returned to global configuration mode.', 'dim');
        } else if (ctx.mode === 'config') {
          ctx.mode = 'exec'; out(l, 'Returned to privileged EXEC mode.', 'dim');
        } else out(l, 'Exiting ' + prompt() + ' (session stays open in NetLab).', 'dim');
      }, { modes: allModes() });
      route('end', ['end'], l => {
        ctx.mode = 'exec'; ctx.iface = null; ctx.router = null; ctx.vlanId = null;
        out(l, 'Returned to privileged EXEC mode.', 'dim');
      }, { modes: allModes() });
      route('configure-terminal', ['configure', 'terminal'], l => {
        ctx.mode = 'config'; out(l, 'Enter configuration commands, one per line. End with "end".', 'info');
      }, { priv: true });
      route('hostname', ['hostname', ':name'], (l, a) => {
        const dev = needDevice(l); if (!dev) return;
        const name = String(a.name || '').trim().slice(0, 32);
        if (!name) { out(l, '% Hostname cannot be empty.', 'err'); return; }
        dev.name = name; changed(l.result); out(l, 'Hostname set to ' + name + '.', 'ok');
      }, { modes: ['config'], priv: true });
      route('history', ['history'], l => {
        if (!ctx.history.length) { out(l, '% No commands in history.', 'dim'); return; }
        ctx.history.forEach((h, i) => out(l, '  ' + pad(i + 1, 4) + h, 'info'));
      }, { modes: allModes() });
      route('clear-screen', ['clear', 'screen'], l => { l.clear = true; }, { modes: allModes() });
      route('clear-screen', ['cls'], l => { l.clear = true; }, { modes: allModes(), hidden: true });
      route('terminal-length', ['terminal', 'length', ':lines'], l => out(l, 'Terminal length set to ' + l.args.lines + '.', 'dim'), { modes: allModes() });
      route('write-memory', ['write', 'memory'], l => { changed(l.result); out(l, 'Building configuration...', 'dim'); out(l, '[OK]', 'ok'); out(l, 'NetLab saved this lab in your browser.', 'dim'); }, { priv: true });
      route('write-memory', ['copy', 'running-config', 'startup-config'], l => { changed(l.result); out(l, 'Building configuration...', 'dim'); out(l, '[OK]', 'ok'); }, { priv: true });
      route('reload', ['reload'], l => referenceOnly(l, 'reload'));

      // show commands (EXEC only; use `do` from config modes)
      route('show-running-config', ['show', 'running-config'], showRunningConfig);
      route('show-ip-interface-brief', ['show', 'ip', 'interface', 'brief'], showIpInterfaceBrief);
      route('show-interfaces', ['show', 'interfaces', ':name'], (l, a) => showInterfaces(l, a.name));
      route('show-interfaces', ['show', 'interfaces'], l => showInterfaces(l));
      route('show-ip-route', ['show', 'ip', 'route'], showIpRoute);
      route('show-mac-table', ['show', 'mac', 'address-table'], showMacTable);
      route('show-arp', ['show', 'arp'], showArp);
      route('show-vlan-brief', ['show', 'vlan', 'brief'], showVlanBrief);
      route('show-spanning-tree', ['show', 'spanning-tree'], showSpanningTree);
      route('show-cdp-neighbors', ['show', 'cdp', 'neighbors'], l => showNeighbors(l, 'cdp'));
      route('show-lldp-neighbors', ['show', 'lldp', 'neighbors'], l => showNeighbors(l, 'lldp'));
      route('show-dhcp-binding', ['show', 'ip', 'dhcp', 'binding'], showDhcpBinding);
      route('show-nat-translations', ['show', 'ip', 'nat', 'translations'], showNat);
      route('show-access-lists', ['show', 'access-lists'], showAcl);
      route('show-logging', ['show', 'logging'], l => {
        const logs = typeof options.getLogs === 'function' ? options.getLogs() : [];
        if (!logs.length) { out(l, '% Syslog buffer is empty.', 'warn'); return; }
        out(l, 'Syslog buffer (most recent ' + Math.min(20, logs.length) + ' lines):', 'info');
        logs.slice(-20).forEach(line => out(l, '  ' + line, 'dim'));
      });
      route('show-ip-protocols', ['show', 'ip', 'protocols'], showIpProtocols);
      route('show-ospf-neighbor', ['show', 'ip', 'ospf', 'neighbor'], l => routerNeighbors(l, 'ospf'));
      route('show-eigrp-neighbors', ['show', 'ip', 'eigrp', 'neighbors'], l => routerNeighbors(l, 'eigrp'));
      route('show-bgp-summary', ['show', 'ip', 'bgp', 'summary'], l => routerNeighbors(l, 'bgp'));
      route('show-isis-neighbors', ['show', 'isis', 'neighbors'], l => routerNeighbors(l, 'isis'));
      route('show-version', ['show', 'version'], l => {
        out(l, 'Cisco IOS Software, NetLab Teaching Image (NL-UNIVERSAL-K9), Version 15.2(4)M', 'info');
        out(l, 'Compiled Wed 15-May-24 10:22 by netlab', 'dim');
        out(l, 'System returned to ROM by power-on', 'dim');
        out(l, 'System image file is "flash:nl-universal-k9.bin"', 'dim');
        out(l, 'NetLab model: simplified teaching simulator — not a real router OS.', 'warn');
      });
      route('show-clock', ['show', 'clock'], l => out(l, nowString(), 'info'));
      route('show-processes-cpu', ['show', 'processes', 'cpu'], l => referenceOnly(l, 'show-processes-cpu'));

      // Reference-only show commands typed at the prompt give a useful explanation.
      const SHOW_REFERENCE = [
        ['show-ipv6-interface', ['show', 'ipv6', 'interface', 'brief']],
        ['show-ipv6-route', ['show', 'ipv6', 'route']],
        ['show-ipv6-neighbors', ['show', 'ipv6', 'neighbors']],
        ['show-ip-rip', ['show', 'ip', 'rip', 'database']],
        ['show-route-map', ['show', 'route-map']],
        ['show-dhcp-pool', ['show', 'ip', 'dhcp', 'pool']],
        ['show-nat-statistics', ['show', 'ip', 'nat', 'statistics']],
        ['show-interface-status', ['show', 'interfaces', 'status']],
        ['show-ntp-status', ['show', 'ntp', 'status']],
        ['show-snmp', ['show', 'snmp']],
        ['show-ssh', ['show', 'ip', 'ssh']],
        ['show-users', ['show', 'users']]
      ];
      SHOW_REFERENCE.forEach(x => route(x[0], x[1], l => referenceOnly(l, x[0])));

      // Troubleshooting
      route('ping', ['ping', ':target'], (l, a) => {
        const target = resolveTarget(l, a.target);
        if (!target) return;
        const src = device();
        out(l, 'Type escape sequence to abort.', 'dim');
        out(l, 'Sending 1, 100-byte ICMP Echos to ' + (NL.model.primaryIp(target) || a.target) + ', timeout is 2 seconds:', 'info');
        if (NL.sim && typeof NL.sim.ping === 'function') NL.sim.ping(src.id, target.id);
        l.animate = true;
      });
      route('traceroute', ['traceroute', ':target'], (l, a) => {
        const target = resolveTarget(l, a.target);
        if (!target) return;
        const src = device();
        out(l, 'Traceroute to ' + (NL.model.primaryIp(target) || a.target) + ', 12 hops max', 'info');
        if (NL.sim && typeof NL.sim.trace === 'function') NL.sim.trace(src.id, target.id);
        l.animate = true;
      });
      route('clear-mac-table', ['clear', 'mac', 'address-table'], l => {
        const dev = needDevice(l); if (!dev) return;
        dev.macTable = {}; changed(l.result); out(l, 'MAC address table cleared on ' + dev.name + '.', 'ok');
      }, { priv: true });
      route('clear-arp', ['clear', 'arp-cache'], l => {
        const dev = needDevice(l); if (!dev) return;
        dev.arp = {}; changed(l.result); out(l, 'ARP cache cleared on ' + dev.name + '.', 'ok');
      }, { priv: true });
      route('clear-ip-route', ['clear', 'ip', 'route', '*'], l => {
        NL.model.clearDynamicRoutes(); changed(l.result);
        out(l, 'Dynamic routes flushed. Run a routing convergence demo to relearn them.', 'ok');
      }, { priv: true });
      route('clear-counters', ['clear', 'counters'], l => referenceOnly(l, 'clear-counters'), { priv: true });
      route('undebug-all', ['undebug', 'all'], l => out(l, 'All possible debugging has been turned off.', 'ok'), { priv: true });
      [['debug-ip-packet', ['debug', 'ip', 'packet']], ['debug-ospf', ['debug', 'ip', 'ospf', 'events']],
       ['debug-eigrp', ['debug', 'eigrp', 'packets']], ['debug-bgp', ['debug', 'bgp', 'updates']],
       ['debug-dot1x', ['debug', 'dot1x', 'events']]].forEach(x =>
        route(x[0], x[1], l => referenceOnly(l, x[0]), { priv: true }));

      // Configuration
      route('interface', ['interface', ':name'], (l, a) => {
        const port = needPort(l, a.name); if (!port) return;
        ctx.mode = 'interface'; ctx.iface = port.id;
        out(l, devPrompt() + '(config-if)#', 'info');
      }, { modes: ['config'], priv: true });
      function devPrompt() { const d = device(); return d ? d.name.replace(/\s+/g, '') : 'none'; }

      route('ip-address', ['ip', 'address', ':ip', ':mask'], (l, a) => {
        const port = currentPort(l); if (!port) return;
        if (!NL.ip.valid(a.ip)) { out(l, '% Invalid IP address.', 'err'); return; }
        const prefix = prefixFromMask(a.mask);
        if (prefix < 0) { out(l, '% Invalid subnet mask or prefix length.', 'err'); return; }
        port.ip = a.ip; port.prefix = prefix; port.dhcp = false; port.lease = null; port.apipa = false;
        changed(l.result); out(l, port.name + ' assigned ' + a.ip + '/' + prefix + ' (' + NL.ip.mask(prefix) + ').', 'ok');
      }, { modes: ['interface'], priv: true });
      route('no-ip-address', ['no', 'ip', 'address'], l => {
        const port = currentPort(l); if (!port) return;
        port.ip = ''; port.dhcp = false; port.lease = null; port.apipa = false;
        changed(l.result); out(l, 'IP address removed from ' + port.name + '.', 'ok');
      }, { modes: ['interface'], priv: true });
      route('shutdown', ['shutdown'], l => {
        const port = currentPort(l); if (!port) return;
        port.shutdown = true; changed(l.result); out(l, port.name + ' administratively shut down.', 'warn');
      }, { modes: ['interface'], priv: true });
      route('no-shutdown', ['no', 'shutdown'], l => {
        const port = currentPort(l); if (!port) return;
        port.shutdown = false; changed(l.result); out(l, port.name + ' is up (line protocol depends on its cable).', 'ok');
      }, { modes: ['interface'], priv: true });
      route('description', ['description', ':text'], (l, a) => {
        const port = currentPort(l); if (!port) return;
        port.desc = a.text; changed(l.result); out(l, 'Description set on ' + port.name + '.', 'ok');
      }, { modes: ['interface'], priv: true });
      route('default-gateway', ['ip', 'default-gateway', ':ip'], (l, a) => {
        const dev = needDevice(l); if (!dev) return;
        if (!NL.ip.valid(a.ip)) { out(l, '% Invalid gateway address.', 'err'); return; }
        const port = NL.model.primaryPort(dev);
        if (!port) { out(l, '% Give the device an IP address first.', 'err'); return; }
        port.gateway = a.ip; changed(l.result); out(l, 'Default gateway set to ' + a.ip + '.', 'ok');
      }, { modes: ['config', 'interface'], priv: true });
      route('switchport-mode', ['switchport', 'mode', ':mode'], (l, a) => {
        const port = currentPort(l); if (!port) return;
        const mode = lower(a.mode);
        if (mode !== 'access' && mode !== 'trunk') { out(l, '% Mode must be access or trunk.', 'err'); return; }
        port.mode = mode; changed(l.result); out(l, port.name + ' is now a ' + mode + ' port.', 'ok');
      }, { modes: ['interface'], priv: true });
      route('switchport-access-vlan', ['switchport', 'access', 'vlan', ':id'], (l, a) => {
        const port = currentPort(l); if (!port) return;
        const id = Number(a.id);
        if (!/^\d+$/.test(a.id) || id < 1 || id > 4094) { out(l, '% VLAN ID must be 1–4094.', 'err'); return; }
        port.vlan = id; port.mode = 'access'; changed(l.result); out(l, port.name + ' assigned to VLAN ' + id + '.', 'ok');
      }, { modes: ['interface'], priv: true });
      route('switchport-trunk-vlans', ['switchport', 'trunk', 'allowed', 'vlan', ':list'], (l, a) => {
        const port = currentPort(l); if (!port) return;
        port.trunkVlans = a.list; port.mode = 'trunk'; changed(l.result);
        out(l, port.name + ' allowed VLANs: ' + a.list + '.', 'ok');
      }, { modes: ['interface'], priv: true });

      route('vlan', ['vlan', ':id'], (l, a) => {
        const dev = needDevice(l); if (!dev) return;
        const id = Number(a.id);
        if (!/^\d+$/.test(a.id) || id < 1 || id > 4094) { out(l, '% VLAN ID must be 1–4094.', 'err'); return; }
        dev.vlans = dev.vlans || {};
        if (!dev.vlans[id]) dev.vlans[id] = { name: 'VLAN' + id };
        dev.vlan = dev.vlan || {}; dev.vlan.vlanId = id;
        ctx.mode = 'vlan'; ctx.vlanId = id; changed(l.result);
        out(l, 'Entering VLAN ' + id + ' configuration mode.', 'info');
      }, { modes: ['config'], priv: true });
      route('vlan-name', ['name', ':text'], (l, a) => {
        const dev = needDevice(l); if (!dev || ctx.vlanId == null) return;
        dev.vlans = dev.vlans || {};
        dev.vlans[ctx.vlanId] = dev.vlans[ctx.vlanId] || {};
        dev.vlans[ctx.vlanId].name = a.text; changed(l.result);
        out(l, 'VLAN ' + ctx.vlanId + ' named "' + a.text + '".', 'ok');
      }, { modes: ['vlan'], priv: true });

      route('ip-route', ['ip', 'route', ':network', ':mask', ':gateway'], (l, a) => {
        const dev = needDevice(l); if (!dev) return;
        const prefix = prefixFromMask(a.mask);
        if (!NL.ip.valid(a.network) || prefix < 0 || !NL.ip.valid(a.gateway)) {
          out(l, '% Use: ip route <network> <mask> <next-hop-ip>', 'err'); return;
        }
        if (NL.model.addStaticRoute(dev, a.network, prefix, a.gateway)) {
          changed(l.result); out(l, 'Static route added: ' + NL.ip.network(a.network, prefix) + '/' + prefix + ' via ' + a.gateway + '.', 'ok');
        } else out(l, '% Route already exists or next hop is invalid.', 'warn');
      }, { modes: ['config'], priv: true });
      route('no-ip-route', ['no', 'ip', 'route', ':network', ':mask', ':gateway'], (l, a) => {
        const dev = needDevice(l); if (!dev) return;
        const prefix = prefixFromMask(a.mask);
        const net = NL.ip.valid(a.network) && prefix >= 0 ? NL.ip.network(a.network, prefix) : null;
        const idx = dev.staticRoutes.findIndex(r => r.network === net && r.prefix === prefix && r.gateway === a.gateway);
        if (idx < 0) { out(l, '% That exact static route was not found.', 'err'); return; }
        NL.model.removeStaticRoute(dev, idx); changed(l.result); out(l, 'Static route removed.', 'ok');
      }, { modes: ['config'], priv: true });

      route('router-ospf', ['router', 'ospf', ':process'], (l, a) => startRouter(l, 'ospf', a.process), { modes: ['config'], priv: true });
      route('router-ospf', ['router', 'ospf'], (l) => startRouter(l, 'ospf', '1'), { modes: ['config'], priv: true });
      route('router-eigrp', ['router', 'eigrp', ':as'], (l, a) => startRouter(l, 'eigrp', a.as), { modes: ['config'], priv: true });
      route('router-bgp', ['router', 'bgp', ':as'], (l, a) => startRouter(l, 'bgp', a.as), { modes: ['config'], priv: true });
      route('router-isis', ['router', 'isis'], (l) => startRouter(l, 'isis', ''), { modes: ['config'], priv: true });
      function startRouter(l, protocol, value) {
        const dev = needDevice(l); if (!dev) return;
        if (dev.type !== 'router') { out(l, '% ' + dev.name + ' is not a router. Dynamic routing needs a router device.', 'err'); return; }
        dev.routing = dev.routing || {};
        dev.routing.protocol = protocol;
        // OSPF process IDs are local labels, not autonomous system numbers.
        if (protocol === 'ospf') {
          dev.routing.process = Number(value) || 1;
          delete dev.routing.asn;
        } else if (protocol === 'eigrp' || protocol === 'bgp') {
          dev.routing.asn = Number(value) || (protocol === 'eigrp' ? 100 : 65001);
        } else {
          delete dev.routing.asn;
        }
        ctx.mode = 'router'; ctx.router = protocol; changed(l.result);
        out(l, 'Entering ' + protocol.toUpperCase() + ' router configuration mode.', 'info');
      }
      route('network-area', ['network', ':network', ':wildcard', 'area', ':area'], (l, a) => {
        const dev = needDevice(l); if (!dev) return;
        if (!NL.ip.valid(a.network)) { out(l, '% Invalid network address.', 'err'); return; }
        const prefix = prefixFromWildcard(a.wildcard);
        if (prefix < 0) { out(l, '% Invalid wildcard mask. Example for /24: 0.0.0.255', 'err'); return; }
        dev.routing = dev.routing || {};
        dev.routing.network = NL.ip.network(a.network, prefix) + '/' + prefix;
        dev.routing.area = Number(a.area) || 0;
        changed(l.result); out(l, 'Network ' + dev.routing.network + ' enabled in area ' + dev.routing.area + '.', 'ok');
      }, { modes: ['router'], priv: true });
      route('neighbor-remote-as', ['neighbor', ':ip', 'remote-as', ':asn'], (l, a) => {
        const dev = needDevice(l); if (!dev) return;
        if (!NL.ip.valid(a.ip)) { out(l, '% Invalid neighbor address.', 'err'); return; }
        dev.routing = dev.routing || {};
        dev.routing.neighbors = dev.routing.neighbors || [];
        const existing = dev.routing.neighbors.find(n => lower(n.ip) === lower(a.ip));
        if (existing) existing.asn = Number(a.asn) || 0;
        else dev.routing.neighbors.push({ ip: a.ip, asn: Number(a.asn) || 0 });
        changed(l.result); out(l, 'Neighbor ' + a.ip + ' in AS ' + a.asn + ' configured.', 'ok');
      }, { modes: ['router'], priv: true });

      route('ip-host', ['ip', 'host', ':name', ':ip'], (l, a) => {
        const dev = needDevice(l); if (!dev) return;
        if (!NL.ip.valid(a.ip)) { out(l, '% Invalid IP address.', 'err'); return; }
        dev.dns = dev.dns || {};
        dev.dns.records = dev.dns.records || [];
        if (!dev.dns.records.some(r => lower(r.name) === lower(a.name))) dev.dns.records.push({ name: a.name, ip: a.ip });
        changed(l.result); out(l, 'Host ' + a.name + ' → ' + a.ip + ' added to ' + dev.name + '.', 'ok');
      }, { modes: ['config', 'interface'], priv: true });
      route('no-ip-host', ['no', 'ip', 'host', ':name'], (l, a) => {
        const dev = needDevice(l); if (!dev) return;
        const before = (dev.dns && dev.dns.records || []).length;
        if (dev.dns && Array.isArray(dev.dns.records)) dev.dns.records = dev.dns.records.filter(r => lower(r.name) !== lower(a.name));
        if ((dev.dns && dev.dns.records || []).length === before) { out(l, '% Host entry not found.', 'err'); return; }
        changed(l.result); out(l, 'Host entry ' + a.name + ' removed.', 'ok');
      }, { modes: ['config', 'interface'], priv: true });

      // Reference-only configuration commands typed at the prompt.
      const CONFIG_REFERENCE = [
        ['enable-secret', ['enable', 'secret', ':password']],
        ['username', ['username', ':name', 'secret', ':password']],
        ['line-vty', ['line', 'vty', ':range']],
        ['transport-ssh', ['transport', 'input', 'ssh']],
        ['banner-motd', ['banner', 'motd', ':text']],
        ['service-password-encryption', ['service', 'password-encryption']],
        ['ip-name-server', ['ip', 'name-server', ':ip']],
        ['ntp-server', ['ntp', 'server', ':ip']],
        ['snmp-community', ['snmp-server', 'community', ':string', 'ro']],
        ['logging-host', ['logging', 'host', ':ip']],
        ['ipv6-unicast-routing', ['ipv6', 'unicast-routing']],
        ['ipv6-address', ['ipv6', 'address', ':address']],
        ['ipv6-route', ['ipv6', 'route', ':prefix', ':next']],
        ['ip-dhcp-pool', ['ip', 'dhcp', 'pool', ':name']],
        ['ip-nat-inside', ['ip', 'nat', 'inside', 'source', 'list', ':acl', 'interface', ':iface', 'overload']],
        ['access-list', ['access-list', ':num', 'permit', ':src', ':wildcard']],
        ['access-list', ['access-list', ':num', 'deny', ':src', ':wildcard']],
        ['spanning-tree-portfast', ['spanning-tree', 'portfast']],
        ['channel-group', ['channel-group', ':id', 'mode', 'active']],
        ['crypto-isakmp', ['crypto', 'isakmp', 'policy', ':priority']],
        ['copy-start-run', ['copy', 'startup-config', 'running-config']],
        ['erase-startup', ['erase', 'startup-config']]
      ];
      CONFIG_REFERENCE.forEach(x => route(x[0], x[1], l => referenceOnly(l, x[0]), { modes: ['config', 'interface', 'router', 'vlan'], priv: true }));

      function allModes() { return ['exec', 'config', 'interface', 'router', 'vlan']; }
      function currentPort(l) {
        const dev = needDevice(l);
        if (!dev || !ctx.iface) return null;
        const port = dev.ports.find(p => p.id === ctx.iface);
        if (!port) { out(l, '% The selected interface no longer exists. Use exit and re-enter interface mode.', 'err'); return null; }
        return port;
      }

      function suggest(lines, tokens) {
        const word = lower(tokens[0] || '');
        const words = {};
        CATALOG.forEach(c => { if (c.live) words[lower(c.syntax.split(' ')[0])] = true; });
        let best = null, bestScore = Infinity;
        Object.keys(words).forEach(w => {
          let score = editDistance(word, w);
          if (w.startsWith(word) && word) score = Math.min(score, 1);
          if (score < bestScore) { bestScore = score; best = w; }
        });
        if (best && bestScore <= 3) out(lines, 'Did you mean "' + best + '"? Type ? to see all commands.', 'dim');
      }

      const api = {
        get mode() { return ctx.mode; },
        get privileged() { return ctx.privileged; },
        setDevice(id) {
          ctx.deviceId = id || null;
          ctx.mode = 'exec'; ctx.iface = null; ctx.router = null; ctx.vlanId = null;
        },
        getDeviceId() { return ctx.deviceId; },
        prompt,
        historyPrev() {
          if (!ctx.history.length) return null;
          if (ctx.historyIndex == null) ctx.historyIndex = ctx.history.length;
          ctx.historyIndex = Math.max(0, ctx.historyIndex - 1);
          return ctx.history[ctx.historyIndex];
        },
        historyNext() {
          if (ctx.historyIndex == null) return null;
          ctx.historyIndex = Math.min(ctx.history.length, ctx.historyIndex + 1);
          if (ctx.historyIndex >= ctx.history.length) { ctx.historyIndex = null; return ''; }
          return ctx.history[ctx.historyIndex];
        },
        resetHistoryIndex() { ctx.historyIndex = null; },
        execute(raw) {
          const line = String(raw == null ? '' : raw).trim();
          const result = { lines: [], changed: false, animate: false, clear: false, prompt: prompt() };
          if (!line) return result;
          const lines = result.lines;
          ctx.history.push(line);
          ctx.historyIndex = null;
          out(lines, prompt() + ' ' + line, 'cmd');

          let tokens = tokenize(line);
          if (tokens.indexOf('?') >= 0) {
            showHelp(lines, tokens);
            result.prompt = prompt();
            return result;
          }

          // `do` runs an EXEC command from any configuration mode, like real IOS.
          let execOverride = false;
          if (lower(tokens[0]) === 'do' && tokens.length > 1) {
            tokens = tokens.slice(1);
            execOverride = true;
          }

          let matched = null, args = null;
          for (const r of ROUTES) {
            if (execOverride) {
              const modes = r.modes || ['exec'];
              if (modes.indexOf('exec') < 0 || r.ref === 'help') continue;
            } else if ((r.modes || ['exec']).indexOf(ctx.mode) < 0) continue;
            if (r.priv && !ctx.privileged) continue;
            const a = matchExact(r.tokens, tokens);
            if (a) { matched = r; args = a; break; }
          }

          if (!matched) {
            // A command that is valid in another mode gets a mode hint.
            const anywhere = ROUTES.find(r => matchExact(r.tokens, tokens));
            if (anywhere && !execOverride) modeError(lines, line);
            else {
              out(lines, '% Invalid input detected at "^" marker.', 'err');
              out(lines, '   ' + line, 'dim');
              out(lines, '   ' + ' '.repeat(Math.max(0, tokens[0] ? line.toLowerCase().indexOf(lower(tokens[0])) : 0)) + '^', 'dim');
              suggest(lines, tokens);
            }
            result.prompt = prompt();
            return result;
          }

          const env = { result, args };
          lines.result = result;
          lines.args = args;
          try {
            matched.run(lines, args, env);
          } catch (err) {
            out(lines, '% NetLab could not run that command: ' + (err && err.message || err), 'err');
          }
          result.clear = lines.clear === true || result.clear;
          result.animate = lines.animate === true || result.animate;
          result.prompt = prompt();
          return result;
        }
      };
      return api;
    }
  };
})();
