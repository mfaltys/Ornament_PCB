// Ornament web flasher — UPDI flashing for the ATtiny1614 over Web Serial.
// UPDI stack ported from https://github.com/manuelkasper/webupdi (MIT),
// which is a port of Microchip's pymcuprog.

import { UpdiApplication } from './updi/application.js';
import { parseHexFile } from './updi/intel-hex-parser.js';
import { RELEASES_URL, FIRMWARE_BASE_URL, FIRMWARE_FILENAME, REPOSITORY_URL } from './config.js';

// ATtiny1614 (tinyAVR 1-series, NVM version P:0)
const DEVICE = {
  nvmctrlAddress: 0x1000,
  sigrowAddress: 0x1100,
  flashAddress: 0x8000,
  flashSize: 0x4000,
  flashPageSize: 0x40,
  deviceId: 0x1E9422,
};
const BAUD = 230400;

interface Release {
  tag_name: string;
  published_at: string;
  html_url: string;
  draft?: boolean;
  prerelease?: boolean;
}

const connectButton = document.getElementById('connectButton') as HTMLButtonElement;
const connectLabel = document.getElementById('connectLabel')!;
const deviceStatus = document.getElementById('deviceStatus')!;
const releaseSelect = document.getElementById('releaseSelect') as HTMLSelectElement;
const flashButton = document.getElementById('flashButton') as HTMLButtonElement;
const progressWrap = document.getElementById('progressWrap')!;
const progressBar = document.getElementById('progressBar')!;
const progressText = document.getElementById('progressText')!;
const logEl = document.getElementById('log')!;
const logDetails = document.getElementById('logDetails') as HTMLDetailsElement;

let app: UpdiApplication | null = null;
let port: SerialPort | null = null;
let deviceVerified = false;
let releases: Release[] = [];
let flashing = false;

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
  if (type === 'error' || type === 'warn') {
    logDetails.open = true;
  }
}

function setStatus(text: string, state: 'idle' | 'ok' | 'error'): void {
  deviceStatus.textContent = text;
  deviceStatus.className = `step-hint ${state}`;
}

function setProgress(pct: number | null, text: string): void {
  if (pct === null) {
    progressWrap.hidden = true;
    return;
  }
  progressWrap.hidden = false;
  progressBar.style.width = `${pct}%`;
  progressText.textContent = text;
}

function handleError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

async function connectDevice(): Promise<void> {
  if (!navigator.serial) {
    setStatus('Your browser does not support Web Serial. Please use Chrome, Edge, or Opera.', 'error');
    connectButton.disabled = true;
    return;
  }

  try {
    connectButton.disabled = true;
    connectLabel.textContent = 'Connecting...';

    if (!port) {
      port = await navigator.serial.requestPort();
    }

    log('Opening serial port...');
    app = new UpdiApplication(port, BAUD, DEVICE, 1000);
    await app.init();
    log('UPDI link established', 'success');

    log('Checking device...');
    await app.readDeviceInfo();

    const sigrow = await app.readData(DEVICE.sigrowAddress, 3);
    const deviceId = (sigrow[0] << 16) | (sigrow[1] << 8) | sigrow[2];
    log(`Device ID: 0x${deviceId.toString(16).toUpperCase().padStart(6, '0')}`);

    if (deviceId !== DEVICE.deviceId) {
      throw new Error(`Expected an ATtiny1614 but found device ID 0x${deviceId.toString(16)}. Check that you are connected to the ornament.`);
    }
    log('ATtiny1614 detected', 'success');

    log('Entering programming mode...');
    await app.enterProgmode();
    log('Ready to flash', 'success');

    deviceVerified = true;
    connectLabel.textContent = 'Connected';
    setStatus('Flasher connected, ornament detected', 'ok');
    flashButton.disabled = !releases.length;
    await loadReleases();
  } catch (error) {
    log(`Connection failed: ${handleError(error)}`, 'error');
    setStatus('Connection failed - unplug and replug the flasher, then try again', 'error');
    connectLabel.textContent = 'Connect Device';
    deviceVerified = false;
    app = null;
    if (port) {
      try { await port.close(); } catch { /* ignore */ }
      port = null;
    }
  } finally {
    connectButton.disabled = false;
  }
}

function createReleaseOption(release: Release): HTMLOptionElement {
  const date = new Date(release.published_at).toLocaleDateString();
  return new Option(`${release.tag_name}  /  ${date}`, release.tag_name);
}

async function loadReleases(): Promise<void> {
  try {
    const response = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const all: Release[] = await response.json();
    releases = all
      .filter((r) => !r.draft && !r.prerelease)
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  } catch (error) {
    log(`Failed to load releases: ${handleError(error)}`, 'error');
  }

  if (!releases.length) {
    releaseSelect.replaceChildren(new Option('No firmware releases available yet'));
    releaseSelect.disabled = true;
    return;
  }

  releaseSelect.replaceChildren(...releases.map(createReleaseOption));
  releaseSelect.disabled = false;
  flashButton.disabled = !deviceVerified;
}

async function flashDevice(): Promise<void> {
  if (!app || !deviceVerified || flashing) return;
  const release = releases.find((r) => r.tag_name === releaseSelect.value);
  if (!release) return;

  flashing = true;
  flashButton.disabled = true;
  connectButton.disabled = true;

  try {
    const url = `${FIRMWARE_BASE_URL}/${release.tag_name}/${FIRMWARE_FILENAME}`;
    log(`Downloading firmware ${release.tag_name}...`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Firmware download failed (HTTP ${response.status})`);
    const hexText = await response.text();
    const { data, address } = await parseHexFile(hexText);
    const flashOffset = address - DEVICE.flashAddress;
    if (flashOffset < 0 || flashOffset + data.length > DEVICE.flashSize) {
      throw new Error('Firmware does not fit into the device flash');
    }
    log(`Loaded ${data.length} bytes at 0x${address.toString(16).toUpperCase()}`, 'success');

    // Split into flash pages
    const pages: { address: number; data: Uint8Array }[] = [];
    for (let offset = 0; offset < data.length; offset += DEVICE.flashPageSize) {
      const pageData = data.slice(offset, offset + DEVICE.flashPageSize);
      if (pageData.length < DEVICE.flashPageSize) {
        // Pad final page
        const padded = new Uint8Array(DEVICE.flashPageSize).fill(0xff);
        padded.set(pageData);
        pages.push({ address: DEVICE.flashAddress + offset, data: padded });
      } else {
        pages.push({ address: DEVICE.flashAddress + offset, data: pageData });
      }
    }

    log('Erasing chip...');
    await app.chipErase();
    log('Chip erased', 'success');

    for (let i = 0; i < pages.length; i++) {
      await app.writeFlash(pages[i].address, pages[i].data);
      const pct = Math.round(((i + 1) / pages.length) * 100);
      setProgress(pct, `Writing: ${i + 1}/${pages.length} pages (${pct}%)`);
      log(`Wrote page ${i + 1} at 0x${pages[i].address.toString(16).toUpperCase()}`);
    }

    log('Verifying...');
    for (let i = 0; i < pages.length; i++) {
      const readBack = await app.readData(pages[i].address, pages[i].data.length);
      for (let j = 0; j < pages[i].data.length; j++) {
        if (readBack[j] !== pages[i].data[j]) {
          throw new Error(
            `Verification failed at 0x${(pages[i].address + j).toString(16).toUpperCase()}: ` +
            `wrote 0x${pages[i].data[j].toString(16).padStart(2, '0')} but read 0x${readBack[j].toString(16).padStart(2, '0')}`
          );
        }
      }
      const pct = Math.round(((i + 1) / pages.length) * 100);
      setProgress(pct, `Verifying: ${i + 1}/${pages.length} pages (${pct}%)`);
    }

    log('Firmware verified', 'success');
    log('Starting your ornament...');
    await app.leaveProgmode();

    setProgress(100, 'Complete! Your ornament is updated.');
    log('Flash complete - you can unplug the flasher', 'success');
    setTimeout(() => setProgress(null, ''), 5000);
  } catch (error) {
    log(`Flashing failed: ${handleError(error)}`, 'error');
    setProgress(null, '');
    setStatus('Flashing failed - unplug and replug the flasher, then try again', 'error');
  } finally {
    flashing = false;
    flashButton.disabled = false;
    connectButton.disabled = false;
  }
}

connectButton.addEventListener('click', () => {
  if (deviceVerified) return;
  void connectDevice();
});
flashButton.addEventListener('click', () => void flashDevice());

// Initial state
(document.getElementById('repoLink') as HTMLAnchorElement).href = REPOSITORY_URL;
if (!navigator.serial) {
  setStatus('Your browser does not support Web Serial. Please open this page in Chrome, Edge, or Opera.', 'error');
  connectButton.disabled = true;
} else {
  setStatus('Click Connect Device, then pick the flasher port', 'idle');
}
void loadReleases();

