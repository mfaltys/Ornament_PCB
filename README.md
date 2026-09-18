<div align="center">

# Ornament PCB

[![Firmware Build](https://github.com/mfaltys/Ornament_PCB/actions/workflows/build.yml/badge.svg)](https://github.com/mfaltys/Ornament_PCB/actions/workflows/build.yml)
[![Firmware flasher](https://img.shields.io/badge/%F0%9F%94%A5%20Flasher-mfaltys.github.io%2FOrnament__PCB-green.svg)](https://mfaltys.github.io/Ornament_PCB/)
[![ATtiny1614](https://img.shields.io/badge/ATtiny1614-tinyAVR-0FA0CE?labelColor=333&logo=microchip&logoColor=white)]()

**[Flash an animation directly from your browser → mfaltys.github.io/Ornament_PCB](https://mfaltys.github.io/Ornament_PCB/)**

</div>

## Overview

Coin-cell powered Christmas tree ornament based on the ATtiny1614.
Press the button to start/stop the animation; the animation auto-stops after
5 minutes, and the chip sleeps in `POWER_DOWN` (wake on button) when idle to
save the coin cell. Need to load a new animation? Use the hosted
[web flasher](https://mfaltys.github.io/Ornament_PCB/) — it talks to your
ornament right from the browser, no PlatformIO install needed.

---

## Web flasher

The flasher lives in [`docs/`](docs/) and is deployed to
**[mfaltys.github.io/Ornament_PCB](https://mfaltys.github.io/Ornament_PCB/)**
via GitHub Pages (`.github/workflows/pages.yml` builds the Vite site in
`docs/` and publishes `docs/dist`).

How it works:

1. Connect a serialUPDI programmer, open the flasher in **Chrome, Edge, or
   Opera** (Web Serial support required), and click **Connect**.
2. The flasher auto-detects the ATtiny1614 over UPDI and lists the animations
   published by CI at `s3://unixvoid-builds/ornament/<name>/firmware.hex`
   (pick `demo`, `fade`, … from the dropdown).
3. Click **Program Device** — the `.hex` is fetched, flashed over UPDI,
   verified, and the BOD fuse is programmed to keep the coin cell safe.

The animation list is generated, not hardcoded: every `[env:<name>]` in
`platformio.ini` builds to `.pio/build/<name>/firmware.hex`, CI uploads each
one to S3 on pushes to `main`, and the flasher enumerates that S3 prefix at
connect time — so adding an animation (see below) automatically adds it to the
flasher.

## Animations (`src/<name>/main.cpp`)

| Animation | What it does | Power notes |
|-----------|--------------|-------------|
| `demo` | Zigzag snake, sequential sweep, random sparkle | Up to 3 LEDs on at once |
| `fade` | Breathing chase: each of the 9 LEDs fades in/out in turn | One LED at a time, brightness capped at 50% (`fadeMax = 128`), software PWM (~833 Hz) so it works on all pins |

Tune the fade in `src/fade/main.cpp`: `fadeMax` (0–255 brightness cap),
`fadeSteps` (smoothness), `slicePeriodUs` / `pwmSlices` (PWM frequency vs CPU).

## Build & flash

One PlatformIO environment per animation — the env name **is** the animation name:

```ini
[env:demo]
build_src_filter = +<demo/>

[env:fade]
build_src_filter = +<fade/>
```

```sh
pio run              # build all animations
pio run -e fade      # build just fade
pio run -e fade -t upload   # flash via serialupdi
```

Adding an animation: copy `src/demo/` to `src/<name>/`, edit it, and add a
matching `[env:<name>]` block with `build_src_filter = +<<name>/>` to
`platformio.ini`. CI (`.github/workflows/build.yml`) builds every env and
publishes `.pio/build/<name>/firmware.hex` to
`s3://unixvoid-builds/ornament/<name>/`, which the browser flasher in `docs/`
lists.

## Hardware

- MCU: ATtiny1614 (Arduino/megaTinyCore, `board = ATtiny1614`)
- 9 LEDs on Arduino pins `{8, 0, 1, 7, 6, 2, 3, 5, 4}`, button on pin `9` (PA2, falling-edge wake)
