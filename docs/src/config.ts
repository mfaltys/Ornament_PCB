// Deployment configuration for the Ornament web flasher.
// Change these if the repository or bucket moves.

export const REPOSITORY_URL = 'https://github.com/mfaltys/Ornament_PCB';
export const RELEASES_URL = 'https://api.github.com/repos/mfaltys/Ornament_PCB/releases?per_page=30';

// Artifacts uploaded by the CI build workflow (firmware.hex per tagged release).
export const FIRMWARE_BASE_URL = 'https://unixvoid-builds.s3.amazonaws.com/ornament';
export const FIRMWARE_FILENAME = 'firmware.hex';
