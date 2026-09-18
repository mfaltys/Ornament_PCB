/**
 * Ornament Web Flasher UI Controller
 * trimmed from webupdi by manuel kasper (MIT)
 */

import { UpdiApplication } from './serialupdi/application.js';
import { parseHexFile } from './intel-hex-parser.js';
import { UPDI_DEVICES, type DeviceInfo } from './devices.js';

// S3 layout produced by .github/workflows/build.yml:
//   s3://unixvoid-builds/ornament/<animation>/firmware.hex
const S3_BUCKET_URL = 'https://unixvoid-builds.s3.amazonaws.com';
const S3_PREFIX = 'ornament/';
const FIRMWARE_FILENAME = 'firmware.hex';

let app: UpdiApplication | null = null;
let port: SerialPort | null = null;
let currentProgramData: Uint8Array | null = null;
let currentProgramAddress: number = 0;
let selectedDevice: DeviceInfo | null = null;
let availableAnimations: string[] = [];
let currentAnimation: string | null = null;

function formatHex(value: number, padLength: number = 4): string {
  return `0x${value.toString(16).padStart(padLength, '0').toUpperCase()}`;
}

export function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
  const logDiv = document.getElementById('log');
  if (!logDiv) return;

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;

  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;

  logDiv.appendChild(entry);
  logDiv.scrollTop = logDiv.scrollHeight;

  console.log(`[${type}] ${message}`);
}

function updateStatus(state: 'disconnected' | 'connecting' | 'connected'): void {
  const status = document.getElementById('status');
  if (!status) return;

  status.className = 'status ' + state;

  const messages: Record<string, string> = {
    'disconnected': 'Status: <strong>Disconnected</strong>',
    'connecting': 'Status: <strong>Connecting...</strong>',
    'connected': 'Status: <strong>Connected</strong>'
  };

  status.innerHTML = messages[state] || messages['disconnected'];
}

function getElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function checkConnected(): void {
  if (!app) {
    log('Not connected', 'error');
    throw new Error('Not connected');
  }
}

function handleError(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return defaultMessage;
}

function disableConnectionButtons(connected: boolean): void {
  const animationSelect = getElement<HTMLSelectElement>('animation-select');
  const programFileBtn = getElement<HTMLButtonElement>('btn-program-file');
  if (animationSelect) animationSelect.disabled = !connected;
  if (programFileBtn) programFileBtn.disabled = !connected || !currentProgramData;

  const connectBtn = getElement<HTMLButtonElement>('btn-connect');
  if (connectBtn) connectBtn.disabled = connected;

  const disconnectBtn = getElement<HTMLButtonElement>('btn-disconnect');
  if (disconnectBtn) disconnectBtn.disabled = !connected;
}

async function connectToSerial(): Promise<void> {
  try {
    updateStatus('connecting');

    port = await navigator.serial.requestPort();

    app = new UpdiApplication(port, 230400);
    await app.init();

    updateStatus('connected');
    disableConnectionButtons(true);

        log('Connected to serial device', 'success');

    // Read device info (required for proper UPDI initialization)
    try {
      await app.readDeviceInfo();
    } catch (error) {
      log(`Error reading device info: ${handleError(error, 'Unknown error')}`, 'error');
    }

    // Enter programming mode (required for device ID read)
    try {
      await app.enterProgmode();
    } catch (error) {
      log(`Error entering programming mode: ${handleError(error, 'Unknown error')}`, 'error');
    }

    // Auto-detect device by reading device ID
    await autoSelectDeviceByID();

    // Load the list of available animations from S3
    await fetchAnimations();
  } catch (error) {
    updateStatus('disconnected');
    disableConnectionButtons(false);
    throw error;
  }
}

async function disconnectFromSerial(): Promise<void> {
  if (app) {
    try {
      await app.destroy();
    } catch (e) {
      // Ignore errors during disconnect
    }
    app = null;
  }

  if (port) {
    try {
      await port.close();
    } catch (e) {
      // Ignore errors during disconnect
    }
    port = null;
  }

  currentProgramData = null;
  currentProgramAddress = 0;
  selectedDevice = null;
  currentAnimation = null;

  updateStatus('disconnected');
  disableConnectionButtons(false);
  log('Disconnected', 'info');
}

function findDeviceByID(deviceID: number): string | null {
  for (const [name, device] of Object.entries(UPDI_DEVICES)) {
    if (device.device_id === deviceID) {
      return name;
    }
  }
  return null;
}

async function autoSelectDeviceByID(): Promise<void> {
  if (!app) {
    log('App not initialized', 'error');
    return;
  }

  try {
    const address = 0x1100;
    log(`Reading device ID from ${formatHex(address)}...`, 'info');
    const deviceIDBytes = await app.readData(address, 3);
    const deviceID = (deviceIDBytes[0] << 16) | (deviceIDBytes[1] << 8) | deviceIDBytes[2];
    log(`Read device ID: ${formatHex(deviceID, 6)}`, 'info');

    const matchedDeviceName = findDeviceByID(deviceID);
    if (matchedDeviceName) {
      selectedDevice = UPDI_DEVICES[matchedDeviceName];
      log(`Device detected: ${matchedDeviceName}`, 'success');
    } else {
      throw new Error(`Unknown device ID: ${formatHex(deviceID, 6)}`);
    }
  } catch (error) {
    throw new Error(`Failed to read device ID: ${handleError(error, 'Unknown error')}`);
  }
}

function prettyAnimationName(name: string): string {
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Lists the animations published by CI at s3://unixvoid-builds/ornament/<name>/firmware.hex.
 *
 * Requires the bucket to allow public s3:ListBucket on the "ornament/" prefix plus a CORS
 * rule permitting GET from this site. A failure here is logged but does not abort the
 * serial connection, so the rest of the flasher stays usable.
 */
async function fetchAnimations(): Promise<void> {
  try {
    const url = `${S3_BUCKET_URL}/?list-type=2&max-keys=1000&prefix=${encodeURIComponent(S3_PREFIX)}`;
    log('Loading animations from S3...', 'info');

    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1];
      throw new Error(`S3 returned HTTP ${response.status}${code ? ` (${code})` : ''}`);
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const errorCode = xmlDoc.getElementsByTagName('Code')[0]?.textContent;
    if (errorCode) {
      throw new Error(`S3 returned ${errorCode}`);
    }

    const keys = xmlDoc.getElementsByTagName('Key');
    const animations = new Set<string>();
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i].textContent || '';
      const match = key.match(/^ornament\/([^/]+)\/firmware\.hex$/);
      if (match) {
        animations.add(match[1]);
      }
    }

    availableAnimations = Array.from(animations).sort();
    populateAnimationSelect();

    if (availableAnimations.length === 0) {
      log('No animations found in S3', 'warn');
    } else {
      log(`Found ${availableAnimations.length} animation(s)`, 'success');
    }
  } catch (error) {
    if (error instanceof TypeError) {
      log('Could not reach S3 to list animations (network or CORS error)', 'error');
      log(`Add a bucket CORS rule allowing GET from ${window.location.origin}`, 'warn');
    } else {
      log(`Could not list animations: ${handleError(error, 'Unknown error')}`, 'error');
      log('The bucket must allow public s3:ListBucket on the "ornament/" prefix', 'warn');
    }
  }
}

function populateAnimationSelect(): void {
  const select = getElement<HTMLSelectElement>('animation-select');
  if (!select) return;

  const previous = select.value;

  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = availableAnimations.length
    ? '-- Select animation --'
    : '-- No animations found --';
  select.appendChild(placeholder);

  for (const name of availableAnimations) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = prettyAnimationName(name);
    select.appendChild(option);
  }

  if (previous && availableAnimations.includes(previous)) {
    select.value = previous;
  }
}

async function loadAnimationFromS3(name: string): Promise<void> {
  checkConnected();

  const url = `${S3_BUCKET_URL}/${S3_PREFIX}${name}/${FIRMWARE_FILENAME}`;
  log(`Loading "${prettyAnimationName(name)}"...`, 'info');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch animation: HTTP ${response.status} ${response.statusText}`);
  }

  const hexContent = await response.text();

  const { data, address } = await parseHexFile(hexContent);

  currentProgramData = data;
  currentProgramAddress = address;
  currentAnimation = name;

  log(`Loaded "${prettyAnimationName(name)}" (${data.length} bytes)`, 'success');
  disableConnectionButtons(true);
}

async function programFile(): Promise<void> {
  checkConnected();

  if (!currentProgramData || currentProgramData.length === 0) {
    throw new Error('No firmware loaded');
  }

  if (!selectedDevice) {
    throw new Error('No device selected');
  }

  const memoryConfig = {
    pageSize: selectedDevice.flash_page_size || 0x40,
    startAddress: selectedDevice.flash_address || 0x4000,
  };

  log('Programming flash...', 'info');

  // Enter programming mode
  await app!.enterProgmode();

  // Chip erase
  await app!.chipErase();

  // Re-enter programming mode after erase
  await app!.enterProgmode();

  const data = currentProgramData;
  const totalPages = Math.ceil(data.length / memoryConfig.pageSize);

  for (let page = 0; page < totalPages; page++) {
    const pageOffset = page * memoryConfig.pageSize;
    const pageData = data.slice(pageOffset, pageOffset + memoryConfig.pageSize);
    const pageAddress = memoryConfig.startAddress + pageOffset;

    let writeData = pageData;
    if (pageData.length < memoryConfig.pageSize) {
      const padded = new Uint8Array(memoryConfig.pageSize).fill(0xFF);
      padded.set(pageData);
      writeData = padded;
    }

    await app!.writeFlash(pageAddress, writeData);
    log(`Wrote page ${page + 1}/${totalPages}`, 'info');
  }

  log('Programming complete, verifying...', 'info');

  // Verify
  for (let page = 0; page < totalPages; page++) {
    const pageOffset = page * memoryConfig.pageSize;
    const pageAddress = memoryConfig.startAddress + pageOffset;
    const readData = await app!.readData(pageAddress, memoryConfig.pageSize);
    const originalData = data.slice(pageOffset, pageOffset + memoryConfig.pageSize);
    const paddedOriginal = new Uint8Array(memoryConfig.pageSize).fill(0xFF);
    paddedOriginal.set(originalData);

    for (let i = 0; i < memoryConfig.pageSize; i++) {
      if (readData[i] !== paddedOriginal[i]) {
        throw new Error(
          `Verification failed at ${formatHex(pageAddress + i)}: ` +
          `expected 0x${paddedOriginal[i].toString(16).padStart(2, '0')}, got 0x${readData[i].toString(16).padStart(2, '0')}`
        );
      }
    }
  }

  log(`"${prettyAnimationName(currentAnimation ?? 'animation')}" programmed and verified`, 'success');
}

export function initializeUI(): void {
  const connectBtn = getElement<HTMLButtonElement>('btn-connect');
  const disconnectBtn = getElement<HTMLButtonElement>('btn-disconnect');
  const programFileBtn = getElement<HTMLButtonElement>('btn-program-file');
  const animationSelect = getElement<HTMLSelectElement>('animation-select');
  const btnClearLog = getElement<HTMLButtonElement>('btn-clear-log');

  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      try {
        await connectToSerial();
      } catch (error) {
        log(`Connection failed: ${handleError(error, 'Unknown error')}`, 'error');
        updateStatus('disconnected');
        disableConnectionButtons(false);
      }
    });
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', async () => {
      await disconnectFromSerial();
    });
  }

  if (animationSelect) {
    animationSelect.addEventListener('change', async (e) => {
      const select = e.target as HTMLSelectElement;
      const name = select.value;
      if (name) {
        try {
          await loadAnimationFromS3(name);
        } catch (error) {
          log(`Failed to load animation: ${handleError(error, 'Unknown error')}`, 'error');
        }
      }
    });
  }

  if (programFileBtn) {
    programFileBtn.disabled = true;
    programFileBtn.addEventListener('click', async () => {
      try {
        await programFile();
      } catch (error) {
        log(`Programming failed: ${handleError(error, 'Unknown error')}`, 'error');
      }
    });
  }

  if (btnClearLog) {
    btnClearLog.addEventListener('click', () => {
      const logDiv = document.getElementById('log');
      if (logDiv) logDiv.innerHTML = '';
    });
  }

  updateStatus('disconnected');
  log('Web Flasher ready - connect a device to begin', 'info');
}
