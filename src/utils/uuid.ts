import { v4 as uuidv4 } from 'uuid'

/** Generate a new UUID v4 for entity primary keys */
export function generateId(): string {
  return uuidv4()
}

/** Generate a device-specific identifier (stored in app settings) */
export function generateDeviceId(): string {
  return `device_${uuidv4().replace(/-/g, '').slice(0, 16)}`
}
