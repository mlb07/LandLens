import { austinJurisdictionPack } from './austin/pack'
import { houstonJurisdictionPack } from './houston/pack'
import { charlotteJurisdictionPack } from './charlotte/pack'
import { dallasJurisdictionPack } from './dallas/pack'
import { registerJurisdictionPack } from './registry'

export function registerDefaultJurisdictionPacks(): void {
  registerJurisdictionPack(austinJurisdictionPack)
  registerJurisdictionPack(houstonJurisdictionPack)
  registerJurisdictionPack(charlotteJurisdictionPack)
  registerJurisdictionPack(dallasJurisdictionPack)
}
