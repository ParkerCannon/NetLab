# NetLab

A small, friendly network simulator that runs in the browser. No install, no accounts. It includes a teaching console (no real device OS required).

## Open it

Double-click `index.html` (or open it in any modern browser). Everything is local: HTML, CSS and JavaScript in this folder. Your network is saved in the browser between visits.

## What to do first

1. Pick **Lab 1 · Same LAN with a switch** in the top bar.
2. Use the **Fill this in for me** buttons in the Lab guide, or select a PC and type its IP in the Device tab.
3. Switch to the **Ping** tool, click PC-A, then PC-B.
4. Watch the packet travel and read the **Journey log** at the bottom. Open the switch to see its MAC table fill in.

## Labs

- **Lab 1 — Two PCs, one switch:** IP addresses, subnets, ARP, switch MAC learning.
- **Lab 2 — Router between two subnets:** subnet masks, default gateways, routed hops.
- **Lab 3 — Two routers & static routes:** next-hop routing, routing tables, TTL.
- **Lab 4 — DHCP & automatic addresses:** DHCP servers, pools, the DORA exchange, leases, and a leased gateway carrying traffic to another subnet.
- **Lab 5 — APIPA & UDP:** link-local self-assigned addresses (169.254/16) when DHCP is unavailable, and connectionless UDP datagrams.
- **Lab 6 — VLANs & 802.1Q:** access/trunk ports, VLAN tagging, and Layer 2 isolation between VLANs on a switch.
- **Lab 7 — Wi-Fi, 802.1X & AAA:** Wi-Fi (802.11) association/WPA2 handshake, 802.1X port authentication, RADIUS and TACACS+ demos.
- **Lab 8 — Dynamic routing (OSPF, EIGRP, BGP, IS-IS):** simplified neighbor exchanges/convergence and learned routes.
- **Lab 9 — TLS & IPsec:** simplified secure transport (TLS handshake) and IPsec IKE/ESP VPN-style protection demos.
- **Lab 10 — DNS, NAT, ACLs & traceroute:** name resolution, address translation, simple ACLs, and hop-by-hop path discovery with common services/ports.
- **Lab 11 — Sandbox:** empty canvas for your own networks and protocol demos.

## Controls

| Action | How |
| --- | --- |
| Add a device | Click PC / Server / Switch / Router / Hub / Wi-Fi AP / Wi-Fi on the left |
| Move a device | Select tool, drag it |
| Configure a device | Click it, or double-click it |
| Connect devices | Cable tool: click the first, then the second |
| Send a ping | Ping tool: click source, then destination |
| Send UDP / run protocol demos | Select a host and use **Protocol demos** (UDP, HTTP/HTTPS, SSH, FTP, SMTP, NTP, SNMP, Syslog, TLS, IPsec, RADIUS, TACACS+, 802.1X, Wi-Fi/WPA2, WPA3, DHCPv6, SLAAC) |
| Run dynamic routing | Select a router, choose a protocol, and **Run convergence** (OSPF/EIGRP/BGP/IS-IS) |
| Set VLANs (802.1Q) | Select a switch/AP and edit each port’s mode/VLAN (access or trunk) |
| Configure DNS | Select a server, enable **Act as DNS server**, add A records; select a host and press **Resolve** |
| Configure NAT / ACL | Select a router and use the **NAT / PAT** and **ACL / firewall** sections |
| Discover a path | Select a host and press **Traceroute from here** |
| Get an address automatically | Select a PC/Server/Wi-Fi client, choose **Automatic**, then **Get an address** or **Use APIPA** |
| Run a DHCP server | Select a Server or Router, tick **Hand out addresses on this LAN**, and set a pool |
| Remove something | Delete tool: click a device or cable |
| Subnet math | **Subnet tool** in the top bar — live binary view of network vs host bits |
| Dissect a MAC address | **MAC address** in the top bar |
| Explore IPv6 addressing | **IPv6** in the top bar |
| Compare Wi-Fi standards, channels and security | **Wireless** in the top bar |
| Decode Ethernet standards, frames and cabling | **Ethernet** in the top bar |
| Explore the seven OSI layers | **OSI model** in the top bar |
| Step through RIP, OSPF, EIGRP, IS-IS and BGP | **Routing** in the top bar |
| Networking glossary | **Help** in the top bar |
| Resize or hide panels | **Customize** in the top bar, or drag the thin dividers |
| Re-space crowded devices | **Tidy layout** in the Lab guide |
| Save your own lab | Sandbox lab → **My saved labs** → name it → **Save current lab** |
| Load or delete a saved lab | Sandbox lab → **My saved labs** → **Load** or **×** |
| Slow the animations down | **Speed** menu in the Journey log (0.25× is very slow) |
| Pause / continue | Pause button in the Journey log, or `Space` |
| Advance one hop | **Step** in the Journey log, or `S` |

Keyboard: `V` select · `C` cable · `G` ping · `X` delete · `Space` pause · `S` step · `Delete` remove selection · `Esc` cancel.

The **Customize** panel also has layout presets (Balanced, Wide canvas, Guide focus, Canvas only) and an **auto-pause after every hop** option for stepping through a ping one event at a time. Your layout, speed and panel sizes are saved in the browser.

The Sandbox lab has a **My saved labs** section in the Lab guide. Name your current network and press **Save current lab** to keep the whole topology and every device setting in this browser (up to 12 labs). **Load** restores a saved network in Sandbox mode, and **×** deletes it. Preconfigured labs are laid out in rows that follow their topology; **Tidy layout** reapplies that spacing if you have moved cards around. Your manual positions are otherwise kept when panels are resized or a session is restored.

## Learning tools

The top-bar buttons open wide explainers with interactive visuals up front and collapsible deep dives below:

- **Subnet** — a live 32-bit binary strip that colors network bits versus host bits.
- **MAC address** — dissects an address into OUI/NIC, binary bytes, and the I/G and U/L flag bits.
- **IPv6** — expands and compresses hextets, shows the prefix split, and classifies the address type.
- **Wireless** — 802.11 standards, 2.4/5/6 GHz channels, WEP → WPA3 security, and dBm/SNR signal math.
- **Ethernet** — decodes 802.3 names, builds an Ethernet II/802.1Q frame, compares cable categories, and covers switching and PoE.
- **OSI model** — all seven layers with PDUs, addresses, protocols, devices, troubleshooting questions and attacks.
- **Routing** — a five-protocol visualizer with animated neighbor discovery, update exchange and convergence, plus **Run in my lab** for OSPF/EIGRP/BGP/IS-IS.

On narrow screens the learning-tool labels collapse to icons; each button keeps a title and accessible label.

## The console and command reference

The bottom panel has two tabs: **Journey log** and **Console**. Your choice is saved in **Customize** and between visits.

The console is an **IOS-style teaching CLI**, not a real router OS. It runs against your current lab, so changes you make there are real NetLab changes: pick a device, then type commands. Useful starting points:

```
?                         context help for the current mode
sh ip int br              abbreviated "show ip interface brief"
show ip route             connected, static and learned routes
show mac address-table    what a switch has learned
show arp                  IPv4-to-MAC cache
show ip protocols         active routing protocol and AD
conf t                    enter global configuration
interface Gi0/0           enter interface configuration
ip address 10.0.0.1 255.255.255.0
no shut                   bring the interface up
ip route 192.168.2.0 255.255.255.0 10.0.0.2
router ospf 1             configure a dynamic routing protocol
end                       return to privileged EXEC
write memory              save the lab in this browser
ping 10.0.0.2             starts the packet animation in the Journey log
```

It supports IOS abbreviations, `?` help, `no` forms, `exit`/`end`, `do` from config modes, command history (`↑`/`↓`), Tab completion, and output that clearly separates live commands from reference-only ones. **Commands** opens a searchable Network+ reference covering show, troubleshoot, security, IPv6, ACL, NAT, VLAN, routing and configuration commands; **Use this command** copies an example into the prompt. Commands that start a ping, traceroute or routing demo switch the dock back to the Journey log so you can watch the animation.

## What is actually simulated

Ethernet frames and MAC forwarding, switch/AP MAC learning, simplified 802.1Q VLAN access/trunk filtering, ARP request/reply, IP subnet checks, default gateways, static routes, simplified dynamic routes learned via OSPF/EIGRP/BGP/IS-IS convergence demos, longest-prefix match, per-hop TTL decrement, and echo replies that retrace the path. Hubs repeat frames to every port; switches/APs learn and narrow.

DHCP is simulated as a real broadcast exchange: Discover, Offer, Request and ACK travel over the same switches and cables as everything else. A Server or Router can run a pool, hosts can lease from it, and the leased address, mask and gateway then drive ARP and routing exactly like a manually typed one. Leases can be renewed, released, or forgotten. There is no DHCP relay yet, so client and server must share a segment. If no DHCP server answers, hosts can self-assign an APIPA address (169.254.0.0/16) for same-link communication.

UDP is simulated as a connectionless datagram carried by the same L2/L3 path logic (no handshake/ack in this model). Security and access protocols (TLS, IPsec IKE/ESP, RADIUS, TACACS+, 802.1X, Wi-Fi 802.11/WPA2/WPA3 association/handshake) are shown as simplified, educational message-sequence demos rather than full protocol stacks. Dynamic routing runs as simplified neighbor hello/update exchanges that install learned routes for teaching.

DNS is modeled with A records and a query/response animation (UDP/53), and traceroute sends probes with increasing TTL so each router reports back. NAT/PAT is conceptual: translations are logged/shown while routing still uses the original packet, and ACL rules can deny routed traffic by protocol/source/destination.

### Common ports to know

| Service | Port | Transport |
| --- | --- | --- |
| FTP | 20/21 | TCP |
| SSH | 22 | TCP |
| Telnet | 23 | TCP |
| SMTP | 25 | TCP |
| DNS | 53 | UDP/TCP |
| DHCP | 67/68 | UDP |
| TFTP | 69 | UDP |
| HTTP | 80 | TCP |
| NTP | 123 | UDP |
| SNMP | 161/162 | UDP |
| LDAP | 389 | TCP |
| HTTPS | 443 | TCP |
| SMB | 445 | TCP |
| Syslog | 514 | UDP |
| LDAPS | 636 | TCP |
| IMAP | 143 | TCP |
| POP3 | 110 | TCP |
| RADIUS | 1812/1813 | UDP |
| TACACS+ | 49 | TCP |
| RDP | 3389 | TCP |
