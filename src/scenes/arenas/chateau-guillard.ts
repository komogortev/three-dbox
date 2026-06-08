import type { DboxSceneModuleOptions } from '@/modules/DboxSceneModule'
import { dboxScene } from '../dbox'
import { CHATEAU_GUILLARD } from '@/maps/chateauGuillard'

export const chateauGuilardArena: { label: string; options: DboxSceneModuleOptions } = {
  label: 'Château Guillard',
  options: {
    descriptor: dboxScene,
    map: CHATEAU_GUILLARD,
  },
}
