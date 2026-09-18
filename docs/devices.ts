// Auto-generated from device definitions
// Device info parameters for UPDI-enabled devices

export interface DeviceInfo {
  eeprom_address?: number;
  eeprom_size?: number;
  eeprom_page_size?: number;
  eeprom_read_size?: number;
  eeprom_write_size?: number;
  flash_address?: number;
  flash_size?: number;
  flash_page_size?: number;
  flash_read_size?: number;
  flash_write_size?: number;
  user_row_address?: number;
  user_row_size?: number;
  user_row_page_size?: number;
  user_row_read_size?: number;
  user_row_write_size?: number;
  device_id?: number;
}

export const UPDI_DEVICES: Record<string, DeviceInfo> = {
  // tinyAVR 0/1/2 Series - NVM version P:0
  'attiny1614': {
    device_id: 0x1E9422,
    eeprom_address: 0x00001400,
    eeprom_size: 0x0100,
    eeprom_page_size: 0x20,
    eeprom_read_size: 0x01,
    eeprom_write_size: 0x01,
    flash_address: 0x00004000,
    flash_size: 0x4000,
    flash_page_size: 0x40,
    flash_read_size: 0x02,
    flash_write_size: 0x40,
    user_row_address: 0x1300,
    user_row_size: 0x20,
    user_row_page_size: 0x01,
    user_row_read_size: 0x01,
    user_row_write_size: 0x01,
  },
  'attiny1616': {
    device_id: 0x1E9424,
    eeprom_address: 0x00001400,
    eeprom_size: 0x0100,
    eeprom_page_size: 0x20,
    eeprom_read_size: 0x01,
    eeprom_write_size: 0x01,
    flash_address: 0x00004000,
    flash_size: 0x8000,
    flash_page_size: 0x80,
    flash_read_size: 0x02,
    flash_write_size: 0x80,
    user_row_address: 0x1300,
    user_row_size: 0x40,
    user_row_page_size: 0x01,
    user_row_read_size: 0x01,
    user_row_write_size: 0x01,
  },
  'attiny1617': {
    device_id: 0x1E9425,
    eeprom_address: 0x00001400,
    eeprom_size: 0x0100,
    eeprom_page_size: 0x20,
    eeprom_read_size: 0x01,
    eeprom_write_size: 0x01,
    flash_address: 0x00004000,
    flash_size: 0x8000,
    flash_page_size: 0x80,
    flash_read_size: 0x02,
    flash_write_size: 0x80,
    user_row_address: 0x1300,
    user_row_size: 0x40,
    user_row_page_size: 0x01,
    user_row_read_size: 0x01,
    user_row_write_size: 0x01,
  },
  'attiny3216': {
    device_id: 0x1E9524,
    eeprom_address: 0x00001400,
    eeprom_size: 0x0100,
    eeprom_page_size: 0x20,
    eeprom_read_size: 0x01,
    eeprom_write_size: 0x01,
    flash_address: 0x00004000,
    flash_size: 0x8000,
    flash_page_size: 0x80,
    flash_read_size: 0x02,
    flash_write_size: 0x80,
    user_row_address: 0x1300,
    user_row_size: 0x40,
    user_row_page_size: 0x01,
    user_row_read_size: 0x01,
    user_row_write_size: 0x01,
  },
  'attiny3217': {
    device_id: 0x1E9525,
    eeprom_address: 0x00001400,
    eeprom_size: 0x0100,
    eeprom_page_size: 0x20,
    eeprom_read_size: 0x01,
    eeprom_write_size: 0x01,
    flash_address: 0x00004000,
    flash_size: 0x8000,
    flash_page_size: 0x80,
    flash_read_size: 0x02,
    flash_write_size: 0x80,
    user_row_address: 0x1300,
    user_row_size: 0x40,
    user_row_page_size: 0x01,
    user_row_read_size: 0x01,
    user_row_write_size: 0x01,
  },
  'attiny814': {
    device_id: 0x1E9324,
    eeprom_address: 0x00001400,
    eeprom_size: 0x0100,
    eeprom_page_size: 0x10,
    eeprom_read_size: 0x01,
    eeprom_write_size: 0x01,
    flash_address: 0x00004000,
    flash_size: 0x2000,
    flash_page_size: 0x40,
    flash_read_size: 0x02,
    flash_write_size: 0x40,
    user_row_address: 0x1300,
    user_row_size: 0x20,
    user_row_page_size: 0x01,
    user_row_read_size: 0x01,
    user_row_write_size: 0x01,
  },
  'attiny816': {
    device_id: 0x1E9326,
    eeprom_address: 0x00001400,
    eeprom_size: 0x0100,
    eeprom_page_size: 0x20,
    eeprom_read_size: 0x02,
    eeprom_write_size: 0x01,
    flash_address: 0x00004000,
    flash_size: 0x2000,
    flash_page_size: 0x40,
    flash_read_size: 0x02,
    flash_write_size: 0x40,
    user_row_address: 0x1300,
    user_row_size: 0x20,
    user_row_page_size: 0x01,
    user_row_read_size: 0x01,
    user_row_write_size: 0x01,
  },
};
