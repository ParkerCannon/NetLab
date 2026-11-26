/* NetLab teaching explainers — wireless, Ethernet, OSI and dynamic routing. */
window.NL = window.NL || {};
(function () {
  'use strict';
  const NL = window.NL;
  const $ = id => document.getElementById(id);
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }
  function modal() { return document.querySelector('.modal'); }
  function open(title, sub, body) {
    NL.ui.openModal(title, sub, body, { wide: true });
    return modal();
  }
  function details(items) {
    return '<div class="teach-details">' + items.map(item =>
      '<details' + (item.open ? ' open' : '') + '><summary>' + esc(item.title) + '</summary>' +
      '<div class="detail-body">' + item.body + '</div></details>'
    ).join('') + '</div>';
  }
  function table(headers, rows) {
    return '<table class="teach-table"><tr>' + headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>' +
      rows.map(row => '<tr>' + row.map(cell => '<td>' + cell + '</td>').join('') + '</tr>').join('') + '</table>';
  }

  // =====================================================================
  // Wireless standards
  // =====================================================================
  function openWirelessTool() {
    const standards = [
      { key: 'b', gen: 'Legacy', year: '1999', band: '2.4 GHz', speed: '11 Mbps', width: '20 MHz', tech: 'DSSS', note: 'First common Wi-Fi. Slow but survives distance and obstacles better than later 5 GHz gear.' },
      { key: 'g', gen: 'Legacy', year: '2003', band: '2.4 GHz', speed: '54 Mbps', width: '20 MHz', tech: 'OFDM', note: 'Same 2.4 GHz band as b, but faster with orthogonal frequency-division multiplexing. Backward compatible with b.' },
      { key: 'n', gen: 'Wi-Fi 4', year: '2009', band: '2.4 / 5 GHz', speed: '600 Mbps', width: '20 / 40 MHz', tech: 'MIMO', note: 'Added multiple antennas (MIMO) and 40 MHz channels. The first generation to use both common bands.' },
      { key: 'ac', gen: 'Wi-Fi 5', year: '2013', band: '5 GHz', speed: '~3.5 Gbps', width: '20 / 40 / 80 / 160 MHz', tech: 'MU-MIMO', note: '5 GHz only. Wider channels, 256-QAM and downlink MU-MIMO let one AP serve several clients at once.' },
      { key: 'ax', gen: 'Wi-Fi 6', year: '2019', band: '2.4 / 5 / 6 GHz', speed: '~9.6 Gbps', width: 'up to 160 MHz', tech: 'OFDMA + BSS coloring', note: 'OFDMA splits a channel into smaller resource units so slow clients do not block everyone. Target Wake Time saves battery.' },
      { key: 'be', gen: 'Wi-Fi 7', year: '2024', band: '2.4 / 5 / 6 GHz', speed: '~46 Gbps', width: 'up to 320 MHz', tech: 'MLO + 4096-QAM', note: 'Multi-Link Operation uses several bands at once for speed and reliability. 320 MHz channels exist in the 6 GHz band.' }
    ];
    const channels24 = Array.from({ length: 14 }, (_, i) => i + 1);
    const channels5 = [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120];
    const security = [
      { key: 'wep', title: 'WEP', when: '1997', body: 'RC4 stream cipher with a short 24-bit IV. Broken in minutes; never use it. It is only on the exam as the example of what not to do.' },
      { key: 'wpa', title: 'WPA', when: '2003', body: 'Interim fix using TKIP. Better than WEP but deprecated. It was a stopgap while 802.11i (WPA2) was being finished.' },
      { key: 'wpa2', title: 'WPA2', when: '2004', body: 'AES-CCMP, the long-time standard. Personal mode uses a pre-shared key; Enterprise mode uses 802.1X with a RADIUS server and per-user credentials.' },
      { key: 'wpa3', title: 'WPA3', when: '2018', body: 'SAE replaces the pre-shared key handshake and resists offline dictionary attacks. Enterprise uses 192-bit (Suite B) mode; Opportunistic Wireless Encryption encrypts open networks.' }
    ];

    const body =
      '<p>Wi-Fi is IEEE <b>802.11</b>. The letter after 802.11 identifies an amendment; marketing names (Wi-Fi 4/5/6/6E/7) are friendlier. Pick a standard, channel or security mode below to see what changes.</p>' +
      '<div class="teach-tabs" role="tablist">' +
        '<button class="teach-tab active" data-wifi-tab="standards">Standards</button>' +
        '<button class="teach-tab" data-wifi-tab="bands">Bands & channels</button>' +
        '<button class="teach-tab" data-wifi-tab="security">Security</button>' +
        '<button class="teach-tab" data-wifi-tab="signals">Signals & antennas</button>' +
      '</div>' +

      '<div data-wifi-panel="standards">' +
        '<div class="teach-grid">' + standards.map((s, i) =>
          '<div class="teach-card' + (i === 3 ? ' active' : '') + '" data-wifi-standard="' + s.key + '">' +
            '<b>' + esc(s.gen) + ' · 802.11' + esc(s.key.toUpperCase()) + '</b>' +
            '<span>' + esc(s.year) + ' · ' + esc(s.band) + '<br>' + esc(s.speed) + ' · ' + esc(s.tech) + '</span>' +
          '</div>').join('') +
        '</div>' +
        '<div id="wifiDecode" class="decode-strip" style="margin-top:10px"></div>' +
      '</div>' +

      '<div data-wifi-panel="bands" hidden>' +
        '<div class="band-grid">' +
          '<div class="band-card"><b>2.4 GHz</b><span>14 channels, 20 MHz wide. Only 1, 6 and 11 do not overlap. Longest range, most interference (microwaves, Bluetooth, baby monitors).</span></div>' +
          '<div class="band-card"><b>5 GHz</b><span>Many 20 MHz channels, bondable to 40/80/160 MHz. Shorter range but faster and cleaner. Channels 52–140 may require DFS radar detection.</span></div>' +
          '<div class="band-card"><b>6 GHz (Wi-Fi 6E/7)</b><span>Up to 1200 MHz of fresh spectrum, 59 additional 20 MHz channels, no legacy devices. Shorter range again; walls matter more.</span></div>' +
        '</div>' +
        '<div class="section-title" style="margin-top:14px">2.4 GHz — click a channel</div>' +
        '<div class="channel-row">' + channels24.map(ch =>
          '<div class="channel ' + ([1, 6, 11].includes(ch) ? 'clean' : 'overlap') + '" data-wifi-channel="24:' + ch + '">' + ch + '</div>').join('') + '</div>' +
        '<div class="section-title">5 GHz — representative 20 MHz channels</div>' +
        '<div class="channel-row">' + channels5.map(ch =>
          '<div class="channel ' + ([36, 44, 52, 60, 100, 108, 116].includes(ch) ? 'clean' : 'overlap') + '" data-wifi-channel="5:' + ch + '">' + ch + '</div>').join('') + '</div>' +
        '<div id="wifiChannelInfo" class="result-box" style="margin-top:8px"></div>' +
        '<div class="legend"><span><i class="net"></i>non-overlapping / clean</span><span><i class="host"></i>overlaps neighbors</span></div>' +
      '</div>' +

      '<div data-wifi-panel="security" hidden>' +
        '<div class="security-track">' + security.map(s =>
          '<div class="security-step' + (s.key === 'wpa3' ? ' strong' : '') + '" data-wifi-security="' + s.key + '">' +
            '<b>' + esc(s.title) + '</b><span>' + esc(s.when) + '</span>' +
          '</div>').join('') + '</div>' +
        '<div id="wifiSecurityInfo" class="result-box" style="margin-top:10px"></div>' +
        '<p class="teach-note">Enterprise Wi-Fi uses <b>802.1X</b>: the client (supplicant) authenticates through the AP (authenticator) to a <b>RADIUS</b> server. Personal mode just uses one shared password for everyone.</p>' +
      '</div>' +

      '<div data-wifi-panel="signals" hidden>' +
        '<div class="modal-grid">' +
          '<div class="field"><label>Received signal (dBm)</label><input id="wifiDbm" type="range" min="-95" max="-30" value="-62"></div>' +
          '<div class="field"><label>Signal-to-noise ratio (dB)</label><input id="wifiSnr" type="range" min="0" max="50" value="30"></div>' +
        '</div>' +
        '<div id="wifiSignalBox" class="result-box" style="margin-top:8px"></div>' +
        '<p class="teach-note">dBm is logarithmic: <b>-67 dBm is 10× stronger than -77 dBm</b>. Aim for at least -67 dBm with 25 dB SNR for voice/video. A 3 dB gain doubles power; a 10 dB gain is ten times the power.</p>' +
      '</div>' +

      details([
        { title: 'CSMA/CA — why Wi-Fi waits and listens', open: false, body:
          '<p>Wireless devices cannot reliably detect a collision while transmitting, so 802.11 uses <b>Carrier Sense Multiple Access with Collision Avoidance</b>. A device listens for the medium, waits a random backoff, and may send a short <b>RTS/CTS</b> exchange to reserve the air. An AP can ask the recipient to send an <b>ACK</b>; missing ACKs trigger a retry.</p>' +
          '<p>This is different from wired Ethernet’s old <b>CSMA/CD</b> (collision detection). Modern switched Ethernet is full-duplex, so collisions are essentially gone — but Wi-Fi still shares one radio medium.</p>' },
        { title: 'OFDM, OFDMA, MU-MIMO and beamforming', open: false, body:
          '<p><b>OFDM</b> (802.11a/g) splits a channel into many narrow subcarriers, resists multipath interference and is far more efficient than the old DSSS used by 802.11b.</p>' +
          '<p><b>OFDMA</b> (Wi-Fi 6) goes further: different clients get different subsets of subcarriers in the same transmission, which cuts latency in crowded places. <b>MU-MIMO</b> uses multiple antennas to talk to several clients at the same time using different spatial streams. <b>Beamforming</b> phases the antenna signals toward a client instead of spraying them everywhere.</p>' },
        { title: 'Roaming: 802.11r, 802.11k and 802.11v', open: false, body:
          '<p><b>802.11k</b> lets an AP give a client a neighbor report so it does not have to scan every channel. <b>802.11v</b> lets the network suggest a better AP and manage load. <b>802.11r</b> (fast BSS transition) pre-authenticates with the next AP so voice calls do not drop while moving.</p>' +
          '<p>All three need the same SSID/security across APs and a controller or coordinated system to work well.</p>' },
        { title: 'Antennas, dBm, dBi and EIRP', open: false, body:
          '<p><b>dBm</b> measures power relative to 1 milliwatt: 0 dBm = 1 mW, 20 dBm = 100 mW. <b>dBi</b> measures antenna gain compared with an isotropic radiator. <b>EIRP</b> is transmitter power plus antenna gain minus cable loss, and regulators cap it.</p>' +
          '<p>Omnidirectional antennas cover a donut shape; directional antennas focus energy into a beam for point-to-point links. A higher-gain antenna does not create power — it steers it.</p>' },
        { title: 'Choosing 2.4, 5 or 6 GHz', open: false, body:
          '<p>Use <b>2.4 GHz</b> for range and simple IoT gear; pick channels 1, 6 or 11 and keep 20 MHz width in dense areas. Use <b>5 GHz</b> for speed and cleaner spectrum, with 40/80 MHz where you control the environment. Use <b>6 GHz</b> when every device supports it and you need very wide channels with no legacy clients.</p>' +
          '<p>Higher frequencies carry more data but attenuate faster and penetrate walls worse. More bandwidth also raises the noise floor: doubling channel width roughly doubles noise.</p>' },
        { title: 'Wi-Fi vs Bluetooth, Zigbee and cellular', open: false, body:
          table(['Technology', 'Standard', 'Range', 'Use'], [
            ['Wi-Fi', '802.11', 'tens of metres', 'High-throughput LAN access'],
            ['Bluetooth', '802.15.1', '1–10 m', 'Headsets, peripherals, beacons'],
            ['Zigbee / Thread', '802.15.4', '10–100 m mesh', 'Low-power sensors, smart home'],
            ['Cellular', '3GPP 4G/5G', 'km', 'Wide-area mobile data, licensed spectrum']
          ]) +
          '<p>Bluetooth and Zigbee also use 2.4 GHz, which is why a crowded band can upset all of them. Cellular uses licensed spectrum and a completely different core network.</p>' },
        { title: 'Wi-Fi 6E and Wi-Fi 7 exam notes', open: false, body:
          '<p><b>Wi-Fi 6E</b> is simply Wi-Fi 6 extended into 6 GHz. The “E” does not mean a new 802.11 amendment. <b>Wi-Fi 7</b> is 802.11be: 320 MHz channels, 4096-QAM, Multi-Link Operation, and up to 16 spatial streams.</p>' +
          '<p>Remember the marketing mapping: Wi-Fi 4 = 802.11n, 5 = ac, 6/6E = ax, 7 = be. Network+ questions often mix the two naming schemes.</p>' }
      ]);

    const root = open('Wireless standards', '802.11, bands, security and signals', body);
    if (!root) return;

    root.querySelectorAll('[data-wifi-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('[data-wifi-tab]').forEach(b => b.classList.toggle('active', b === btn));
        root.querySelectorAll('[data-wifi-panel]').forEach(p => { p.hidden = p.dataset.wifiPanel !== btn.dataset.wifiTab; });
      });
    });

    const decode = $('wifiDecode');
    function pickStandard(key) {
      const s = standards.find(x => x.key === key) || standards[3];
      root.querySelectorAll('[data-wifi-standard]').forEach(c => c.classList.toggle('active', c.dataset.wifiStandard === s.key));
      decode.innerHTML = [
        ['Generation', s.gen + ' · 802.11' + s.key.toUpperCase()],
        ['Released', s.year],
        ['Band', s.band],
        ['Max rate', s.speed],
        ['Channel width', s.width],
        ['Key technique', s.tech]
      ].map(p => '<div class="decode-part' + (p[0] === 'Max rate' ? ' on' : '') + '"><small>' + esc(p[0]) + '</small><b>' + esc(p[1]) + '</b></div>').join('') +
        '<div class="teach-card" style="flex-basis:100%"><span>' + esc(s.note) + '</span></div>';
    }
    root.querySelectorAll('[data-wifi-standard]').forEach(c => c.addEventListener('click', () => pickStandard(c.dataset.wifiStandard)));
    pickStandard('ac');

    const channelInfo = $('wifiChannelInfo');
    root.querySelectorAll('[data-wifi-channel]').forEach(ch => {
      ch.addEventListener('click', () => {
        root.querySelectorAll('[data-wifi-channel]').forEach(c => c.style.outline = '');
        ch.style.outline = '2px solid var(--cyan)';
        const [band, num] = ch.dataset.wifiChannel.split(':');
        const n = Number(num);
        let title, text;
        if (band === '24') {
          const center = 2407 + n * 5;
          const clean = [1, 6, 11].includes(n);
          title = 'Channel ' + n + ' · ' + center + ' MHz · ' + (clean ? 'clean' : 'overlaps');
          text = clean
            ? 'This is one of the three 2.4 GHz channels whose 20 MHz footprint does not overlap the others. Use 1, 6 or 11 in a multi-AP site.'
            : 'A 20 MHz 2.4 GHz channel spans ±10 MHz around its center. Channels only 5 numbers apart overlap heavily — overlap causes co-channel interference, not just "same number" interference.';
        } else {
          const center = 5000 + n * 5;
          const dfs = n >= 52 && n <= 140;
          title = 'Channel ' + n + ' · ' + center + ' MHz' + (dfs ? ' · DFS' : '');
          text = dfs
            ? 'This channel sits in the Dynamic Frequency Selection range. An AP must detect radar and move if it hears any, which can cause a delay when the radio starts.'
            : 'Unlicensed 5 GHz channels are 4 numbers apart (20 MHz each). Bonding 36+40 gives 40 MHz, 36+40+44+48 gives 80 MHz.';
        }
        channelInfo.innerHTML = '<div class="result-row"><span>' + esc(title) + '</span><b class="big-answer">' + esc(num) + '</b></div>' +
          '<div class="result-row"><span>What it means</span><b>' + esc(text) + '</b></div>';
      });
    });

    const securityInfo = $('wifiSecurityInfo');
    function pickSecurity(key) {
      const s = security.find(x => x.key === key) || security[3];
      root.querySelectorAll('[data-wifi-security]').forEach(c => c.classList.toggle('strong', c.dataset.wifiSecurity === s.key && s.key === 'wpa3' || c.dataset.wifiSecurity === s.key && c.classList.contains('active')));
      root.querySelectorAll('[data-wifi-security]').forEach(c => c.style.borderColor = c.dataset.wifiSecurity === s.key ? 'rgba(56,217,255,.55)' : '');
      securityInfo.innerHTML = '<div class="result-row"><span>' + esc(s.title + ' · ' + s.when) + '</span><b class="big-answer">' + esc(s.title) + '</b></div>' +
        '<div class="result-row"><span>Why it matters</span><b>' + esc(s.body) + '</b></div>';
    }
    root.querySelectorAll('[data-wifi-security]').forEach(c => c.addEventListener('click', () => pickSecurity(c.dataset.wifiSecurity)));
    pickSecurity('wpa3');

    const dbmEl = $('wifiDbm'), snrEl = $('wifiSnr'), signalBox = $('wifiSignalBox');
    function signal() {
      const dbm = Number(dbmEl.value), snr = Number(snrEl.value);
      const quality = Math.max(2, Math.min(100, Math.round((dbm + 95) / 65 * 100)));
      let label = 'Unusable', kind = 'err', advice = 'Move closer, remove obstacles or use a lower band.';
      if (dbm >= -50) { label = 'Excellent'; kind = 'ok'; advice = 'Plenty of margin for video calls and roaming.'; }
      else if (dbm >= -67) { label = 'Good'; kind = 'ok'; advice = 'Healthy for most applications; watch SNR in busy areas.'; }
      else if (dbm >= -75) { label = 'Fair'; kind = 'warn'; advice = 'Basic web works, but video and roaming may stutter.'; }
      else if (dbm >= -85) { label = 'Weak'; kind = 'warn'; advice = 'Expect retries and low data rates. Add an AP or better antenna.'; }
      const snrLabel = snr >= 25 ? 'Clean' : snr >= 15 ? 'Noisy' : 'Very noisy';
      signalBox.innerHTML =
        '<div class="result-row"><span>Signal strength</span><b class="big-answer ' + (kind === 'ok' ? 'ok-text' : kind === 'err' ? 'err-text' : 'warn-text') + '">' + dbm + ' dBm · ' + label + '</b></div>' +
        '<div class="dbm-meter"><i style="width:' + quality + '%"></i></div>' +
        '<div class="result-row"><span>SNR</span><b>' + snr + ' dB · ' + snrLabel + '</b></div>' +
        '<div class="result-row"><span>Practical advice</span><b>' + esc(advice) + '</b></div>';
    }
    dbmEl.addEventListener('input', signal);
    snrEl.addEventListener('input', signal);
    signal();
  }

  // =====================================================================
  // Ethernet standards
  // =====================================================================
  function openEthernetTool() {
    const standards = [
      ['10BASE-T', '10 Mbps', 'Twisted pair (Cat3+)', '100 m', 'Original structured Ethernet; half-duplex hubs.'],
      ['100BASE-TX', '100 Mbps', 'Twisted pair (Cat5)', '100 m', 'Fast Ethernet; still common on old switches.'],
      ['1000BASE-T', '1 Gbps', 'Twisted pair (Cat5e)', '100 m', 'Uses all four pairs; the modern copper desktop standard.'],
      ['1000BASE-SX', '1 Gbps', 'Multimode fiber', '550 m', 'Short-wave laser over multimode fiber; common in buildings.'],
      ['10GBASE-T', '10 Gbps', 'Twisted pair (Cat6a)', '100 m', 'Ten-gigabit copper; Cat6 only reaches ~55 m.'],
      ['10GBASE-SR', '10 Gbps', 'Multimode fiber', '400 m', 'Short reach fiber inside a data center.'],
      ['40GBASE-LR4', '40 Gbps', 'Single-mode fiber', '10 km', 'Four lanes on one fiber for long runs.'],
      ['100GBASE-SR4', '100 Gbps', 'Multimode fiber', '100 m', 'Four parallel 25 Gbps lanes; data-center spine/leaf.']
    ];
    const cables = [
      { key: 'cat3', title: 'Cat3', line: '10 Mbps', detail: 'Voice-grade cable used by original 10BASE-T. 100 MHz? No — only 16 MHz bandwidth. Replaced long ago.' },
      { key: 'cat5', title: 'Cat5', line: '100 Mbps', detail: '100 MHz cable that made Fast Ethernet common. Superseded by Cat5e.' },
      { key: 'cat5e', title: 'Cat5e', line: '1 Gbps', detail: 'Enhanced Cat5 with tighter specs and crosstalk testing. The minimum for 1000BASE-T at 100 m.' },
      { key: 'cat6', title: 'Cat6', line: '1 / 10 Gbps', detail: '250 MHz. 10GBASE-T reaches about 55 m; 1 Gbps reaches 100 m.' },
      { key: 'cat6a', title: 'Cat6a', line: '10 Gbps', detail: 'Augmented Cat6 at 500 MHz, fully supports 10GBASE-T to 100 m.' },
      { key: 'cat8', title: 'Cat8', line: '25 / 40 Gbps', detail: '2000 MHz, shielded, up to 30 m. Designed for switch-to-switch data-center links, not horizontal runs.' }
    ];

    const body =
      '<p>Ethernet is IEEE <b>802.3</b>. The standard name encodes speed, signalling and medium. Type a name below or click a row to decode it.</p>' +
      '<div class="teach-tabs" role="tablist">' +
        '<button class="teach-tab active" data-eth-tab="decode">Standards decoder</button>' +
        '<button class="teach-tab" data-eth-tab="frame">Frame & cabling</button>' +
        '<button class="teach-tab" data-eth-tab="switching">Switching & PoE</button>' +
      '</div>' +

      '<div data-eth-panel="decode">' +
        '<div class="modal-grid">' +
          '<div class="field"><label>Ethernet standard</label><input id="ethDetect" value="1000BASE-SX" autocomplete="off" spellcheck="false"></div>' +
          '<div class="field"><label>Quick pick</label><select id="ethPreset">' + standards.map(s => '<option value="' + esc(s[0]) + '">' + esc(s[0]) + '</option>').join('') + '</select></div>' +
        '</div>' +
        '<div id="ethDecode" class="decode-strip" style="margin-top:10px"></div>' +
        '<div style="margin-top:14px">' + table(['Standard', 'Speed', 'Medium', 'Max distance', 'Exam note'],
          standards.map(s => ['<b>' + esc(s[0]) + '</b>', esc(s[1]), esc(s[2]), esc(s[3]), esc(s[4])])) + '</div>' +
      '</div>' +

      '<div data-eth-panel="frame" hidden>' +
        '<div class="section-title">Ethernet II frame with an optional 802.1Q tag</div>' +
        '<div class="frame-map" id="ethFrameMap">' +
          '<div class="frame-seg s1" data-eth-seg="preamble">Preamble · 7 B</div>' +
          '<div class="frame-seg s1" data-eth-seg="sfd">SFD · 1 B</div>' +
          '<div class="frame-seg s2" data-eth-seg="dst">Dest MAC · 6 B</div>' +
          '<div class="frame-seg s2" data-eth-seg="src">Src MAC · 6 B</div>' +
          '<div class="frame-seg s3" id="ethVlanSeg" data-eth-seg="vlan">802.1Q · 4 B</div>' +
          '<div class="frame-seg s4" data-eth-seg="type">EtherType · 2 B</div>' +
          '<div class="frame-seg s5" data-eth-seg="payload">Payload · 46–1500 B</div>' +
          '<div class="frame-seg s1" data-eth-seg="fcs">FCS · 4 B</div>' +
        '</div>' +
        '<label class="chip" style="cursor:pointer"><input type="checkbox" id="ethVlanToggle"> include 802.1Q VLAN tag</label>' +
        '<div id="ethFrameInfo" class="result-box" style="margin-top:8px"></div>' +
        '<div class="section-title" style="margin-top:14px">Copper cable categories — click one</div>' +
        '<div class="cable-scale">' + cables.map(c =>
          '<div class="cable-step" data-eth-cable="' + c.key + '"><b>' + esc(c.title) + '</b><span>' + esc(c.line) + '</span></div>').join('') + '</div>' +
        '<div id="ethCableInfo" class="result-box" style="margin-top:8px"></div>' +
      '</div>' +

      '<div data-eth-panel="switching" hidden>' +
        '<div class="teach-grid">' +
          '<div class="teach-card"><b>Auto-negotiation</b><span>Ports exchange capability pages and pick the highest speed and duplex both support. A speed/duplex mismatch causes CRC errors and slow performance.</span></div>' +
          '<div class="teach-card"><b>Full vs half duplex</b><span>Half duplex uses CSMA/CD and one pair at a time. Full duplex uses separate transmit and receive paths — no collisions, no need to listen while sending.</span></div>' +
          '<div class="teach-card"><b>CSMA/CD</b><span>Legacy hubs and shared coax: listen before sending, detect collisions, jam, then back off randomly. Switched full-duplex Ethernet made it obsolete.</span></div>' +
          '<div class="teach-card"><b>STP / RSTP</b><span>Spanning Tree blocks redundant Layer 2 paths to prevent loops. RSTP (802.1w) converges in seconds instead of 30–50.</span></div>' +
          '<div class="teach-card"><b>LACP / EtherChannel</b><span>802.3ad bundles parallel links into one logical link, adding bandwidth and redundancy without STP blocking the extras.</span></div>' +
          '<div class="teach-card"><b>Jumbo frames</b><span>Frames larger than 1500 bytes cut per-packet overhead on storage networks. Every device on the path must support the same MTU or fragments/drops occur.</span></div>' +
        '</div>' +
        '<div class="section-title" style="margin-top:14px">Power over Ethernet</div>' +
        table(['Standard', 'Name', 'Power at PSE', 'Typical device'], [
          ['802.3af', 'PoE', '15.4 W', 'IP phone, basic camera'],
          ['802.3at', 'PoE+', '30 W', 'PTZ camera, Wi-Fi 5 AP'],
          ['802.3bt Type 3', 'PoE++', '60 W', 'Wi-Fi 6/6E AP, display'],
          ['802.3bt Type 4', 'PoE++', '90–100 W', 'High-power AP, thin client']
        ]) +
        '<p class="teach-note">The <b>PSE</b> (power sourcing equipment) is the switch or injector; the <b>PD</b> (powered device) is the phone/AP/camera. PoE uses the spare pairs or phantom power on the data pairs, and the switch budget must cover every PD.</p>' +
      '</div>' +

      details([
        { title: 'RJ45 and T568B pinout', open: true, body:
          table(['Pin', 'T568B', 'Use (10/100)', 'Use (1000BASE-T)'], [
            ['1', 'Orange-white', 'TX+', 'BI_DA+'], ['2', 'Orange', 'TX−', 'BI_DA−'],
            ['3', 'Green-white', 'RX+', 'BI_DB+'], ['4', 'Blue', 'unused', 'BI_DC+'],
            ['5', 'Blue-white', 'unused', 'BI_DC−'], ['6', 'Green', 'RX−', 'BI_DB−'],
            ['7', 'Brown-white', 'unused', 'BI_DD+'], ['8', 'Brown', 'unused', 'BI_DD−']
          ]) +
          '<p>T568A swaps the orange and green pairs. A <b>straight-through</b> cable uses the same standard on both ends; a <b>crossover</b> uses T568A on one end and T568B on the other. Auto-MDIX now handles this automatically. Never confuse a network crossover with a <b>rollover</b> console cable.</p>' },
        { title: 'Multimode vs single-mode fiber', open: false, body:
          '<p><b>Multimode fiber (MMF)</b> has a 50 or 62.5 µm core and carries several light paths (modes). It is cheaper for short runs and uses LEDs or VCSELs at 850/1300 nm. <b>Single-mode fiber (SMF)</b> has a ~9 µm core, one path, and uses lasers at 1310/1550 nm for long distances.</p>' +
          '<p>Common connectors: LC (small, used on SFPs), SC (square), and older ST. The transceiver must match the fiber and distance: SR = short reach (MMF), LR = long reach (SMF), ER = extended reach.</p>' },
        { title: 'Why Ethernet frames have a minimum size', open: false, body:
          '<p>Half-duplex Ethernet had to keep transmitting long enough for a collision anywhere on the cable to travel back. At 10 Mbps that required <b>64 bytes</b> from destination MAC through FCS. A tiny payload is padded to reach that minimum.</p>' +
          '<p>Untagged frames are 64–1518 bytes (not counting the 8-byte preamble/SFD); adding a 4-byte 802.1Q tag makes them 68–1522. Switches forward based on the destination MAC; the FCS is checked and regenerated at every hop.</p>' },
        { title: 'Auto-negotiation and duplex mismatch', open: false, body:
          '<p>Ports advertise speeds and duplex using fast link pulses. Both sides choose the best common mode. If one side is hard-coded 100/full and the other negotiates 100/half, the full-duplex side sees late collisions and the half-duplex side sees CRC errors and FCS failures — the link "works" but performs terribly.</p>' +
          '<p>Use <code>show interfaces</code> to look for collisions, CRC errors and duplex settings. On modern networks, leave auto-negotiation on.</p>' },
        { title: 'Collision domains vs broadcast domains', open: false, body:
          '<p>A <b>hub</b> repeats every frame out every port: one collision domain and one broadcast domain. A <b>switch</b> gives each port its own collision domain but all ports share a broadcast domain. A <b>router</b> separates broadcast domains and does not forward broadcasts by default.</p>' +
          '<p>VLANs let one physical switch create several broadcast domains. Trunk ports carry tagged frames between switches so a VLAN can span multiple closets.</p>' },
        { title: '802.1Q tags and native VLANs', open: false, body:
          '<p>An 802.1Q tag inserts a 4-byte field after the source MAC: 2-byte TPID (0x8100), a 12-bit VLAN ID, priority bits and a DEI bit. Only the 12-bit VLAN ID matters for most exam questions (1–4094).</p>' +
          '<p>The <b>native VLAN</b> on a trunk is sent untagged. Both ends must agree, or frames can "leak" between VLANs — one reason to use an unused VLAN as the native VLAN.</p>' }
      ]);

    const root = open('Ethernet standards', 'Decode 802.3 names, frames, cabling and PoE', body);
    if (!root) return;

    root.querySelectorAll('[data-eth-tab]').forEach(btn => btn.addEventListener('click', () => {
      root.querySelectorAll('[data-eth-tab]').forEach(b => b.classList.toggle('active', b === btn));
      root.querySelectorAll('[data-eth-panel]').forEach(p => { p.hidden = p.dataset.ethPanel !== btn.dataset.ethTab; });
    }));

    const detect = $('ethDetect'), preset = $('ethPreset'), decodeBox = $('ethDecode');
    function decodeEth(value) {
      const raw = String(value || '').trim().toUpperCase();
      const m = raw.match(/^(\d+(?:\.\d+)?)\s*(G|M)?BASE[- ]?(TX|LR4|SR4|T|SX|LX|LR|SR|ER|CX|K4|R)$/);
      const known = standards.find(s => s[0] === raw);
      let speed = '—', medium = '—', hint = '—', valid = false;
      if (m) {
        speed = (m[1] + (m[2] === 'G' ? ' Gbps' : m[2] === 'M' ? ' Mbps' : ' Mbps')) || '—';
        if (m[2] === undefined) speed = m[1] === '10' ? '10 Mbps' : m[1] === '100' ? '100 Mbps' : m[1] + ' Gbps (assumed)';
        const code = m[3];
        medium = ({ T: 'Twisted pair copper', TX: 'Twisted pair copper', SX: 'Multimode fiber (short)', LX: 'Single-mode fiber (long)',
          LR: 'Single-mode fiber (long reach)', LR4: '4-lane single-mode fiber (long reach)',
          SR: 'Multimode fiber (short reach)', SR4: '4-lane multimode fiber (short reach)',
          ER: 'Single-mode fiber (extended reach)', CX: 'Coax / copper backplane',
          K4: '4-lane copper/fiber', R: 'Serial fiber' })[code] || code;
        const copper = code === 'T' || code === 'TX' || code === 'K4' || code === 'CX';
        hint = copper ? 'T/TX = twisted pair copper; usually 100 m.' :
          code.includes('X') || code.includes('R') ? 'Fiber variant — check multimode vs single-mode and reach.' :
          'Remember: speed + BASE + medium.';
        valid = true;
      }
      const help = !valid
        ? 'Try a name like 10BASE-T, 100BASE-TX, 1000BASE-T, 1000BASE-SX or 10GBASE-LR4.'
        : (known ? known[4] : hint);
      decodeBox.innerHTML = [
        ['Raw name', raw || '—'], ['Speed', speed], ['Signalling', valid ? 'BASE (baseband)' : '—'],
        ['Medium', medium], ['Exam note', help]
      ].map(p => '<div class="decode-part' + (p[0] === 'Speed' ? ' on' : '') + '"><small>' + esc(p[0]) + '</small><b>' + esc(p[1]) + '</b></div>').join('');
    }
    detect.addEventListener('input', () => decodeEth(detect.value));
    preset.addEventListener('change', () => { detect.value = preset.value; decodeEth(detect.value); });
    root.querySelectorAll('.teach-table td b').forEach(cell => cell.style.cursor = 'pointer');
    root.querySelectorAll('[data-eth-panel="decode"] .teach-table tr').forEach(row => {
      row.addEventListener('click', () => {
        const name = row.querySelector('td b');
        if (!name) return;
        detect.value = name.textContent; preset.value = name.textContent; decodeEth(detect.value);
      });
    });
    decodeEth(detect.value);

    const vlanToggle = $('ethVlanToggle'), frameMap = $('ethFrameMap'), frameInfo = $('ethFrameInfo');
    const frameDetails = {
      preamble: '7 bytes of alternating 1010… that synchronize receiver clocks.',
      sfd: 'Start Frame Delimiter (10101011) marks the start of the actual frame.',
      dst: 'Destination MAC: unicast, multicast or broadcast (FF:FF:FF:FF:FF:FF).',
      src: 'Source MAC: the address the switch learns from.',
      vlan: '802.1Q tag: TPID 0x8100 plus a 12-bit VLAN ID and priority bits.',
      type: 'EtherType 0x0800 = IPv4, 0x86DD = IPv6, 0x8100 = VLAN tag.',
      payload: 'The upper-layer PDU. Minimum 46 bytes so the whole frame reaches 64 bytes; maximum usually 1500.',
      fcs: '4-byte CRC. A mismatch means the frame was corrupted and is silently dropped.'
    };
    function frame() {
      const tagged = vlanToggle.checked;
      $('ethVlanSeg').style.display = tagged ? '' : 'none';
      const min = tagged ? 68 : 64, max = tagged ? 1522 : 1518;
      frameInfo.innerHTML =
        '<div class="result-row"><span>Frame size</span><b class="big-answer">' + min + '–' + max + ' bytes</b></div>' +
        '<div class="result-row"><span>Tag</span><b>' + (tagged ? '802.1Q present — VLAN ID is in the frame header' : 'untagged / native VLAN') + '</b></div>' +
        '<div class="result-row"><span>Click a segment</span><b id="ethSegText">Destination MAC, source MAC, type, payload and FCS travel in every frame.</b></div>';
    }
    root.querySelectorAll('[data-eth-seg]').forEach(seg => seg.addEventListener('click', () => {
      const text = $('ethSegText');
      if (text) text.textContent = frameDetails[seg.dataset.ethSeg] || '';
    }));
    vlanToggle.addEventListener('change', frame);
    frame();

    const cableInfo = $('ethCableInfo');
    root.querySelectorAll('[data-eth-cable]').forEach(c => c.addEventListener('click', () => {
      const item = cables.find(x => x.key === c.dataset.ethCable);
      root.querySelectorAll('[data-eth-cable]').forEach(x => x.classList.toggle('active', x === c));
      cableInfo.innerHTML = '<div class="result-row"><span>' + esc(item.title) + '</span><b class="big-answer">' + esc(item.line) + '</b></div>' +
        '<div class="result-row"><span>Exam note</span><b>' + esc(item.detail) + '</b></div>';
    }));
    root.querySelector('[data-eth-cable="cat6a"]').click();
  }

  // =====================================================================
  // OSI model
  // =====================================================================
  function openOSITool() {
    const layers = [
      { n: 1, name: 'Physical', pdu: 'Bits', addr: 'None — electrical/optical signal', protocols: 'Ethernet physical layer, 802.11 radio, DSL, SONET, RJ45, fiber', devices: 'Hub, repeater, cable, NIC, antenna', question: 'Is the cable plugged in? Link light? Wrong medium, speed or duplex?', attacks: 'Wiretapping, signal jamming, physical access', tcpip: 'Network access / link' },
      { n: 2, name: 'Data Link', pdu: 'Frame', addr: 'MAC address (EUI-48)', protocols: 'Ethernet 802.3, Wi-Fi 802.11, ARP, PPP, HDLC, STP, VLAN 802.1Q', devices: 'Switch, bridge, AP, NIC', question: 'Is the MAC table learning? Trunk VLAN allowed? CRC errors?', attacks: 'MAC flooding, ARP spoofing, VLAN hopping', tcpip: 'Network access / link' },
      { n: 3, name: 'Network', pdu: 'Packet', addr: 'IP address (IPv4/IPv6)', protocols: 'IP, ICMP, IPsec, RIP, OSPF, EIGRP, IS-IS, BGP, IGMP', devices: 'Router, Layer 3 switch', question: 'Is there a route? Wrong mask/gateway? TTL expiring?', attacks: 'IP spoofing, ICMP floods, route poisoning', tcpip: 'Internet' },
      { n: 4, name: 'Transport', pdu: 'Segment / datagram', addr: 'TCP/UDP port number', protocols: 'TCP (reliable, ordered), UDP (fast, connectionless), TLS/SSL sits above', devices: 'Firewall, load balancer (port-aware)', question: 'Is the port open? Firewall blocking? TCP handshake failing?', attacks: 'SYN flood, port scanning, session hijacking', tcpip: 'Transport' },
      { n: 5, name: 'Session', pdu: 'Data', addr: 'Session ID / socket', protocols: 'NetBIOS, RPC, PPTP, SQL sessions, TLS session resumption', devices: 'Firewall, application gateway', question: 'Is the session established? Timed out? Auth token expired?', attacks: 'Session fixation, replay, session hijacking', tcpip: 'Application' },
      { n: 6, name: 'Presentation', pdu: 'Data', addr: 'Format / encoding', protocols: 'TLS/SSL, JPEG, GIF, MPEG, ASCII, Unicode, gzip, ASN.1', devices: 'Application gateway', question: 'Encoding, compression or encryption mismatch? Certificate name wrong?', attacks: 'Downgrade attacks, malformed input, cross-site scripting', tcpip: 'Application' },
      { n: 7, name: 'Application', pdu: 'Data', addr: 'Application name / user', protocols: 'HTTP, HTTPS, DNS, DHCP, SMTP, FTP, SSH, SNMP, NTP, Telnet', devices: 'PC, server, firewall (app-aware)', question: 'Is the service running? DNS correct? Credentials valid?', attacks: 'Phishing, malware, SQL injection, DoS', tcpip: 'Application' }
    ];
    const body =
      '<p>The OSI model is a <b>teaching map</b>, not a protocol. It separates responsibilities so you can troubleshoot methodically. Click a layer to see its PDU, addresses, protocols, devices and likely failures.</p>' +
      '<div class="osi-layout">' +
        '<div class="layer-stack">' + layers.map(l =>
          '<div class="layer-row' + (l.n === 3 ? ' active' : '') + '" data-osi-layer="' + l.n + '">' +
            '<span class="layer-num">' + l.n + '</span><span class="layer-name">' + esc(l.name) + '</span>' +
          '</div>').join('') + '</div>' +
        '<div class="layer-detail" id="osiDetail"></div>' +
      '</div>' +
      '<div class="section-title" style="margin-top:14px">Encapsulation on the way down · decapsulation on the way up</div>' +
      '<div class="encap-track" id="osiEncap">' +
        ['Data', 'Segment', 'Packet', 'Frame', 'Bits'].map((x, i) =>
          '<div class="encap-item' + (i === 2 ? ' on' : '') + '" data-osi-pdu="' + x + '">' + x + '</div>').join('') +
      '</div>' +
      '<p class="teach-note">At the sender, each layer adds its own header (and the Data Link layer adds a trailer). At the receiver, each layer removes the header meant for it and hands the rest upward. A router stops at Layer 3; a switch stops at Layer 2.</p>' +

      details([
        { title: 'OSI vs TCP/IP model', open: true, body:
          table(['OSI layer', 'TCP/IP (4-layer)', 'What lives there'], [
            ['7 Application, 6 Presentation, 5 Session', 'Application', 'HTTP, DNS, TLS, SMB, SNMP'],
            ['4 Transport', 'Transport', 'TCP, UDP'],
            ['3 Network', 'Internet', 'IP, ICMP, routing protocols'],
            ['2 Data Link, 1 Physical', 'Network access / link', 'Ethernet, Wi-Fi, ARP, cables']
          ]) +
          '<p>OSI is a detailed reference; TCP/IP describes the protocol suite actually used on the Internet. Do not expect a clean one-to-one mapping — TLS, for example, spans session/presentation concerns but sits logically above TCP.</p>' },
        { title: 'Encapsulation walk-through: a web request', open: false, body:
          '<p><b>Application:</b> browser creates an HTTP GET. <b>Presentation:</b> TLS encrypts it. <b>Session:</b> a TLS session and TCP connection stay open. <b>Transport:</b> TCP adds source/destination port 443 and sequence numbers → segment. <b>Network:</b> IP adds source/destination addresses and TTL → packet. <b>Data Link:</b> Ethernet adds MAC addresses and FCS → frame. <b>Physical:</b> the NIC sends bits as electrical or radio signals.</p>' +
          '<p>At each router, the frame is stripped, the IP packet is examined, a new frame is built for the next link, and TTL is reduced. The IP addresses stay the same; the MAC addresses change at every hop.</p>' },
        { title: 'Troubleshoot from the bottom up (or top down)', open: false, body:
          '<p><b>Bottom-up:</b> cable/link lights (1) → MAC/switch/VLAN (2) → IP/route (3) → port/firewall (4) → name/service (7). This is best when nothing works at all.</p>' +
          '<p><b>Top-down:</b> test the application, then DNS, then ping, then the lower layers. This is often faster when only one service fails. NetLab labs are built for the bottom-up approach: fix IPs, watch ARP, then ping.</p>' },
        { title: 'Where common protocols really sit', open: false, body:
          table(['Protocol', 'Layer', 'Why'], [
            ['ARP', '2 (sometimes called 2.5)', 'Maps IPv4 → MAC for the next hop; it is encapsulated directly in Ethernet.'],
            ['DHCP', '7 using UDP at 4', 'Application service that hands out IP settings.'],
            ['DNS', '7 using UDP/TCP at 4', 'Name resolution application.'],
            ['ICMP', '3', 'Uses IP directly; ping and Time Exceeded messages.'],
            ['TLS', '6/5', 'Encryption and session state above TCP.'],
            ['NAT', '3/4', 'Rewrites IP addresses and ports.'],
            ['ACL', '3 or 2/4', 'Can filter by IP, MAC or port depending on where it is applied.'],
            ['STP', '2', 'Prevents Layer 2 loops.']
          ]) +
          '<p>Exam questions care that you can justify the layer by what the protocol uses for addressing and what information it needs.</p>' },
        { title: 'PDUs and addressing summary', open: false, body:
          '<p><b>Data</b> (5–7) → <b>Segment</b> (4, TCP) → <b>Datagram</b> (4, UDP) → <b>Packet</b> (3) → <b>Frame</b> (2) → <b>Bits</b> (1).</p>' +
          '<p>Addresses answer "where": MAC for the next interface on this link, IP for the final destination across networks, port for the application process on a host. A full path needs all three.</p>' },
        { title: 'Security by layer', open: false, body:
          '<p>Defense in depth means controls at several layers: physical locks and port security (1/2), DHCP snooping and dynamic ARP inspection (2), ACLs and IPsec (3), firewalls and TLS (4/6), MFA and application hardening (7).</p>' +
          '<p>Knowing the layer tells you which device can enforce the control: a normal switch cannot inspect TCP ports, and a router does not normally decrypt TLS.</p>' }
      ]);

    const root = open('The OSI model', 'Seven layers, PDUs, protocols and troubleshooting', body);
    if (!root) return;
    const detail = $('osiDetail');
    const pduFor = n => n >= 5 ? 'Data' : n === 4 ? 'Segment / datagram' : n === 3 ? 'Packet' : n === 2 ? 'Frame' : 'Bits';
    function pick(n) {
      const l = layers.find(x => x.n === Number(n)) || layers[2];
      root.querySelectorAll('[data-osi-layer]').forEach(row => row.classList.toggle('active', Number(row.dataset.osiLayer) === l.n));
      root.querySelectorAll('[data-osi-pdu]').forEach(p => p.classList.toggle('on', p.dataset.osiPdu === pduFor(l.n) ||
        (pduFor(l.n) === 'Data' && p.dataset.osiPdu === 'Data')));
      detail.innerHTML =
        '<div class="layer-title">' + l.n + '. ' + esc(l.name) + '</div>' +
        '<div class="layer-sub">Layer ' + l.n + ' is responsible for ' + esc(l.name.toLowerCase()) + ' concerns. TCP/IP maps this to the <b>' + esc(l.tcpip) + '</b> layer.</div>' +
        '<div class="layer-grid">' +
          '<div><span>PDU</span><b>' + esc(l.pdu) + '</b></div>' +
          '<div><span>Addressing</span><b>' + esc(l.addr) + '</b></div>' +
          '<div><span>Protocols</span><b>' + esc(l.protocols) + '</b></div>' +
          '<div><span>Devices</span><b>' + esc(l.devices) + '</b></div>' +
          '<div><span>Ask when broken</span><b>' + esc(l.question) + '</b></div>' +
          '<div><span>Typical attacks</span><b>' + esc(l.attacks) + '</b></div>' +
        '</div>';
    }
    root.querySelectorAll('[data-osi-layer]').forEach(row => row.addEventListener('click', () => pick(row.dataset.osiLayer)));
    pick(3);
  }

  // =====================================================================
  // Dynamic routing visualizer
  // =====================================================================
  function openRoutingVisualizer() {
    const protocols = {
      rip: {
        name: 'RIP', full: 'Routing Information Protocol', kind: 'IGP · distance vector',
        algorithm: 'Bellman-Ford distance vector', metric: 'Hop count (max 15; 16 = unreachable)',
        ad: '120', timer: 'Updates every 30 s · 180 s invalid · 240 s flush',
        transport: 'UDP port 520', extra: 'Split horizon / poison reverse prevent loops.',
        runnable: false,
        steps: [
          { text: 'R1 boots. Its routing table starts with only its two connected networks.', links: [], node: 'R1', neighbors: [], routes: ['C 10.0.1.0/24 via Gi0/0'] },
          { text: 'R1 advertises its entire table to R2 every 30 seconds — "distance vector" means "here is what I know and how far".', links: ['r1-r2'], node: 'R1', neighbors: ['R2 · UDP/520'], routes: [] },
          { text: 'R2 adds 10.0.1.0/24 via R1 with metric 1. It passes the route on with metric 2.', links: ['r1-r2'], node: 'R2', neighbors: ['R1 · metric 1'], routes: ['R 10.0.1.0/24 via R1, metric 1'] },
          { text: 'R3 hears about 10.0.1.0/24 two hops away. hop count is the only metric — bandwidth is ignored.', links: ['r2-r3'], node: 'R3', neighbors: ['R2 · metric 2'], routes: ['R 10.0.1.0/24 via R2, metric 2'] },
          { text: 'Converged. A link failure is slow to propagate because routers wait for timers — this is why RIP is rarely used today.', links: ['r1-r2', 'r2-r3'], node: 'R3', neighbors: [], routes: ['R 10.0.1.0/24 via R2, metric 2', 'R 10.0.4.0/24 via R2, metric 1'] }
        ]
      },
      ospf: {
        name: 'OSPF', full: 'Open Shortest Path First', kind: 'IGP · link state',
        algorithm: 'Dijkstra shortest-path tree (SPF)', metric: 'Cost = reference bandwidth / interface bandwidth',
        ad: '110', timer: 'Hello 10 s · dead 40 s · LSA every 30 min',
        transport: 'IP protocol 89 · multicast 224.0.0.5/6', extra: 'Areas keep the LSDB small; area 0 is the backbone.',
        runnable: true,
        steps: [
          { text: 'R1 and R2 become neighbors after exchanging Hello packets on their shared /30 link.', links: ['r1-r2'], node: 'R1', neighbors: ['R2 · 10.0.12.2 · FULL'], routes: [] },
          { text: 'R1 elects a DR/BDR on the broadcast segment, then forms full adjacencies. Neighbors must agree on area, timers and subnet.', links: ['r1-r2'], node: 'R2', neighbors: ['R1 · 10.0.12.1 · FULL/DR'], routes: [] },
          { text: 'Each router floods Link-State Advertisements describing its links and networks. Every router builds the same LSDB.', links: ['r1-r2', 'r1-r3', 'r2-r3'], node: 'R3', neighbors: ['R1 · FULL', 'R2 · FULL'], routes: [] },
          { text: 'R3 runs SPF over the LSDB and finds the lowest-cost tree to every network — not just the fewest hops.', links: ['r1-r3', 'r2-r3'], node: 'R3', neighbors: [], routes: ['O 10.0.1.0/24 via R1, cost 2'] },
          { text: 'Converged. Best OSPF routes install in the routing table with AD 110. Topology changes trigger immediate LSA flooding.', links: ['r1-r2', 'r1-r3', 'r2-r3'], node: 'R1', neighbors: [], routes: ['O 10.0.1.0/24 via R1, cost 2', 'O 10.0.4.0/24 via R2, cost 2'] }
        ]
      },
      eigrp: {
        name: 'EIGRP', full: 'Enhanced Interior Gateway Routing Protocol', kind: 'IGP · advanced distance vector',
        algorithm: 'DUAL (Diffusing Update Algorithm)', metric: 'Bandwidth + delay (default K values)',
        ad: '90 (internal) · 170 (external)', timer: 'Hello 5 s · hold 15 s',
        transport: 'IP protocol 88 · multicast 224.0.0.10', extra: 'Maintains a feasible successor for fast failover.',
        runnable: true,
        steps: [
          { text: 'R1 sends EIGRP Hello packets. Neighbors must share the same autonomous system number.', links: ['r1-r2'], node: 'R1', neighbors: [], routes: [] },
          { text: 'R1 and R2 form an adjacency. Topology tables begin filling with routes and their computed metrics.', links: ['r1-r2'], node: 'R2', neighbors: ['R1 · AS 100 · up 00:00:15'], routes: [] },
          { text: 'Updates carry composite metrics from bandwidth and delay. R2 calculates the best path and a backup feasible successor.', links: ['r1-r2', 'r2-r3'], node: 'R2', neighbors: ['R1 · AS 100', 'R3 · AS 100'], routes: ['D 10.0.1.0/24 via R1, FD 307200'] },
          { text: 'R3 installs the route. If R1 fails, EIGRP can switch to the feasible successor almost instantly.', links: ['r2-r3'], node: 'R3', neighbors: [], routes: ['D 10.0.1.0/24 via R2, FD 332800'] },
          { text: 'Converged. EIGRP is Cisco-originated but now open; it converges faster than RIP and considers more than hop count.', links: ['r1-r2', 'r2-r3'], node: 'R3', neighbors: [], routes: ['D 10.0.1.0/24 via R2, FD 332800', 'D 10.0.4.0/24 via R2, FD 281600'] }
        ]
      },
      isis: {
        name: 'IS-IS', full: 'Intermediate System to Intermediate System', kind: 'IGP · link state',
        algorithm: 'Dijkstra SPF over a link-state database', metric: 'Default interface cost (1 by default)',
        ad: '115', timer: 'IIH Hello 10 s · LSP refresh ~15 min',
        transport: 'CLNS Layer 2 directly (no IP transport)', extra: 'Level 1 = intra-area, Level 2 = backbone; NET/NSAP addresses identify routers.',
        runnable: true,
        steps: [
          { text: 'Routers exchange IS-IS Hello (IIH) packets directly over Layer 2 — IS-IS does not need IP to form neighbors.', links: ['r1-r2'], node: 'R1', neighbors: [], routes: [] },
          { text: 'Level 1 adjacencies form inside the area. Level 2 adjacencies connect areas through the backbone.', links: ['r1-r2'], node: 'R2', neighbors: ['R1 · L1/L2 · UP'], routes: [] },
          { text: 'Each router floods Link-State Packets (LSPs). All routers in the level build the same database.', links: ['r1-r2', 'r1-r3', 'r2-r3'], node: 'R3', neighbors: ['R1 · UP', 'R2 · UP'], routes: [] },
          { text: 'SPF computes shortest paths. IS-IS was designed for large service-provider networks and scales very well.', links: ['r1-r3'], node: 'R3', neighbors: [], routes: ['I 10.0.1.0/24 via R1, cost 20'] },
          { text: 'Converged. Routes install with AD 115. The CLNS/NSAP addressing looks odd at first but keeps IS-IS independent of IP.', links: ['r1-r2', 'r1-r3', 'r2-r3'], node: 'R2', neighbors: [], routes: ['I 10.0.1.0/24 via R1, cost 20', 'I 10.0.4.0/24 via R2, cost 10'] }
        ]
      },
      bgp: {
        name: 'BGP', full: 'Border Gateway Protocol', kind: 'EGP · path vector',
        algorithm: 'Best-path selection using attributes', metric: 'AS_PATH length, then LOCAL_PREF, origin, MED, eBGP over iBGP…',
        ad: '20 (eBGP) · 200 (iBGP)', timer: 'Keepalive 60 s · hold 180 s',
        transport: 'TCP port 179', extra: 'The protocol that glues autonomous systems together on the Internet.',
        runnable: true,
        steps: [
          { text: 'R1 in AS 65001 opens a TCP connection to R2 in AS 65002. BGP peers are explicitly configured, not discovered.', links: ['r1-r2'], node: 'R1', neighbors: [], routes: [] },
          { text: 'OPEN messages negotiate version, AS numbers, router ID and capabilities. Peers move to Established.', links: ['r1-r2'], node: 'R2', neighbors: ['R2 · AS 65002 · Established'], routes: [] },
          { text: 'UPDATE messages advertise NLRI (prefixes) plus path attributes such as AS_PATH, NEXT_HOP and LOCAL_PREF.', links: ['r1-r2', 'r2-r3'], node: 'R2', neighbors: ['R1 · AS 65001', 'R3 · AS 65003'], routes: [] },
          { text: 'R3 receives 10.0.1.0/24 with AS_PATH 65001 65002. Shorter AS_PATH usually wins; loops are detected by seeing your own AS in the path.', links: ['r2-r3'], node: 'R3', neighbors: [], routes: ['B 10.0.1.0/24 via R2, AS_PATH 65001 65002'] },
          { text: 'Converged. BGP chooses one best path per prefix and advertises only that path. Internet scale is why policy matters more than raw speed.', links: ['r1-r2', 'r2-r3'], node: 'R1', neighbors: [], routes: ['B 10.0.1.0/24 via R2, AS_PATH 65001 65002', 'B 10.0.4.0/24 via R2, AS_PATH 65003'] }
        ]
      }
    };
    const order = ['rip', 'ospf', 'eigrp', 'isis', 'bgp'];
    const nodes = {
      R1: { x: 110, y: 48 }, R2: { x: 290, y: 48 }, R3: { x: 200, y: 158 }
    };
    const linkCoords = {
      'r1-r2': [[110, 48], [290, 48]],
      'r1-r3': [[110, 48], [200, 158]],
      'r2-r3': [[290, 48], [200, 158]]
    };

    const body =
      '<p>Routing protocols are how routers learn routes to networks they are not directly connected to. Pick a protocol and step through its neighbour discovery, updates and convergence.</p>' +
      '<div class="teach-tabs" role="tablist">' + order.map((k, i) =>
        '<button class="teach-tab' + (i === 1 ? ' active' : '') + '" data-viz-proto="' + k + '">' + protocols[k].name + '</button>').join('') + '</div>' +
      '<div class="viz-layout">' +
        '<div>' +
          '<div class="viz-canvas" id="vizCanvas">' +
            '<svg viewBox="0 0 400 210" role="img" aria-label="Three-router topology">' +
              '<line class="viz-link" id="link-r1-r2" x1="110" y1="48" x2="290" y2="48"/>' +
              '<line class="viz-link" id="link-r1-r3" x1="110" y1="48" x2="200" y2="158"/>' +
              '<line class="viz-link" id="link-r2-r3" x1="290" y1="48" x2="200" y2="158"/>' +
              '<g class="viz-node" id="node-R1"><circle cx="110" cy="48" r="20"/><text x="110" y="52">R1</text></g>' +
              '<g class="viz-node" id="node-R2"><circle cx="290" cy="48" r="20"/><text x="290" y="52">R2</text></g>' +
              '<g class="viz-node" id="node-R3"><circle cx="200" cy="158" r="20"/><text x="200" y="162">R3</text></g>' +
              '<text x="110" y="198" fill="#5d6b8d" font-size="8" text-anchor="middle">LAN 10.0.1.0/24</text>' +
              '<text x="290" y="198" fill="#5d6b8d" font-size="8" text-anchor="middle">LAN 10.0.4.0/24</text>' +
              '<circle class="viz-packet" id="vizPacket" r="5" cx="110" cy="48" hidden/>' +
            '</svg>' +
          '</div>' +
          '<div class="viz-controls">' +
            '<button class="btn small primary" id="vizPlay">▶ Play</button>' +
            '<button class="btn small" id="vizPause" disabled>Pause</button>' +
            '<button class="btn small" id="vizStep">Step →</button>' +
            '<button class="btn small ghost" id="vizReset">Reset</button>' +
          '</div>' +
          '<div class="viz-step" id="vizStepText"></div>' +
          '<div class="viz-table-card"><h4>Protocol facts</h4><div id="vizFacts"></div></div>' +
        '</div>' +
        '<div>' +
          '<div class="viz-table-card"><h4>Neighbors revealed</h4><div id="vizNeighbors"></div></div>' +
          '<div class="viz-table-card"><h4>Routing table</h4><div id="vizRoutes"></div></div>' +
          '<button class="btn small primary" id="vizRunLab" style="width:100%">Run in my lab</button>' +
          '<p class="muted-small" id="vizRunNote" style="margin-top:6px"></p>' +
        '</div>' +
      '</div>' +
      details([
        { title: 'Administrative distance cheat sheet', open: true, body:
          table(['Source', 'AD', 'Memory hook'], [
            ['Connected', '0', 'Always trusted'],
            ['Static', '1', 'Configured by hand'],
            ['eBGP', '20', 'External BGP'],
            ['EIGRP (internal)', '90', 'Cisco IGP'],
            ['OSPF', '110', 'Open standard link-state'],
            ['IS-IS', '115', 'Layer 2 link-state'],
            ['RIP', '120', 'Old hop-count IGP'],
            ['iBGP', '200', 'Internal BGP']
          ]) +
          '<p>Lower AD wins when the same destination is learned from two different sources. It is not the same as a routing metric: metric chooses within one protocol, AD chooses between protocols.</p>' },
        { title: 'IGP vs EGP, and why both exist', open: false, body:
          '<p>An <b>IGP</b> (RIP, OSPF, EIGRP, IS-IS) finds the best path inside one autonomous system — your company or campus. It optimizes speed and topology.</p>' +
          '<p>An <b>EGP</b> — today, BGP — connects autonomous systems. It optimizes policy: which provider you use, what you advertise, and which paths you refuse. BGP is deliberately conservative and slow to converge because the Internet is large and mistakes propagate globally.</p>' },
        { title: 'Distance vector vs link state vs path vector', open: false, body:
          '<p><b>Distance vector</b> (RIP) shares a table of "networks I know and my distance to them" with neighbors. Simple, but slow to converge and prone to loops.</p>' +
          '<p><b>Link state</b> (OSPF, IS-IS) shares a map of the topology. Every router has the same map and runs SPF locally. Faster convergence, more memory/CPU.</p>' +
          '<p><b>Path vector</b> (BGP) shares the explicit AS path. That makes loop detection easy and lets policy inspect the whole route.</p>' },
        { title: 'Loop prevention tricks', open: false, body:
          '<p>RIP uses <b>split horizon</b> (do not advertise a route back out the interface it was learned on), <b>poison reverse</b> (advertise it back with metric 16), hold-down timers and triggered updates.</p>' +
          '<p>OSPF/IS-IS avoid loops by construction: everyone has the same topology map and computes an acyclic tree. EIGRP uses DUAL and feasible successors. BGP checks that its own AS number is not already in AS_PATH.</p>' },
        { title: 'Timers, convergence and failure detection', open: false, body:
          '<p>Hello packets prove a neighbor is alive. OSPF 10/40 s, EIGRP 5/15 s, IS-IS 10/30 s, BGP 60/180 s, RIP 30/180/240 s (update/invalid/flush). BFD (Bidirectional Forwarding Detection) can provide sub-second failure detection for protocols that otherwise wait on slow timers.</p>' +
          '<p>Convergence is the time from a topology change until every router has a correct, stable table. Faster convergence usually costs more control-plane traffic.</p>' },
        { title: 'Route summarization, stubs and passive interfaces', open: false, body:
          '<p><b>Summarization</b> advertises one prefix instead of many, shrinking tables and hiding topology changes. OSPF summarizes at area borders; EIGRP can summarize on any interface; BGP aggregates with the aggregate-address command.</p>' +
          '<p>A <b>stub area</b> keeps OSPF LSAs out of branches that do not need them. A <b>passive interface</b> advertises its network but sends no hellos — ideal for user-facing VLANs with no routers attached.</p>' },
        { title: 'Redistribution and routing loops', open: false, body:
          '<p>When two routing domains need to share routes, <b>redistribution</b> injects routes from one protocol into another. It is powerful and dangerous: each protocol has different metrics, so you must <b>seed a metric</b> and tag/filter routes to prevent a route being fed back into its source domain.</p>' +
          '<p>NetLab keeps each protocol separate for teaching; it does not model route maps or redistribution.</p>' }
      ]);

    const root = open('Dynamic routing visualizer', 'RIP · OSPF · EIGRP · IS-IS · BGP', body);
    if (!root) return;
    let current = 'ospf', index = 0, timer = null;
    const stepText = $('vizStepText'), facts = $('vizFacts'), neighborBox = $('vizNeighbors'), routeBox = $('vizRoutes');
    const runBtn = $('vizRunLab'), runNote = $('vizRunNote');

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
      $('vizPlay').disabled = false;
      $('vizPause').disabled = true;
    }
    function renderFacts() {
      const p = protocols[current];
      facts.innerHTML =
        '<div class="result-row"><span>Full name</span><b>' + esc(p.full) + '</b></div>' +
        '<div class="result-row"><span>Type</span><b>' + esc(p.kind) + '</b></div>' +
        '<div class="result-row"><span>Algorithm</span><b>' + esc(p.algorithm) + '</b></div>' +
        '<div class="result-row"><span>Metric</span><b>' + esc(p.metric) + '</b></div>' +
        '<div class="result-row"><span>AD</span><b class="big-answer">' + esc(p.ad) + '</b></div>' +
        '<div class="result-row"><span>Timers</span><b>' + esc(p.timer) + '</b></div>' +
        '<div class="result-row"><span>Transport</span><b>' + esc(p.transport) + '</b></div>' +
        '<div class="result-row"><span>Remember</span><b>' + esc(p.extra) + '</b></div>';
      runBtn.disabled = !p.runnable;
      runNote.textContent = p.runnable
        ? 'Runs a simplified ' + p.name + ' convergence on your current lab and shows it in the Journey log.'
        : 'RIP is shown here for comparison. NetLab’s simulator does not run RIP on the lab canvas.';
      runBtn.title = p.runnable ? '' : 'RIP is demo-only in NetLab';
    }
    function render() {
      const p = protocols[current];
      const upto = p.steps.slice(0, index + 1);
      const step = p.steps[index];
      stepText.textContent = 'Step ' + (index + 1) + ' of ' + p.steps.length + ' · ' + step.text;
      const activeLinks = new Set();
      upto.forEach(s => (s.links || []).forEach(l => activeLinks.add(l)));
      Object.keys(linkCoords).forEach(id => $('link-' + id).classList.toggle('active', activeLinks.has(id)));
      Object.keys(nodes).forEach(id => $('node-' + id).classList.toggle('active', id === step.node));
      const packet = $('vizPacket');
      if (step.links && step.links.length) {
        const coords = linkCoords[step.links[step.links.length - 1]];
        packet.hidden = false;
        packet.setAttribute('cx', coords[step.node === 'R2' ? 1 : 0][0]);
        packet.setAttribute('cy', coords[step.node === 'R2' ? 1 : 0][1]);
      } else packet.hidden = true;
      const neighbors = [], routes = [];
      upto.forEach(s => { (s.neighbors || []).forEach(n => { if (neighbors.indexOf(n) < 0) neighbors.push(n); }); });
      upto.forEach(s => { (s.routes || []).forEach(r => { if (routes.indexOf(r) < 0) routes.push(r); }); });
      neighborBox.innerHTML = neighbors.length
        ? neighbors.map(n => '<div class="viz-route new">● ' + esc(n) + '</div>').join('')
        : '<div class="viz-route empty">No neighbors yet — press Step.</div>';
      routeBox.innerHTML = routes.length
        ? routes.map((r, i) => '<div class="viz-route' + (i === routes.length - 1 && index > 0 ? ' new' : '') + '">' + esc(r) + '</div>').join('')
        : '<div class="viz-route empty">Routing table is empty.</div>';
    }
    function setProto(key) {
      stop();
      current = key; index = 0;
      root.querySelectorAll('[data-viz-proto]').forEach(b => b.classList.toggle('active', b.dataset.vizProto === key));
      renderFacts(); render();
    }
    function advance() {
      const steps = protocols[current].steps;
      if (index >= steps.length - 1) { stop(); return; }
      index++; render();
    }
    root.querySelectorAll('[data-viz-proto]').forEach(b => b.addEventListener('click', () => setProto(b.dataset.vizProto)));
    $('vizStep').addEventListener('click', () => { stop(); advance(); });
    $('vizPlay').addEventListener('click', () => {
      if (index >= protocols[current].steps.length - 1) index = 0;
      render();
      if (!timer) {
        timer = setInterval(() => {
          if (!document.body.contains(root)) { stop(); return; }
          advance();
        }, 1250);
      }
      $('vizPlay').disabled = true;
      $('vizPause').disabled = false;
    });
    $('vizPause').addEventListener('click', stop);
    $('vizReset').addEventListener('click', () => { stop(); index = 0; render(); });
    runBtn.addEventListener('click', () => {
      const p = protocols[current];
      if (!p.runnable) return;
      if (NL.ui && typeof NL.ui.setDockView === 'function') NL.ui.setDockView('log');
      if (NL.sim && typeof NL.sim.routing === 'function') NL.sim.routing(current);
      if (NL.ui && typeof NL.ui.toast === 'function') NL.ui.toast('Running ' + p.name + ' convergence in your lab.', 'ok');
    });
    renderFacts(); render();
  }

  NL.learn = {
    openWirelessTool,
    openEthernetTool,
    openOSITool,
    openRoutingVisualizer
  };
})();
