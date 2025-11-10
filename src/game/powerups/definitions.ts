export type PowerUpType = 'speed' | 'bomb' | 'range' | 'shield';

interface PowerUpDefinition {
  color: number;
  label: string;
}

export const POWER_UP_DEFINITIONS: Record<PowerUpType, PowerUpDefinition> = {
  speed: { color: 0x00ffcc, label: '+Speed!' },
  bomb: { color: 0xff4444, label: '+Bomb!' },
  range: { color: 0xffdd00, label: '+Range!' },
  shield: { color: 0x66ff00, label: 'Shield!' },
};

export function getPowerUpDefinition(type: PowerUpType): PowerUpDefinition {
  return POWER_UP_DEFINITIONS[type];
}
